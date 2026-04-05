import { isUtf8 } from "node:buffer";
import { execFile } from "node:child_process";
import { existsSync, type FSWatcher, statSync, watch } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type {
	GitBranchCommitPreviewInput,
	GitBranchListEntry,
	GitBranchMutationInput,
	GitBranchSummary,
	GitChange,
	GitChangeKind,
	GitChangeMutationInput,
	GitCommitPreview,
	GitDiffInput,
	GitDiffResult,
	GitRemote,
	GitRepositoryChangeWaitInput,
	GitRepositoryChangeWaitResult,
	GitRepositoryOverview,
	GitRepositoryOverviewInput,
	GitStashEntry,
	GitStashMutationInput,
} from "#/lib/git";

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_BUFFER = 8 * 1024 * 1024;
const DEFAULT_GIT_WATCH_TIMEOUT_MS = 25_000;
const MAX_GIT_WATCH_TIMEOUT_MS = 30_000;
const GIT_WATCH_DEBOUNCE_MS = 150;

interface ExecError extends Error {
	code?: number | string;
	stdout?: string;
	stderr?: string;
}

interface ExecBufferError extends Error {
	code?: number | string;
	stdout?: Buffer;
	stderr?: Buffer;
}

type GitDiffContentSource =
	| {
			kind: "empty";
	  }
	| {
			kind: "head" | "index" | "worktree";
			path: string;
	  };

interface GitTextSourceResult {
	content: string;
	exists: boolean;
	isBinary: boolean;
}

interface GitRepositoryWatcherWaiter {
	afterVersion: number;
	resolve: (result: GitRepositoryChangeWaitResult) => void;
	timer: ReturnType<typeof setTimeout>;
}

interface GitRepositoryWatchState {
	repoRoot: string;
	gitDir: string;
	version: number;
	watchers: FSWatcher[];
	waiters: GitRepositoryWatcherWaiter[];
	debounceTimer: ReturnType<typeof setTimeout> | null;
}

interface GitIgnoreMutationTarget {
	ignoreEntry: string;
	stopTracking: boolean;
}

const repositoryWatchStates = new Map<string, GitRepositoryWatchState>();
const GIT_TRACK_AHEAD_PATTERN = /ahead (\d+)/;
const GIT_TRACK_BEHIND_PATTERN = /behind (\d+)/;

export async function loadGitRepositoryOverview(
	input: GitRepositoryOverviewInput,
): Promise<GitRepositoryOverview> {
	const repoRoot = await resolveGitRepositoryRoot(input.cwd);
	const changeVersion = await ensureGitRepositoryWatchVersion(repoRoot);

	const [branch, branches, statusOutput, remotes, stashes] = await Promise.all([
		loadBranchSummary(repoRoot),
		loadLocalBranches(repoRoot),
		runGit(["status", "--short", "--untracked-files=all"], repoRoot),
		loadRemotes(repoRoot),
		loadStashes(repoRoot),
	]);

	const { staged, unstaged } = parseGitStatusOutput(statusOutput.stdout);

	return {
		repoRoot,
		repoName: path.basename(repoRoot),
		changeVersion,
		branch,
		branches,
		staged,
		unstaged,
		remotes,
		stashes,
	};
}

export async function loadGitRemotes(
	input: GitRepositoryOverviewInput,
): Promise<GitRemote[]> {
	const repoRoot = await resolveGitRepositoryRoot(input.cwd);
	return loadRemotes(repoRoot);
}

export async function loadGitBranchCommits(
	input: GitBranchCommitPreviewInput,
): Promise<GitCommitPreview[]> {
	const repoRoot = await resolveGitRepositoryRoot(input.cwd);
	const branchName = await requireValidBranchName(input.branchName);

	return loadCommitPreview(repoRoot, {
		ref: branchName,
		maxCount: input.maxCount,
	});
}

export async function loadGitDiff(input: GitDiffInput): Promise<GitDiffResult> {
	const repoRoot = await resolveGitRepositoryRoot(input.cwd);

	let content = "";

	if (input.diffMode === "unstaged" && input.code === "?") {
		const targetPath = path.resolve(repoRoot, input.path);
		const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";
		const result = await runGit(
			["diff", "--no-index", "--", nullDevice, targetPath],
			repoRoot,
			[0, 1],
		);
		content = result.stdout;
	} else {
		const args = [
			"diff",
			"--no-ext-diff",
			"--minimal",
			"--src-prefix=a/",
			"--dst-prefix=b/",
		];

		if (input.diffMode === "staged") {
			args.push("--cached");
		}

		args.push("--", input.path);
		const result = await runGit(args, repoRoot, [0, 1]);
		content = result.stdout;

		if (
			!content.trim() &&
			input.originalPath &&
			input.originalPath !== input.path
		) {
			const fallback = await runGit(
				[
					"diff",
					"--no-ext-diff",
					"--minimal",
					"--src-prefix=a/",
					"--dst-prefix=b/",
					...(input.diffMode === "staged" ? ["--cached"] : []),
					"--",
					input.originalPath,
				],
				repoRoot,
				[0, 1],
			);
			content = fallback.stdout;
		}
	}

	const sourceContent = !content.trim()
		? {
				hasTextChanges: false,
				isBinary: false,
				modifiedContent: "",
				originalContent: "",
			}
		: await resolveGitDiffContent(repoRoot, input);

	return {
		path: input.path,
		diffMode: input.diffMode,
		content,
		originalContent: sourceContent.originalContent,
		modifiedContent: sourceContent.modifiedContent,
		hasTextChanges: sourceContent.hasTextChanges,
		isBinary: /Binary files .* differ/.test(content) || sourceContent.isBinary,
		isEmpty: !content.trim(),
	};
}

