import { useAuthForm } from "./useAuthForm";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useImperativeHandle } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { navigate, captcha } = vi.hoisted(() => ({
  navigate: vi.fn(),
  captcha: { getResponse: vi.fn(), reset: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

beforeEach(() => {
  navigate.mockReset();
  captcha.getResponse.mockReset().mockReturnValue("captcha-token");
  captcha.reset.mockReset();
});
afterEach(cleanup);

function AuthForm({
  request,
  validate,
}: {
  request: Parameters<typeof useAuthForm>[0];
  validate?: (form: FormData) => boolean;
}) {
  const auth = useAuthForm(request, validate);
  useImperativeHandle(auth.turnstileRef, () => captcha);
  return (
    <form aria-label="Authentication" aria-busy={auth.isInFlight} onSubmit={auth.onSubmit}>
      <input name="email" defaultValue="fan@example.test" />
      <output data-testid="error">{String(auth.shouldDisplayError)}</output>
    </form>
  );
}

test("successful submissions share CAPTCHA handling, cleanup, and navigation", async () => {
  const request = vi.fn<Parameters<typeof useAuthForm>[0]>(async () => ({}));
  render(<AuthForm request={request} />);
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
  expect(request.mock.calls[0]?.[0]?.get("email")).toBe("fan@example.test");
  expect(request).toHaveBeenCalledWith(expect.any(FormData), {
    headers: { "x-captcha-response": "captcha-token" },
  });
  expect(captcha.reset).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("false");
});

test.each(["response error", "thrown error"])(
  "%s restores the form and resets verification without navigation",
  async (failure) => {
    const request = vi.fn(async () => {
      if (failure === "thrown error") throw new Error("Unavailable");
      return { error: { message: "Rejected" } };
    });
    render(<AuthForm request={request} />);
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(screen.getByTestId("error").textContent).toBe("true"));
    expect(navigate).not.toHaveBeenCalled();
    expect(captcha.reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("false");
  },
);

test("a missing CAPTCHA response does not send a request or leave the form busy", async () => {
  captcha.getResponse.mockReturnValue(undefined);
  const request = vi.fn(async () => ({}));
  render(<AuthForm request={request} />);
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("false"));
  expect(request).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});

test("local validation prevents submission without consuming verification", () => {
  const request = vi.fn(async () => ({}));
  render(<AuthForm request={request} validate={() => false} />);
  fireEvent.submit(screen.getByRole("form"));
  expect(request).not.toHaveBeenCalled();
  expect(captcha.getResponse).not.toHaveBeenCalled();
  expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("false");
});

test("duplicate submissions cannot start a second in-flight request", async () => {
  let finish!: (result: { error?: unknown }) => void;
  const pending = new Promise<{ error?: unknown }>((resolve) => {
    finish = resolve;
  });
  const request = vi.fn(() => pending);
  render(<AuthForm request={request} />);
  fireEvent.submit(screen.getByRole("form"));
  fireEvent.submit(screen.getByRole("form"));
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("true");
  await act(async () => {
    finish({});
  });
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("form").getAttribute("aria-busy")).toBe("false");
});
