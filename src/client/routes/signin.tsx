import { Button } from "#/components/ui/Button.tsx";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "#/components/ui/Field.tsx";
import { Input } from "#/components/ui/Input.tsx";
import { authClient } from "#/lib/auth/auth.ts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type SubmitEvent } from "react";

export const Route = createFileRoute("/signin")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const [isInFlight, setInFlightStatus] = useState(false);
  const [shouldDisplayError, setErrorStatus] = useState(false);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setInFlightStatus(true);
    setErrorStatus(false);

    const formData = new FormData(e.currentTarget);

    try {
      const response = await authClient.signIn.email({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
      });

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
    <div className="h-screen w-screen place-content-center grid p-4">
      <form className="flex flex-col gap-2 w-full sm:w-xl" onSubmit={onSubmit}>
        <FieldSet className="w-full">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email" className="text-lg">
                Email
              </FieldLabel>
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
              <FieldLabel htmlFor="password" className="text-lg">
                Password
              </FieldLabel>
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
        <Button size="lg" className="w-fit" type="submit" disabled={isInFlight}>
          Sign in
        </Button>
        {shouldDisplayError ? <FieldError>Invalid email or password.</FieldError> : null}
      </form>
    </div>
  );
}