async function resolveGitDiffContent(repoRoot: string, input: GitDiffInput) {
	const { modified, original } = getGitDiffContentSources(input);
	const [originalSource, modifiedSource] = await Promise.all([
		readGitDiffContentSource(repoRoot, original),
		readGitDiffContentSource(repoRoot, modified),
	]);

	if (originalSource.isBinary || modifiedSource.isBinary) {
		return {
			hasTextChanges: false,
			isBinary: true,
			modifiedContent: "",
			originalContent: "",
		};
	}

	return {
		hasTextChanges: originalSource.content !== modifiedSource.content,
		isBinary: false,
		modifiedContent: modifiedSource.content,
		originalContent: originalSource.content,
	};
}

function getGitDiffContentSources(input: GitDiffInput): {
	modified: GitDiffContentSource;
	original: GitDiffContentSource;
} {
	const originalPath = input.originalPath ?? input.path;

	if (input.diffMode === "staged") {
		return {
			original:
				input.code === "A" || input.code === "?"
					? { kind: "empty" }
					: { kind: "head", path: originalPath },
			modified:
				input.code === "D"
					? { kind: "empty" }
					: { kind: "index", path: input.path },
		};
	}

	if (input.code === "?") {
		return {
			original: { kind: "empty" },
			modified: { kind: "worktree", path: input.path },
		};
	}

	return {
		original:
			input.code === "A"
				? { kind: "empty" }
				: { kind: "index", path: originalPath },
		modified:
			input.code === "D"
				? { kind: "empty" }
				: { kind: "worktree", path: input.path },
	};
}

async function readGitDiffContentSource(
	repoRoot: string,
	source: GitDiffContentSource,
): Promise<GitTextSourceResult> {
	if (source.kind === "empty") {
		return {
			content: "",
			exists: false,
			isBinary: false,
		};
	}

	if (source.kind === "worktree") {
		return readWorktreeTextSource(repoRoot, source.path);
	}

	return readGitTextSource(
		repoRoot,
		source.kind === "head" ? `HEAD:${source.path}` : `:${source.path}`,
	);
}

async function readWorktreeTextSource(
	repoRoot: string,
	targetPath: string,
): Promise<GitTextSourceResult> {
	try {
		const contentBuffer = await readFile(
			resolveRepositoryPath(repoRoot, targetPath),
		);

		if (!isUtf8(contentBuffer)) {
			return {
				content: "",
				exists: true,
				isBinary: true,
			};
		}

		return {
			content: contentBuffer.toString("utf8"),
			exists: true,
			isBinary: false,
		};
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return {
				content: "",
				exists: false,
				isBinary: false,
			};
		}

		throw error;
	}
}

async function readGitTextSource(
	repoRoot: string,
	objectSpec: string,
): Promise<GitTextSourceResult> {
	const result = await runGitBuffer(["show", objectSpec], repoRoot, [0, 128]);

	if (result.exitCode !== 0) {
		const details = result.stderr.toString("utf8").trim().toLowerCase();

		if (
			details.includes("does not exist") ||
			details.includes("exists on disk, but not in") ||
			details.includes("bad revision") ||
			details.includes("unknown revision") ||
			details.includes("invalid object name") ||
			details.includes("not at stage")
		) {
			return {
				content: "",
				exists: false,
				isBinary: false,
			};
		}

		throw new Error(details || "Git command failed.");
	}

	if (!isUtf8(result.stdout)) {
		return {
			content: "",
			exists: true,
			isBinary: true,
		};
	}

	return {
		content: result.stdout.toString("utf8"),
		exists: true,
		isBinary: false,
	};
}

