/**
 * Same-origin return-path helpers.
 *
 * Inputs: untrusted search-param values and known internal route paths.
 * Outputs: validated relative paths and sign-in URLs that carry them.
 * Invariants: a return path never leaves the current origin; absolute URLs,
 * protocol-relative URLs, backslash tricks, and control characters are rejected.
 */

const MAX_RETURN_PATH_LENGTH = 2048;

/** True when `value` is a same-origin absolute path safe to use after auth. */
export function isSafeReturnPath(value: string): boolean {
  if (value.length === 0 || value.length > MAX_RETURN_PATH_LENGTH) return false;
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

/** Returns `value` when it is a safe return path, otherwise `null`. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  return isSafeReturnPath(value) ? value : null;
}

/** Builds a sign-in URL with a validated `redirect_url`; unsafe paths are dropped. */
export function signInHref(returnPath?: string | null): string {
  const safePath = safeReturnPath(returnPath);
  if (safePath === null) return "/sign-in";
  return `/sign-in?redirect_url=${encodeURIComponent(safePath)}`;
}
