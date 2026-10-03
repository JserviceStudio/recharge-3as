import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/demandes")({
  component: DemandesLayout,
});

function DemandesLayout() {
  return <Outlet />;
}