export async function applyGitChangeMutation(input: GitChangeMutationInput) {
	const repoRoot = await resolveGitRepositoryRoot(input.cwd);

	if (input.action === "stage") {
		await runGit(["add", "-A", "--", input.path], repoRoot);
	} else if (input.action === "stage-selected") {
		const stagePaths = [...new Set(input.paths?.filter(Boolean) ?? [])];

		if (stagePaths.length === 0) {
			throw new Error("No selected changes were provided.");
		}

		for (const stagePath of stagePaths) {
			await runGit(["add", "-A", "--", stagePath], repoRoot);
		}
	} else if (input.action === "stage-all") {
		await runGit(["add", "-A", "."], repoRoot);
	} else if (input.action === "unstage") {
		await runGit(["restore", "--staged", "--", input.path], repoRoot);
	} else if (input.action === "unstage-selected") {
		const unstagePaths = [...new Set(input.paths?.filter(Boolean) ?? [])];

		if (unstagePaths.length === 0) {
			throw new Error("No selected changes were provided.");
		}

		for (const unstagePath of unstagePaths) {
			await runGit(["restore", "--staged", "--", unstagePath], repoRoot);
		}
	} else if (input.action === "unstage-all") {
		await runGit(["restore", "--staged", "."], repoRoot);
	} else if (input.action === "ignore") {
		await appendPathsToGitIgnore(repoRoot, [input.path]);
	} else if (input.action === "ignore-selected") {
		const ignorePaths = [...new Set(input.paths?.filter(Boolean) ?? [])];

		if (ignorePaths.length === 0) {
			throw new Error("No selected changes were provided.");
		}

		await appendPathsToGitIgnore(repoRoot, ignorePaths);
	} else if (input.action === "commit") {
		if (!input.commitMessage) {
			throw new Error("Commit message is required.");
		}
		await runGit(["commit", "-m", input.commitMessage], repoRoot);
	} else if (input.action === "commit-push") {
		if (!input.commitMessage) {
			throw new Error("Commit message is required.");
		}
		await runGit(["commit", "-m", input.commitMessage], repoRoot);
		await runGit(["push"], repoRoot);
	} else if (input.action === "discard") {
		await discardGitPath(repoRoot, input.path);
	} else if (input.action === "discard-selected") {
		const discardPaths = [...new Set(input.paths?.filter(Boolean) ?? [])];

		if (discardPaths.length === 0) {
			throw new Error("No selected changes were provided.");
		}

		for (const discardPath of discardPaths) {
			await discardGitPath(repoRoot, discardPath);
		}
	}

	signalGitRepositoryChange(repoRoot);

	return {
		ok: true,
	};
}

async function appendPathsToGitIgnore(repoRoot: string, inputPaths: string[]) {
	const ignoreFilePath = path.join(repoRoot, ".gitignore");
	const gitIgnoreContent = await readFile(ignoreFilePath, "utf8").catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === "ENOENT") {
				return "";
			}

			throw error;
		},
	);
	const targetsByEntry = new Map<string, GitIgnoreMutationTarget>();
	const existingEntries = new Set(
		gitIgnoreContent
			.split(/\r?\n/u)
			.map((line) => line.trim())
			.filter(Boolean),
	);

	for (const inputPath of inputPaths) {
		const target = await resolveGitIgnoreTarget(repoRoot, inputPath);
		const existingTarget = targetsByEntry.get(target.ignoreEntry);

		if (existingTarget) {
			existingTarget.stopTracking =
				existingTarget.stopTracking || target.stopTracking;
			continue;
		}

		targetsByEntry.set(target.ignoreEntry, target);
	}

	const nextEntries = [...targetsByEntry.keys()].filter(
		(ignoreEntry) => !existingEntries.has(ignoreEntry),
	);

	if (nextEntries.length > 0) {
		const nextContent = gitIgnoreContent.length
			? `${gitIgnoreContent}${gitIgnoreContent.endsWith("\n") ? "" : "\n"}${nextEntries.join("\n")}\n`
			: `${nextEntries.join("\n")}\n`;

		await writeFile(ignoreFilePath, nextContent, "utf8");
	}

	for (const target of targetsByEntry.values()) {
		if (!target.stopTracking) {
			continue;
		}

		await runGit(
			["rm", "--cached", "--force", "--", target.ignoreEntry],
			repoRoot,
		);
	}
}

async function discardGitPath(repoRoot: string, discardPath: string) {
	const statusOutput = await runGit(
		["status", "--short", "--", discardPath],
		repoRoot,
	);
	const isUntracked = statusOutput.stdout.startsWith("??");

	if (isUntracked) {
		await rm(resolveRepositoryPath(repoRoot, discardPath), {
			force: true,
			recursive: true,
		});
		return;
	}

	await runGit(["restore", "--", discardPath], repoRoot);
}

async function resolveGitIgnoreTarget(
	repoRoot: string,
	targetPath: string,
): Promise<GitIgnoreMutationTarget> {
	const safePath = resolveRepositoryRelativePath(repoRoot, targetPath);

	if (safePath.includes("\n") || safePath.includes("\r")) {
		throw new Error("Invalid path for .gitignore entry.");
	}

	const statusOutput = await runGit(
		["status", "--short", "--untracked-files=all", "--", safePath],
		repoRoot,
	);
	const { staged, unstaged } = parseGitStatusOutput(statusOutput.stdout);
	const matchingChange =
		[...staged, ...unstaged].find((change) => change.path === safePath) ?? null;

	if (!matchingChange) {
		throw new Error("Path is no longer available to ignore.");
	}

	if (matchingChange.kind === "untracked") {
		return {
			ignoreEntry: safePath,
			stopTracking: false,
		};
	}

	if (
		matchingChange.kind === "deleted" ||
		matchingChange.kind === "unmerged" ||
		!existsSync(resolveRepositoryPath(repoRoot, safePath))
	) {
		throw new Error("This change cannot be ignored from the sidebar.");
	}

	return {
		ignoreEntry: safePath,
		stopTracking: true,
	};
}

function resolveRepositoryPath(repoRoot: string, targetPath: string) {
	const resolvedPath = path.resolve(repoRoot, targetPath);
	const relativePath = path.relative(repoRoot, resolvedPath);

	if (
		relativePath === "" ||
		(relativePath &&
			!relativePath.startsWith("..") &&
			!path.isAbsolute(relativePath))
	) {
		return resolvedPath;
	}

	throw new Error("Refusing to discard a path outside the repository.");
}

