import { useEffect } from "react";
import { Outlet, useParams, Navigate } from "react-router-dom";
import { trpc } from "@/trpc";
import AppLayout from "./AppLayout";
import { StackContext } from "./StackContext";

export default function StackLayout() {
  const { stackId } = useParams<{ stackId: string }>();
  const id = parseInt(stackId!, 10);

  // Store last visited stack for legacy redirects
  useEffect(() => {
    if (!isNaN(id)) {
      localStorage.setItem("lastStackId", String(id));
    }
  }, [id]);

  const { data: stack, isLoading } = trpc.stack.getById.useQuery(
    { stackId: id },
    { retry: false }
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading stack...</div>
      </div>
    );
  }

  if (!stack) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <StackContext.Provider value={{ stackId: id }}>
      <AppLayout stack={stack}>
        <Outlet />
      </AppLayout>
    </StackContext.Provider>
  );
}
