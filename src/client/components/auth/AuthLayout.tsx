import { Brand } from "#/components/ui/Brand";
import { Link } from "@tanstack/react-router";

import type { ReactNode } from "react";

type AuthLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  alternate: { prompt: string; label: string; to: "/signin" | "/signup" };
};

export function AuthLayout({ title, description, children, alternate }: AuthLayoutProps) {
  return (
    <div className="safe-area">
      <main className="page-padding flex min-h-dvh flex-col items-center">
        <div className="my-auto w-full min-w-0 max-w-md space-y-6 sm:space-y-8">
          <Brand />
          <section className="panel space-y-6 p-4 sm:p-8" aria-labelledby="auth-title">
            <header className="space-y-2">
              <h1 id="auth-title" className="page-title">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </header>
            {children}
            <p className="text-center text-sm text-muted-foreground">
              {alternate.prompt}{" "}
              <Link to={alternate.to} className="text-link">
                {alternate.label}
              </Link>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