function resolveRepositoryRelativePath(repoRoot: string, targetPath: string) {
	const resolvedPath = resolveRepositoryPath(repoRoot, targetPath);
	return path.relative(repoRoot, resolvedPath).replace(/\\/g, "/");
}

export async function applyGitBranchMutation(input: GitBranchMutationInput) {
	const repoRoot = await resolveGitRepositoryRoot(input.cwd);

	if (input.action === "create-local") {
		const branchName = await requireValidBranchName(input.branchName);
		await runGit(["branch", branchName], repoRoot);
	} else if (input.action === "checkout-local") {
		const branchName = await requireValidBranchName(input.branchName);
		await runGit(["checkout", branchName], repoRoot);
	} else if (input.action === "checkout-remote") {
		const remoteRefName = await requireValidRemoteBranchRefName(
			repoRoot,
			input.branchName,
		);
		const localBranchName = await requireValidBranchName(
			getLocalBranchNameFromRemoteRef(remoteRefName),
		);
		const hasLocalBranch = await checkLocalBranchExists(
			repoRoot,
			localBranchName,
		);

		if (hasLocalBranch) {
			await runGit(["checkout", localBranchName], repoRoot);
		} else {
			await runGit(
				["checkout", "--track", "-b", localBranchName, remoteRefName],
				repoRoot,
			);
		}
	} else if (input.action === "delete-local") {
		const branchName = await requireValidBranchName(input.branchName);
		const branchSummary = await loadBranchSummary(repoRoot);

		if (branchSummary.detached) {
			throw new Error("Cannot delete a branch while HEAD is detached.");
		}

		if (branchSummary.name === branchName) {
			throw new Error("Cannot delete the current branch.");
		}

		await runGit(["branch", "-d", branchName], repoRoot);
	} else if (input.action === "merge-into-current") {
		const branchName = await requireValidBranchName(input.branchName);
		const branchSummary = await loadBranchSummary(repoRoot);

		if (branchSummary.detached) {
			throw new Error("Cannot merge into a detached HEAD.");
		}

		if (branchSummary.name === branchName) {
			throw new Error("Cannot merge the current branch into itself.");
		}

		await runGit(["merge", branchName], repoRoot);
	} else if (input.action === "pull-current") {
		const branchSummary = await loadBranchSummary(repoRoot);

		if (branchSummary.detached) {
			throw new Error("Cannot pull while HEAD is detached.");
		}

		if (!branchSummary.upstream) {
			throw new Error(
				`Current branch "${branchSummary.name}" has no upstream to pull from.`,
			);
		}

		await runGit(["pull"], repoRoot);
	} else if (input.action === "update-branch") {
		const branchName = await requireValidBranchName(input.branchName);
		await updateLocalBranchFromUpstream(repoRoot, branchName);
	} else if (input.action === "push-branch") {
		const branchName = await requireValidBranchName(input.branchName);
		const upstream = await loadBranchUpstream(repoRoot, branchName);
		await pushBranchToRemote(repoRoot, branchName, upstream);
	} else if (input.action === "push-current") {
		const branchSummary = await loadBranchSummary(repoRoot);

		if (branchSummary.detached) {
			throw new Error("Cannot push while HEAD is detached.");
		}

		await pushBranchToRemote(
			repoRoot,
			branchSummary.name,
			branchSummary.upstream,
		);
	}

	signalGitRepositoryChange(repoRoot);

	return {
		ok: true,
	};
}

export async function applyGitStashMutation(input: GitStashMutationInput) {
	const repoRoot = await resolveGitRepositoryRoot(input.cwd);

	if (input.action === "push") {
		const target = requireValidStashTarget(input.target);
		const stashPaths = [
			...new Set(input.paths?.map((path) => path.trim()).filter(Boolean)),
		];

		if (stashPaths.length === 0) {
			throw new Error("At least one path is required to create a stash.");
		}

		const stashMessage =
			input.message?.trim() ||
			(target === "staged" ? "Stash staged changes" : "Stash unstaged changes");
		const args = ["stash", "push"];

		if (target === "staged") {
			args.push("--staged");
		} else if (input.includeUntracked) {
			args.push("--include-untracked");
		} else {
			args.push("--keep-index");
		}

		args.push("-m", stashMessage, "--", ...stashPaths);
		await runGit(args, repoRoot);
	} else if (input.action === "apply") {
		const stashName = requireValidStashName(input.stashName);
		await runGit(["stash", "apply", "--index", stashName], repoRoot);
	} else if (input.action === "delete") {
		const stashName = requireValidStashName(input.stashName);
		await runGit(["stash", "drop", stashName], repoRoot);
	} else {
		throw new Error("Unsupported stash action.");
	}

	signalGitRepositoryChange(repoRoot);

	return {
		ok: true,
	};
}

async function pushBranchToRemote(
	repoRoot: string,
	branchName: string,
	upstream: string | null,
) {
	if (upstream) {
		const [remoteName, ...remoteBranchSegments] = upstream.split("/");
		const remoteBranchName = remoteBranchSegments.join("/") || branchName;

		await runGit(
			["push", remoteName, `${branchName}:${remoteBranchName}`],
			repoRoot,
		);
		return;
	}

	const remotes = await loadRemotes(repoRoot);
	const originRemote = remotes.find((remote) => remote.name === "origin");

	if (!originRemote) {
		throw new Error(
			`Branch "${branchName}" has no upstream and no "origin" remote is configured.`,
		);
	}

	await runGit(["push", "-u", "origin", branchName], repoRoot);
}

