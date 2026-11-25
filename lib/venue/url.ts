/**
 * Public-URL gate for venue research.
 *
 * Inputs: an untrusted URL string from a plan or provider result.
 * Outputs: the original URL only when it is absolute http(s) and its host is public.
 * Invariants: loopback, private, link-local, unique-local, multicast, reserved, and
 * single-label hosts are rejected before a browser job can open them. The check is
 * syntactic: it never performs DNS resolution and never fetches the URL here.
 */

import { asHttpUrl } from "@/lib/agent/agentParse";

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

function isPublicIpv4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  // 224/4 multicast, 240/4 reserved, and the broadcast address.
  return a < 224;
}

function isPublicIpv6(host: string): boolean {
  const bare = host.split("%")[0] ?? "";
  const first = bare.split(":")[0] ?? "";
  if (first.length === 0) return false; // ::, ::1, and IPv4-mapped forms.
  const value = Number.parseInt(first, 16);
  if (!Number.isFinite(value)) return false;
  // Global unicast is 2000::/3. Loopback, link-local, unique-local, multicast, and
  // documentation/translation prefixes fall outside this range.
  return value >= 0x2000 && value <= 0x3fff;
}

function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (host.length === 0) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.endsWith(".local")) return false;
  if (host.includes(":")) return isPublicIpv6(host);
  const ipv4 = parseIpv4(host);
  if (ipv4 !== null) return isPublicIpv4(ipv4);
  // A single-label host such as "intranet" or "router" is not a public venue domain.
  return host.includes(".");
}

/** True only for an absolute http(s) URL whose host is public. */
export function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return isPublicHost(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Bounds and validates an untrusted URL, returning the trimmed original text or null.
 * The original text is preserved so display and cache keys match the plan.
 */
export function asPublicHttpUrl(value: unknown): string | null {
  const text = asHttpUrl(value);
  return text !== null && isPublicHttpUrl(text) ? text : null;
}
