import { useSyncExternalStore } from "react";

const defaultCookieName = "nekomaid_r18_confirmed";
const confirmedEventName = "faryne:age-confirmed";
const maxAge = 60 * 60 * 24 * 180;

function hasConfirmedCookie(cookieName = defaultCookieName) {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === `${cookieName}=1`);
}

function subscribeAgeConfirmation(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(confirmedEventName, callback);
  return () => window.removeEventListener(confirmedEventName, callback);
}

export function setAgeConfirmed(cookieName = defaultCookieName) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${cookieName}=1; max-age=${maxAge}; path=/; SameSite=Lax`;
  window.dispatchEvent(new Event(confirmedEventName));
}

export function useAgeConfirmed(cookieName = defaultCookieName) {
  return useSyncExternalStore(
    subscribeAgeConfirmation,
    () => hasConfirmedCookie(cookieName),
    () => false,
  );
}