async function updateLocalBranchFromUpstream(
	repoRoot: string,
	branchName: string,
) {
	const branchSummary = await loadBranchSummary(repoRoot);

	if (branchSummary.name === branchName) {
		throw new Error(`Use pull to update the current branch "${branchName}".`);
	}

	const upstream = await loadBranchUpstream(repoRoot, branchName);

	if (!upstream) {
		throw new Error(`Branch "${branchName}" has no upstream to update from.`);
	}

	const [remoteName, ...remoteBranchSegments] = upstream.split("/");
	const remoteBranchName = remoteBranchSegments.join("/");

	if (!remoteName || !remoteBranchName) {
		throw new Error(
			`Branch "${branchName}" has an invalid upstream reference "${upstream}".`,
		);
	}

	await runGit(["fetch", remoteName, remoteBranchName], repoRoot);

	const { ahead, behind } = await loadAheadBehindCounts(
		repoRoot,
		branchName,
		upstream,
	);

	if (behind === 0) {
		throw new Error(
			`Branch "${branchName}" is already in sync with ${upstream}.`,
		);
	}

	if (ahead > 0) {
		throw new Error(
			`Branch "${branchName}" has local commits. Checkout the branch to merge or rebase with ${upstream}.`,
		);
	}

	const isFastForward = await runGit(
		["merge-base", "--is-ancestor", branchName, upstream],
		repoRoot,
		[0, 1],
	);

	if (isFastForward.code !== 0) {
		throw new Error(
			`Branch "${branchName}" cannot be fast-forwarded to ${upstream}. Checkout the branch to reconcile the history.`,
		);
	}

	await runGit(["branch", "-f", branchName, upstream], repoRoot);
}

export async function waitForGitRepositoryChange(
	input: GitRepositoryChangeWaitInput,
): Promise<GitRepositoryChangeWaitResult> {
	const repoRoot = await resolveGitRepositoryRoot(input.cwd);
	const watchState = await getOrCreateGitRepositoryWatchState(repoRoot);
	const timeoutMs = Math.min(
		Math.max(input.timeoutMs ?? DEFAULT_GIT_WATCH_TIMEOUT_MS, 100),
		MAX_GIT_WATCH_TIMEOUT_MS,
	);

	if (watchState.version > input.afterVersion) {
		return {
			repoRoot,
			version: watchState.version,
			changed: true,
		};
	}

	return new Promise<GitRepositoryChangeWaitResult>((resolve) => {
		const waiter: GitRepositoryWatcherWaiter = {
			afterVersion: input.afterVersion,
			resolve: (result) => {
				watchState.waiters = watchState.waiters.filter(
					(item) => item !== waiter,
				);
				clearTimeout(waiter.timer);
				resolve(result);
			},
			timer: setTimeout(() => {
				watchState.waiters = watchState.waiters.filter(
					(item) => item !== waiter,
				);
				resolve({
					repoRoot,
					version: watchState.version,
					changed: false,
				});
			}, timeoutMs),
		};

		watchState.waiters.push(waiter);
	});
}

export function parseGitStatusOutput(output: string) {
	const staged: GitChange[] = [];
	const unstaged: GitChange[] = [];

	for (const line of output.split(/\r?\n/)) {
		if (!line) {
			continue;
		}

		if (line.startsWith("?? ")) {
			unstaged.push(createGitChange("?", line.slice(3)));
			continue;
		}

		if (line.length < 4) {
			continue;
		}

		const stagedCode = line[0];
		const unstagedCode = line[1];
		const rawPath = line.slice(3);

		if (stagedCode !== " " && stagedCode !== "?") {
			staged.push(createGitChange(stagedCode, rawPath));
		}

		if (unstagedCode !== " " && unstagedCode !== "?") {
			unstaged.push(createGitChange(unstagedCode, rawPath));
		}
	}

	return { staged, unstaged };
}

function createGitChange(code: string, rawPath: string): GitChange {
	const { path: nextPath, originalPath } = parseStatusPath(rawPath);
	const metadata = getChangeMetadata(code);

	return {
		path: nextPath,
		originalPath,
		code,
		kind: metadata.kind,
		label: metadata.label,
	};
}

function parseStatusPath(rawPath: string) {
	const unquotedPath = unquoteGitPath(rawPath);
	const renamedMatch = unquotedPath.match(/^(.*) -> (.*)$/);

	if (!renamedMatch) {
		return {
			path: unquotedPath,
			originalPath: null,
		};
	}

	return {
		path: renamedMatch[2],
		originalPath: renamedMatch[1],
	};
}

