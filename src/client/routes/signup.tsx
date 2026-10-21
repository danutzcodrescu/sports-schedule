import { AuthLayout } from "#/components/auth/AuthLayout";
import { TurnstileField } from "#/components/auth/TurnstileField.tsx";
import { useAuthForm } from "#/components/auth/useAuthForm";
import { Button } from "#/components/ui/Button.tsx";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "#/components/ui/Field.tsx";
import { Input } from "#/components/ui/Input.tsx";
import { authClient } from "#/lib/auth/auth.ts";
import { requireSignupEnabled } from "#/lib/auth/signup";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/signup")({
  beforeLoad: requireSignupEnabled,
  component: RouteComponent,
});

function RouteComponent() {
  const [passwordsDoNotMatch, setPasswordsDoNotMatch] = useState(false);
  const { turnstileRef, isTurnstileConfigured, onSubmit, isInFlight, shouldDisplayError } =
    useAuthForm(
      (form, fetchOptions) => {
        const email = String(form.get("email") ?? "");
        return authClient.signUp.email({
          email,
          password: String(form.get("password") ?? ""),
          name: email.split("@", 1)[0],
          fetchOptions,
        });
      },
      (form) => {
        const matches = form.get("password") === form.get("password-validation");
        setPasswordsDoNotMatch(!matches);
        return matches;
      },
    );

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
