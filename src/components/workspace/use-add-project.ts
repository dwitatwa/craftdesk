import { useState } from "react";

import type { ProjectSummary } from "#/lib/craftdesk";
import { pickProjectDirectory, saveProject } from "#/server/craftdesk";

interface UseAddProjectOptions {
	onProjectSaved?: (project: ProjectSummary) => Promise<void> | void;
}

export function useAddProject(options: UseAddProjectOptions = {}) {
	const [isAddingProject, setIsAddingProject] = useState(false);
	const [addProjectError, setAddProjectError] = useState("");

	const addProject = async () => {
		if (isAddingProject) {
			return null;
		}

		setIsAddingProject(true);
		setAddProjectError("");

		try {
			const selectedPath = await pickProjectDirectory();

			if (!selectedPath) {
				return null;
			}

			const project = await saveProject({
				data: {
					name: "",
					path: selectedPath,
				},
			});

			await options.onProjectSaved?.(project);

			return project;
		} catch (error) {
			setAddProjectError(
				error instanceof Error
					? error.message
					: "Failed to add the selected folder.",
			);

			return null;
		} finally {
			setIsAddingProject(false);
		}
	};

	return {
		addProject,
		addProjectError,
		isAddingProject,
		clearAddProjectError: () => setAddProjectError(""),
	};
}