function unquoteGitPath(value: string) {
	const trimmed = value.trim();

	if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) {
		return trimmed;
	}

	return trimmed
		.slice(1, -1)
		.replace(/\\(["\\])/g, "$1")
		.replace(/\\t/g, "\t")
		.replace(/\\n/g, "\n")
		.replace(/\\r/g, "\r");
}

function getChangeMetadata(code: string): {
	kind: GitChangeKind;
	label: string;
} {
	switch (code) {
		case "M":
			return { kind: "modified", label: "Modified" };
		case "A":
			return { kind: "added", label: "Added" };
		case "D":
			return { kind: "deleted", label: "Deleted" };
		case "R":
			return { kind: "renamed", label: "Renamed" };
		case "C":
			return { kind: "copied", label: "Copied" };
		case "T":
			return { kind: "typechange", label: "Typechange" };
		case "U":
			return { kind: "unmerged", label: "Unmerged" };
		case "?":
			return { kind: "untracked", label: "Untracked" };
		default:
			return { kind: "unknown", label: "Changed" };
	}
}

async function loadBranchSummary(repoRoot: string): Promise<GitBranchSummary> {
	const [branchNameResult, headShaResult, upstreamResult] = await Promise.all([
		runGit(["branch", "--show-current"], repoRoot),
		runGit(["rev-parse", "--short", "HEAD"], repoRoot),
		runGit(
			["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
			repoRoot,
			[0, 128],
		),
	]);

	const branchName = branchNameResult.stdout.trim();
	const upstream = upstreamResult.stdout.trim() || null;

	let ahead = 0;
	let behind = 0;

	if (upstream) {
		({ ahead, behind } = await loadAheadBehindCounts(
			repoRoot,
			"HEAD",
			upstream,
		));
	}

	return {
		name: branchName || `HEAD@${headShaResult.stdout.trim()}`,
		upstream,
		ahead,
		behind,
		detached: !branchName,
	};
}

async function loadAheadBehindCounts(
	repoRoot: string,
	sourceRef: string,
	upstreamRef: string,
) {
	const aheadBehindResult = await runGit(
		["rev-list", "--left-right", "--count", `${sourceRef}...${upstreamRef}`],
		repoRoot,
	);
	const [aheadValue, behindValue] = aheadBehindResult.stdout
		.trim()
		.split(/\s+/);

	return {
		ahead: Number.parseInt(aheadValue ?? "0", 10),
		behind: Number.parseInt(behindValue ?? "0", 10),
	};
}

async function loadLocalBranches(
	repoRoot: string,
): Promise<GitBranchListEntry[]> {
	const branchSummary = await loadBranchSummary(repoRoot);
	const result = await runGit(
		[
			"for-each-ref",
			"--sort=-committerdate",
			"--format=%(refname:short)%09%(upstream:short)%09%(upstream:track)%09%(committerdate:relative)%09%(objectname:short)",
			"refs/heads",
		],
		repoRoot,
	);

	return result.stdout
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			const [
				name,
				upstreamValue,
				upstreamTrack,
				lastCommitRelativeDate,
				shortSha,
			] = line.split("\t");
			const upstream = upstreamValue || null;
			const { ahead, behind } = parseUpstreamTrack(upstreamTrack);

			return {
				name,
				upstream,
				ahead,
				behind,
				lastCommitRelativeDate,
				shortSha,
				isCurrent: name === branchSummary.name,
			};
		});
}

export function parseUpstreamTrack(track: string | undefined) {
	const normalizedTrack = track?.trim() ?? "";

	if (!normalizedTrack || normalizedTrack === "[gone]") {
		return {
			ahead: 0,
			behind: 0,
		};
	}

	const ahead = Number.parseInt(
		normalizedTrack.match(GIT_TRACK_AHEAD_PATTERN)?.[1] ?? "0",
		10,
	);
	const behind = Number.parseInt(
		normalizedTrack.match(GIT_TRACK_BEHIND_PATTERN)?.[1] ?? "0",
		10,
	);

	return {
		ahead,
		behind,
	};
}

async function loadBranchUpstream(
	repoRoot: string,
	branchName: string,
): Promise<string | null> {
	const result = await runGit(
		["for-each-ref", "--format=%(upstream:short)", `refs/heads/${branchName}`],
		repoRoot,
	);

	return result.stdout.trim() || null;
}

async function loadCommitPreview(
	repoRoot: string,
	options: {
		maxCount?: number;
		ref?: string;
	} = {},
): Promise<GitCommitPreview[]> {
	const maxCount = Math.max(1, Math.min(options.maxCount ?? 8, 50));
	const result = await runGit(
		[
			"log",
			...(options.ref ? [options.ref] : []),
			`--max-count=${maxCount}`,
			"--date=relative",
			"--format=%H%x1f%h%x1f%s%x1f%cr%x1f%an",
		],
		repoRoot,
	);

	return result.stdout
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			const [sha, shortSha, summary, relativeDate, author] =
				line.split("\u001f");

			return {
				sha,
				shortSha,
				summary,
				relativeDate,
				author,
			};
		});
}

