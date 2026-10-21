import { useTurnstile } from "./useTurnstile";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

import type { CaptchaFetchOptions } from "./useTurnstile";
import type { SubmitEvent } from "react";

type AuthRequest = (
  form: FormData,
  fetchOptions: CaptchaFetchOptions,
) => Promise<{ error?: unknown }>;

export function useAuthForm(request: AuthRequest, validate?: (form: FormData) => boolean) {
  const navigate = useNavigate();
  const turnstile = useTurnstile();
  const inFlight = useRef(false);
  const [isInFlight, setInFlight] = useState(false);
  const [shouldDisplayError, setDisplayError] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setDisplayError(false);
    const form = new FormData(event.currentTarget);
    if (validate && !validate(form)) return;

    inFlight.current = true;
    setInFlight(true);
    try {
      const response = await turnstile.withTurnstile((options) => request(form, options));
      if (!response) return;
      if (response.error) {
        setDisplayError(true);
        return;
      }
      await navigate({ to: "/" });
    } catch {
      setDisplayError(true);
    } finally {
      inFlight.current = false;
      setInFlight(false);
    }
  }

  return {
    onSubmit,
    isInFlight,
    shouldDisplayError,
    turnstileRef: turnstile.fieldRef,
    isTurnstileConfigured: turnstile.isConfigured,
  };
}
