import { createServerFn } from "@tanstack/react-start";

import type {
	GitBranchCommitPreviewInput,
	GitBranchMutationInput,
	GitChangeMutationInput,
	GitDiffInput,
	GitRepositoryChangeWaitInput,
	GitRepositoryOverviewInput,
	GitStashMutationInput,
} from "#/lib/git";

export const getGitRepositoryOverview = createServerFn({ method: "GET" })
	.inputValidator((input: GitRepositoryOverviewInput) => input)
	.handler(async ({ data }) => {
		const { loadGitRepositoryOverview } = await import("#/server/git-service");
		return loadGitRepositoryOverview(data);
	});

export const getGitRemotes = createServerFn({ method: "GET" })
	.inputValidator((input: GitRepositoryOverviewInput) => input)
	.handler(async ({ data }) => {
		const { loadGitRemotes } = await import("#/server/git-service");
		return loadGitRemotes(data);
	});

export const getGitBranchCommits = createServerFn({ method: "GET" })
	.inputValidator((input: GitBranchCommitPreviewInput) => input)
	.handler(async ({ data }) => {
		const { loadGitBranchCommits } = await import("#/server/git-service");
		return loadGitBranchCommits(data);
	});

export const getGitDiff = createServerFn({ method: "GET" })
	.inputValidator((input: GitDiffInput) => input)
	.handler(async ({ data }) => {
		const { loadGitDiff } = await import("#/server/git-service");
		return loadGitDiff(data);
	});

export const waitForGitRepositoryChange = createServerFn({ method: "POST" })
	.inputValidator((input: GitRepositoryChangeWaitInput) => input)
	.handler(async ({ data }) => {
		const { waitForGitRepositoryChange: waitForRepositoryChange } =
			await import("#/server/git-service");
		return waitForRepositoryChange(data);
	});

export const mutateGitChange = createServerFn({ method: "POST" })
	.inputValidator((input: GitChangeMutationInput) => input)
	.handler(async ({ data }) => {
		const { applyGitChangeMutation } = await import("#/server/git-service");
		return applyGitChangeMutation(data);
	});

export const mutateGitBranch = createServerFn({ method: "POST" })
	.inputValidator((input: GitBranchMutationInput) => input)
	.handler(async ({ data }) => {
		const { applyGitBranchMutation } = await import("#/server/git-service");
		return applyGitBranchMutation(data);
	});

export const mutateGitStash = createServerFn({ method: "POST" })
	.inputValidator((input: GitStashMutationInput) => input)
	.handler(async ({ data }) => {
		const { applyGitStashMutation } = await import("#/server/git-service");
		return applyGitStashMutation(data);
	});