async function loadRemotes(repoRoot: string): Promise<GitRemote[]> {
	const [remoteResult, remoteBranchResult] = await Promise.all([
		runGit(["remote", "-v"], repoRoot),
		runGit(
			[
				"for-each-ref",
				"--sort=-committerdate",
				"--format=%(refname:short)%09%(committerdate:relative)",
				"refs/remotes",
			],
			repoRoot,
		),
	]);
	const remotes = new Map<string, GitRemote>();

	for (const line of remoteResult.stdout.split(/\r?\n/).filter(Boolean)) {
		const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);

		if (!match) {
			continue;
		}

		const [, name, url, type] = match;
		const existing = remotes.get(name) ?? {
			name,
			fetchUrl: null,
			pushUrl: null,
			branches: [],
		};

		if (type === "fetch") {
			existing.fetchUrl = url;
		} else {
			existing.pushUrl = url;
		}

		remotes.set(name, existing);
	}

	for (const line of remoteBranchResult.stdout.split(/\r?\n/).filter(Boolean)) {
		const [refName = "", lastCommitRelativeDate = ""] = line.split("\t");
		const separatorIndex = refName.indexOf("/");

		if (separatorIndex <= 0) {
			continue;
		}

		const remoteName = refName.slice(0, separatorIndex);
		const branchName = refName.slice(separatorIndex + 1);

		if (!branchName || branchName === "HEAD") {
			continue;
		}

		const existing = remotes.get(remoteName) ?? {
			name: remoteName,
			fetchUrl: null,
			pushUrl: null,
			branches: [],
		};

		existing.branches.push({
			name: branchName,
			refName,
			lastCommitRelativeDate,
		});

		remotes.set(remoteName, existing);
	}

	return [...remotes.values()].sort((left, right) => {
		if (left.name === "origin") {
			return -1;
		}

		if (right.name === "origin") {
			return 1;
		}

		return left.name.localeCompare(right.name);
	});
}

async function loadStashes(repoRoot: string): Promise<GitStashEntry[]> {
	const result = await runGit(
		["stash", "list", "--format=%gd%x1f%gs%x1f%cr%x1f%H"],
		repoRoot,
	);

	return result.stdout
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			const [name, message, relativeDate, commitSha] = line.split("\u001f");

			return {
				name,
				message,
				relativeDate,
				commitSha,
			};
		});
}

