import { createServerFn } from "@tanstack/react-start";

import type {
	GitChangeMutationInput,
	GitDiffInput,
	GitRepositoryOverviewInput,
} from "#/lib/git";

export const getGitRepositoryOverview = createServerFn({ method: "GET" })
	.inputValidator((input: GitRepositoryOverviewInput) => input)
	.handler(async ({ data }) => {
		const { loadGitRepositoryOverview } = await import("#/server/git-service");
		return loadGitRepositoryOverview(data);
	});

export const getGitDiff = createServerFn({ method: "GET" })
	.inputValidator((input: GitDiffInput) => input)
	.handler(async ({ data }) => {
		const { loadGitDiff } = await import("#/server/git-service");
		return loadGitDiff(data);
	});

export const mutateGitChange = createServerFn({ method: "POST" })
	.inputValidator((input: GitChangeMutationInput) => input)
	.handler(async ({ data }) => {
		const { applyGitChangeMutation } = await import("#/server/git-service");
		return applyGitChangeMutation(data);
	});
