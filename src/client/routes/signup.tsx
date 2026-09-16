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

export const Route = createFileRoute("/signup")({
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
  const [passwordsDoNotMatch, setPasswordsDoNotMatch] = useState(false);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setInFlightStatus(true);
    setErrorStatus(false);
    setPasswordsDoNotMatch(false);
    const formData = new FormData(e.currentTarget);
    if (formData.get("password") !== formData.get("password-validation")) {
      setPasswordsDoNotMatch(true);
      setInFlightStatus(false);
      return;
    }

    const email = formData.get("email") as string;

    try {
      const response = await withTurnstile((fetchOptions) =>
        authClient.signUp.email({
          email,
          password: formData.get("password") as string,
          name: email.split("@", 1)[0],
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
      title="Create an account"
      description="Follow your favorite leagues and keep every event in one place."
      alternate={{ prompt: "Already have an account?", label: "Sign in", to: "/signin" }}
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
                autoComplete="new-password"
                minLength={8}
                placeholder="••••••••"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password-validation">Confirm password</FieldLabel>
              <Input
                id="password-validation"
                name="password-validation"
                type="password"
                size="lg"
                autoComplete="new-password"
                minLength={8}
                placeholder="••••••••"
                required
              />
              {passwordsDoNotMatch ? <FieldError>Passwords do not match.</FieldError> : null}
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
          {isInFlight ? "Creating account…" : "Create account"}
        </Button>
        {shouldDisplayError ? (
          <FieldError>There was an issue with the authentication</FieldError>
        ) : null}
      </form>
    </AuthLayout>
  );
}
