import { useSyncExternalStore } from "react";

const SCROLLED_PAST = 8;

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

export function useScrolled() {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > SCROLLED_PAST,
    () => false
  );
}
