import { useEffect, useState } from "react";

const KEY = "lifeos_lite_mode";

export function isLiteMode(): boolean {
  return localStorage.getItem(KEY) === "true";
}

export function setLiteMode(value: boolean) {
  localStorage.setItem(KEY, value ? "true" : "false");
  document.body.classList.toggle("lite-mode", value);
  window.dispatchEvent(new CustomEvent("lite-mode-change", { detail: value }));
}

// Apply on initial load, before React even mounts anything that cares.
document.body.classList.toggle("lite-mode", isLiteMode());

export function useLiteMode(): boolean {
  const [value, setValue] = useState(isLiteMode());
  useEffect(() => {
    function onChange(e: Event) { setValue((e as CustomEvent).detail as boolean); }
    window.addEventListener("lite-mode-change", onChange);
    return () => window.removeEventListener("lite-mode-change", onChange);
  }, []);
  return value;
}
