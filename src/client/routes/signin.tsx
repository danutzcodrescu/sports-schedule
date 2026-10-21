import { AuthLayout } from "#/components/auth/AuthLayout";
import { TurnstileField } from "#/components/auth/TurnstileField.tsx";
import { useAuthForm } from "#/components/auth/useAuthForm";
import { Button } from "#/components/ui/Button.tsx";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "#/components/ui/Field.tsx";
import { Input } from "#/components/ui/Input.tsx";
import { authClient } from "#/lib/auth/auth.ts";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/signin")({
  component: RouteComponent,
});

function RouteComponent() {
  const { turnstileRef, isTurnstileConfigured, onSubmit, isInFlight, shouldDisplayError } =
    useAuthForm((form, fetchOptions) =>
      authClient.signIn.email({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        fetchOptions,
      }),
    );

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
