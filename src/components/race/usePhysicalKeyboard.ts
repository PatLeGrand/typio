"use client";

import { useSyncExternalStore } from "react";

const KEYBOARD_QUERY = "(min-width: 768px) and (pointer: fine)";
function subscribeKeyboard(listener: () => void) {
  const query = window.matchMedia(KEYBOARD_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const keyboardSnapshot = () => window.matchMedia(KEYBOARD_QUERY).matches;
const serverKeyboardSnapshot = () => false;

export function usePhysicalKeyboard() {
  return useSyncExternalStore(subscribeKeyboard, keyboardSnapshot, serverKeyboardSnapshot);
}
