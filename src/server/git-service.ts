import { execFile } from "node:child_process";
import { existsSync, type FSWatcher, statSync, watch } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type {
	GitBranchListEntry,
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

export async function loadGitRepositoryOverview(
	input: GitRepositoryOverviewInput,
): Promise<GitRepositoryOverview> {
	const repoRoot = await resolveGitRepositoryRoot(input.cwd);
	const changeVersion = await ensureGitRepositoryWatchVersion(repoRoot);

	const [branch, branches, commits, statusOutput, remotes, stashes] =
		await Promise.all([
			loadBranchSummary(repoRoot),
			loadLocalBranches(repoRoot),
			loadCommitPreview(repoRoot),
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
		commits,
		staged,
		unstaged,
		remotes,
		stashes,
	};
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
			"--format=%(refname:short)%x1f%(committerdate:relative)%x1f%(objectname:short)",
			"refs/heads",
		],
		repoRoot,
	);

	return result.stdout
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			const [name, lastCommitRelativeDate, shortSha] = line.split("\u001f");

			return {
				name,
				lastCommitRelativeDate,
				shortSha,
				isCurrent: name === branchSummary.name,
			};
		});
}

async function loadCommitPreview(
	repoRoot: string,
): Promise<GitCommitPreview[]> {
	const result = await runGit(
		[
			"log",
			"--max-count=8",
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
