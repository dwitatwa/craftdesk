import { execFile } from "node:child_process";
import { existsSync, type FSWatcher, statSync, watch } from "node:fs";
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

	return {
		path: input.path,
		diffMode: input.diffMode,
		content,
		isBinary: /Binary files .* differ/.test(content),
		isEmpty: !content.trim(),
	};
}

export async function applyGitChangeMutation(input: GitChangeMutationInput) {
	const repoRoot = await resolveGitRepositoryRoot(input.cwd);

	if (input.action === "stage") {
		await runGit(["add", "-A", "--", input.path], repoRoot);
	} else if (input.action === "stage-all") {
		await runGit(["add", "-A", "."], repoRoot);
	} else if (input.action === "unstage") {
		await runGit(["restore", "--staged", "--", input.path], repoRoot);
	} else if (input.action === "unstage-all") {
		await runGit(["restore", "--staged", "."], repoRoot);
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
		const statusOutput = await runGit(
			["status", "--short", "--", input.path],
			repoRoot,
		);
		const isUntracked = statusOutput.stdout.startsWith("??");

		if (isUntracked) {
			const { exec } = await import("node:child_process");
			const execAsync = promisify(exec);
			await execAsync(`rm -rf "${path.resolve(repoRoot, input.path)}"`);
		} else {
			await runGit(["restore", "--", input.path], repoRoot);
		}
	}

	signalGitRepositoryChange(repoRoot);

	return {
		ok: true,
	};
}

export async function applyGitBranchMutation(input: GitBranchMutationInput) {
	const repoRoot = await resolveGitRepositoryRoot(input.cwd);

	if (input.action === "create-local") {
		const branchName = await requireValidBranchName(input.branchName);
		await runGit(["branch", branchName], repoRoot);
	} else if (input.action === "checkout-local") {
		const branchName = await requireValidBranchName(input.branchName);
		await runGit(["checkout", branchName], repoRoot);
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
		const aheadBehindResult = await runGit(
			["rev-list", "--left-right", "--count", `HEAD...${upstream}`],
			repoRoot,
		);
		const [aheadValue, behindValue] = aheadBehindResult.stdout
			.trim()
			.split(/\s+/);
		ahead = Number.parseInt(aheadValue ?? "0", 10);
		behind = Number.parseInt(behindValue ?? "0", 10);
	}

	return {
		name: branchName || `HEAD@${headShaResult.stdout.trim()}`,
		upstream,
		ahead,
		behind,
		detached: !branchName,
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
	const result = await runGit(["remote", "-v"], repoRoot);
	const remotes = new Map<string, GitRemote>();

	for (const line of result.stdout.split(/\r?\n/).filter(Boolean)) {
		const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);

		if (!match) {
			continue;
		}

		const [, name, url, type] = match;
		const existing = remotes.get(name) ?? {
			name,
			fetchUrl: null,
			pushUrl: null,
		};

		if (type === "fetch") {
			existing.fetchUrl = url;
		} else {
			existing.pushUrl = url;
		}

		remotes.set(name, existing);
	}

	return [...remotes.values()];
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

async function runGit(
	args: string[],
	cwd: string,
	allowedExitCodes: number[] = [0],
) {
	try {
		return await execFileAsync("git", args, {
			cwd,
			maxBuffer: DEFAULT_MAX_BUFFER,
			windowsHide: true,
		});
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

function isExecError(error: unknown): error is ExecError {
	return error instanceof Error;
}
