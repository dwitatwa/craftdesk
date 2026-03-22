import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/$projectId")({
	component: ProjectLayout,
});

function ProjectLayout() {
	return <Outlet />;
}
