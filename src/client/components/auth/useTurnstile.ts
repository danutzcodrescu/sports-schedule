import { isTurnstileConfigured } from "#/components/auth/TurnstileField.tsx";
import { useRef } from "react";

import type { TurnstileFieldHandle } from "#/components/auth/TurnstileField.tsx";

export function useTurnstile() {
  const fieldRef = useRef<TurnstileFieldHandle>(null);

  async function withTurnstile<Result>(
    request: (fetchOptions: { headers: { "x-captcha-response": string } }) => Promise<Result>,
  ) {
    const response = fieldRef.current?.getResponse();
    if (!response) {
      return null;
    }

    try {
      return await request({ headers: { "x-captcha-response": response } });
    } finally {
      fieldRef.current?.reset();
    }
  }

  return {
    fieldRef,
    isConfigured: isTurnstileConfigured,
    withTurnstile,
  };
}
