import { focusManager, QueryClient } from "@tanstack/react-query";

// Include actual window focus: React Query's default only checks tab visibility.
focusManager.setEventListener((handleFocus) => {
  const updateFocus = () => {
    handleFocus(document.visibilityState === "visible" && document.hasFocus());
  };

  updateFocus();
  window.addEventListener("focus", updateFocus);
  window.addEventListener("blur", updateFocus);
  document.addEventListener("visibilitychange", updateFocus);

  return () => {
    window.removeEventListener("focus", updateFocus);
    window.removeEventListener("blur", updateFocus);
    document.removeEventListener("visibilitychange", updateFocus);
  };
});

export const queryClient = new QueryClient();
