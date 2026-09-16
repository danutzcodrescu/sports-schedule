import { FieldError } from "#/components/ui/Field.tsx";
import { Turnstile } from "@marsidev/react-turnstile";
import { useImperativeHandle, useRef, useState } from "react";

import type { TurnstileInstance } from "@marsidev/react-turnstile";
import type { Ref } from "react";

type TurnstileFieldProps = {
  ref: Ref<TurnstileFieldHandle>;
};

export type TurnstileFieldHandle = {
  getResponse: () => string | undefined;
  reset: () => void;
};

const DEVELOPMENT_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
const siteKey =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ||
  (import.meta.env.DEV ? DEVELOPMENT_TURNSTILE_SITE_KEY : "");

export const isTurnstileConfigured = Boolean(siteKey);

export function TurnstileField({ ref }: TurnstileFieldProps) {
  const widgetRef = useRef<TurnstileInstance>(null);
  const [shouldDisplayError, setErrorStatus] = useState(false);

  useImperativeHandle(ref, () => ({
    getResponse() {
      const response = widgetRef.current?.getResponse();
      setErrorStatus(!response);
      return response;
    },
    reset() {
      widgetRef.current?.reset();
      setErrorStatus(false);
    },
  }));

  if (!isTurnstileConfigured) {
    return <FieldError>Human verification is not configured.</FieldError>;
  }

  return (
    <>
      <Turnstile
        ref={widgetRef}
        siteKey={siteKey}
        options={{ size: "flexible", theme: "auto" }}
        onSuccess={() => setErrorStatus(false)}
        onError={() => setErrorStatus(true)}
      />
      {shouldDisplayError ? <FieldError>Please complete the human verification.</FieldError> : null}
    </>
  );
}
