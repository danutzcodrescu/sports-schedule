import { AuthLayout } from "#/components/auth/AuthLayout";
import { TurnstileField } from "#/components/auth/TurnstileField.tsx";
import { useTurnstile } from "#/components/auth/useTurnstile.ts";
import { Button } from "#/components/ui/Button.tsx";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "#/components/ui/Field.tsx";
import { Input } from "#/components/ui/Input.tsx";
import { authClient } from "#/lib/auth/auth.ts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import type { SubmitEvent } from "react";

export const Route = createFileRoute("/signin")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const {
    fieldRef: turnstileRef,
    isConfigured: isTurnstileConfigured,
    withTurnstile,
  } = useTurnstile();
  const [isInFlight, setInFlightStatus] = useState(false);
  const [shouldDisplayError, setErrorStatus] = useState(false);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setInFlightStatus(true);
    setErrorStatus(false);

    const formData = new FormData(e.currentTarget);

    try {
      const response = await withTurnstile((fetchOptions) =>
        authClient.signIn.email({
          email: formData.get("email") as string,
          password: formData.get("password") as string,
          fetchOptions,
        }),
      );

      if (!response) return;

      if (response.error) {
        setErrorStatus(true);
        return;
      }

      navigate({ to: "/" });
    } catch {
      setErrorStatus(true);
    } finally {
      setInFlightStatus(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to see your personal sports schedule."
      alternate={{ prompt: "New to Sports Center?", label: "Create an account", to: "/signup" }}
    >
      <form className="flex flex-col gap-6" onSubmit={onSubmit} aria-busy={isInFlight}>
        <FieldSet className="w-full">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                size="lg"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                size="lg"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </Field>
          </FieldGroup>
        </FieldSet>
        <TurnstileField ref={turnstileRef} />
        <Button
          size="lg"
          className="w-full"
          type="submit"
          disabled={isInFlight || !isTurnstileConfigured}
        >
          {isInFlight ? "Signing in…" : "Sign in"}
        </Button>
        {shouldDisplayError ? <FieldError>Invalid email or password.</FieldError> : null}
      </form>
    </AuthLayout>
  );
}
