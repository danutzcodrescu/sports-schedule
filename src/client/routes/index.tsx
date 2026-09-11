import { authClient } from "#/lib/auth/auth.ts";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();

    if (!session) {
      throw redirect({ to: "/signin" });
    }
  },
});

function Home() {
  const navigate = useNavigate();

  function logOut() {
    authClient.signOut();
    navigate({ to: "/signin" });
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
      <p className="mt-4 text-lg">
        Edit <code>src/routes/index.tsx</code> to get started.
      </p>
      <button onClick={logOut}>Sign out</button>
    </div>
  );
}
