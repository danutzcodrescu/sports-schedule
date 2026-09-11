import { Button } from "#/components/ui/Button.tsx";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "#/components/ui/Field.tsx";
import { Input } from "#/components/ui/Input.tsx";
import { authClient } from "#/lib/auth/auth.ts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type SubmitEvent } from "react";

export const Route = createFileRoute("/signup")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
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
      const response = await authClient.signUp.email({
        email,
        password: formData.get("password") as string,
        name: email.split("@", 1)[0],
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
                autoComplete="new-password"
                minLength={8}
                placeholder="••••••••"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password-validation" className="text-lg">
                Confirm password
              </FieldLabel>
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
        <Button size="lg" className="w-fit" type="submit" disabled={isInFlight}>
          Sign up
        </Button>
        {shouldDisplayError ? (
          <FieldError>There was an issue with the authentication</FieldError>
        ) : null}
      </form>
    </div>
  );
}
