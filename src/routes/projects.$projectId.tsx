import {
	createFileRoute,
	Outlet,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { AppShell } from "#/components/layout/app-shell";
import { useAddProject } from "#/components/workspace/use-add-project";
import { deleteProject, listProjects } from "#/server/craftdesk";

export const Route = createFileRoute("/projects/$projectId")({
	loader: async ({ params }) => {
		const projects = await listProjects({
			data: { sortBy: "name" },
		});
		const activeProject = projects.find(
			(project) => project.id === params.projectId,
		);

		return {
			activeProject: activeProject ?? null,
			projects,
		};
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.activeProject?.name
					? `Craftdesk - ${loaderData.activeProject.name}`
					: "Craftdesk",
			},
		],
	}),
	component: ProjectLayout,
});

function ProjectLayout() {
	const { activeProject, projects } = Route.useLoaderData();
	const { projectId } = Route.useParams();
	const navigate = useNavigate();
	const router = useRouter();
	const { addProject, addProjectError, isAddingProject } = useAddProject({
		onProjectSaved: async () => {
			await router.invalidate();
		},
	});

	const handleDeleteProject = async (targetProjectId: string) => {
		await deleteProject({ data: { projectId: targetProjectId } });
		await router.invalidate();

		if (targetProjectId === projectId) {
			await navigate({ to: "/" });
		}
	};

	return (
		<AppShell
			projects={projects}
			activeProject={
				activeProject
					? {
							id: activeProject.id,
							name: activeProject.name,
							path: activeProject.path,
						}
					: null
			}
			onAddProject={addProject}
			isAddingProject={isAddingProject}
			addProjectError={addProjectError}
			onDeleteProject={handleDeleteProject}
		>
			<Outlet />
		</AppShell>
	);
}