async function checkLocalBranchExists(
	repoRoot: string,
	branchName: string,
): Promise<boolean> {
	const result = await runGit(
		["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`],
		repoRoot,
		[0, 1],
	);

	return result.code === 0;
}

function getLocalBranchNameFromRemoteRef(remoteRefName: string) {
	const separatorIndex = remoteRefName.indexOf("/");

	if (separatorIndex <= 0 || separatorIndex === remoteRefName.length - 1) {
		throw new Error("Remote branch reference is invalid.");
	}

	return remoteRefName.slice(separatorIndex + 1);
}

async function ensureGitRepositoryWatchVersion(repoRoot: string) {
	const watchState = await getOrCreateGitRepositoryWatchState(repoRoot);
	return watchState.version;
}

async function getOrCreateGitRepositoryWatchState(repoRoot: string) {
	const existing = repositoryWatchStates.get(repoRoot);

	if (existing) {
		return existing;
	}

	const gitDir = await resolveGitDirectory(repoRoot);
	const watchState: GitRepositoryWatchState = {
		repoRoot,
		gitDir,
		version: 0,
		watchers: [],
		waiters: [],
		debounceTimer: null,
	};

	watchState.watchers = createGitRepositoryWatchers(watchState);
	repositoryWatchStates.set(repoRoot, watchState);
	return watchState;
}

function createGitRepositoryWatchers(watchState: GitRepositoryWatchState) {
	const watchers: FSWatcher[] = [];
	const targetPaths = [watchState.repoRoot];

	if (!isPathInside(watchState.repoRoot, watchState.gitDir)) {
		targetPaths.push(watchState.gitDir);
	}

	for (const targetPath of targetPaths) {
		try {
			const watcher = watch(
				targetPath,
				{
					persistent: false,
					recursive: true,
				},
				() => {
					scheduleGitRepositoryChange(watchState);
				},
			);

			watcher.on("error", () => {
				try {
					watcher.close();
				} catch {
					// Ignore watcher close failures and rely on fallback refresh.
				}

				watchState.watchers = watchState.watchers.filter(
					(item) => item !== watcher,
				);
			});

			watchers.push(watcher);
		} catch {
			// Ignore watcher setup failures and rely on fallback refresh.
		}
	}

	return watchers;
}

function scheduleGitRepositoryChange(watchState: GitRepositoryWatchState) {
	if (watchState.debounceTimer) {
		return;
	}

	watchState.debounceTimer = setTimeout(() => {
		watchState.debounceTimer = null;
		signalGitRepositoryChange(watchState.repoRoot);
	}, GIT_WATCH_DEBOUNCE_MS);
}

function signalGitRepositoryChange(repoRoot: string) {
	const watchState = repositoryWatchStates.get(repoRoot);

	if (!watchState) {
		return;
	}

	if (watchState.debounceTimer) {
		clearTimeout(watchState.debounceTimer);
		watchState.debounceTimer = null;
	}

	watchState.version += 1;
	flushGitRepositoryWaiters(watchState);
}

function flushGitRepositoryWaiters(watchState: GitRepositoryWatchState) {
	for (const waiter of [...watchState.waiters]) {
		if (watchState.version <= waiter.afterVersion) {
			continue;
		}

		waiter.resolve({
			repoRoot: watchState.repoRoot,
			version: watchState.version,
			changed: true,
		});
	}
}

async function resolveGitRepositoryRoot(requestedCwd: string) {
	const resolvedCwd = resolveWorkspacePath(requestedCwd);
	const result = await runGit(["rev-parse", "--show-toplevel"], resolvedCwd);

	return path.resolve(result.stdout.trim());
}

async function resolveGitDirectory(repoRoot: string) {
	const result = await runGit(["rev-parse", "--absolute-git-dir"], repoRoot);
	return path.resolve(repoRoot, result.stdout.trim());
}

function isPathInside(parentPath: string, targetPath: string) {
	const relativePath = path.relative(parentPath, targetPath);
	return (
		relativePath === "" ||
		(!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
	);
}

function resolveWorkspacePath(requestedCwd: string) {
	const trimmed = requestedCwd.trim();

	if (!trimmed) {
		throw new Error("Project path is required to inspect Git state.");
	}

	const expandedHome =
		trimmed === "~"
			? os.homedir()
			: trimmed.startsWith("~/")
				? path.join(os.homedir(), trimmed.slice(2))
				: trimmed;
	const resolvedPath = path.resolve(expandedHome);

	if (!existsSync(resolvedPath)) {
		throw new Error(`Project path does not exist: ${trimmed}`);
	}

	if (!statSync(resolvedPath).isDirectory()) {
		throw new Error(`Project path is not a directory: ${trimmed}`);
	}

	return resolvedPath;
}

async function requireValidBranchName(branchName: string | undefined) {
	const trimmedBranchName = branchName?.trim();

	if (!trimmedBranchName) {
		throw new Error("Branch name is required.");
	}

	await runGit(
		["check-ref-format", "--branch", trimmedBranchName],
		process.cwd(),
	);
	return trimmedBranchName;
}

function requireValidStashTarget(target: GitStashMutationInput["target"]) {
	if (target === "staged" || target === "unstaged") {
		return target;
	}

	throw new Error("A stash target is required.");
}

function requireValidStashName(stashName: string | undefined) {
	const trimmedStashName = stashName?.trim();

	if (!trimmedStashName) {
		throw new Error("Stash reference is required.");
	}

	if (!/^stash@\{\d+\}$/.test(trimmedStashName)) {
		throw new Error("Invalid stash reference.");
	}

	return trimmedStashName;
}

async function requireValidRemoteBranchRefName(
	repoRoot: string,
	branchName: string | undefined,
) {
	const trimmedBranchName = branchName?.trim();

	if (!trimmedBranchName) {
		throw new Error("Remote branch reference is required.");
	}

	const result = await runGit(
		["show-ref", "--verify", "--quiet", `refs/remotes/${trimmedBranchName}`],
		repoRoot,
		[0, 1],
	);

	if (result.code !== 0) {
		throw new Error(`Remote branch "${trimmedBranchName}" could not be found.`);
	}

	return trimmedBranchName;
}

async function runGit(
	args: string[],
	cwd: string,
	allowedExitCodes: number[] = [0],
) {
	try {
		const result = await execFileAsync("git", args, {
			cwd,
			maxBuffer: DEFAULT_MAX_BUFFER,
			windowsHide: true,
		});

		return {
			stdout: result.stdout,
			stderr: result.stderr,
			code: 0,
		};
	} catch (error) {
		if (!isExecError(error)) {
			throw error;
		}

		if (error.code === "ENOENT") {
			throw new Error("Git is not available on this machine.");
		}

		const exitCode = typeof error.code === "number" ? error.code : Number.NaN;

		if (allowedExitCodes.includes(exitCode)) {
			return {
				stdout: error.stdout ?? "",
				stderr: error.stderr ?? "",
				code: exitCode,
			};
		}

		const details = (error.stderr ?? error.message).trim();
		const lowered = details.toLowerCase();

		if (lowered.includes("not a git repository")) {
			throw new Error("This project folder is not a Git repository.");
		}

		throw new Error(details || "Git command failed.");
	}
}

async function runGitBuffer(
	args: string[],
	cwd: string,
	allowedExitCodes: number[] = [0],
): Promise<{
	exitCode: number;
	stderr: Buffer;
	stdout: Buffer;
}> {
	return new Promise((resolve, reject) => {
		execFile(
			"git",
			args,
			{
				cwd,
				encoding: "buffer",
				maxBuffer: DEFAULT_MAX_BUFFER,
				windowsHide: true,
			},
			(error, stdout, stderr) => {
				const stdoutBuffer = Buffer.isBuffer(stdout)
					? stdout
					: Buffer.from(stdout ?? "");
				const stderrBuffer = Buffer.isBuffer(stderr)
					? stderr
					: Buffer.from(stderr ?? "");

				if (!error) {
					resolve({
						exitCode: 0,
						stderr: stderrBuffer,
						stdout: stdoutBuffer,
					});
					return;
				}

				const execError = error as ExecBufferError;

				if (execError.code === "ENOENT") {
					reject(new Error("Git is not available on this machine."));
					return;
				}

				const exitCode =
					typeof execError.code === "number" ? execError.code : Number.NaN;

				if (allowedExitCodes.includes(exitCode)) {
					resolve({
						exitCode,
						stderr: stderrBuffer,
						stdout: stdoutBuffer,
					});
					return;
				}

				const details = stderrBuffer.toString("utf8").trim() || error.message;
				const lowered = details.toLowerCase();

				if (lowered.includes("not a git repository")) {
					reject(new Error("This project folder is not a Git repository."));
					return;
				}

				reject(new Error(details || "Git command failed."));
			},
		);
	});
}

function isExecError(error: unknown): error is ExecError {
	return error instanceof Error;
}
