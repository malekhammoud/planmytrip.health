/**
 * Aggregate click intake for PlanMyTrip.health house advertisements.
 *
 * Inputs: a bounded same-origin beacon with a destination, placement, campaign intent,
 * layout, and CTA target.
 * Outputs: 204 and one JSONL row per accepted click.
 * Invariants: no account id, IP address, health field, or free text is written. The IP is
 * used only for an in-memory rate limit. A failed write is fail-open because advertising
 * measurement must never interrupt a navigation.
 */

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { parseAdClick } from "@/lib/ads/clickEvent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const MAX_BODY = 2_000;
const buckets = new Map<string, number[]>();

function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf !== null && cf.length > 0) return cf.slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null && forwarded.length > 0) {
    return forwarded.split(",")[0].trim().slice(0, 64);
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (buckets.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    buckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  buckets.set(ip, recent);
  if (buckets.size > 10_000) buckets.clear();
  return false;
}

function sameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function adsDir(): string {
  const configured = process.env.PLANMYTRIP_ADS_DIR?.trim();
  return configured !== undefined && configured.length > 0
    ? configured
    : "/var/lib/planmytrip/ads";
}

/** Records one aggregate ad click. */
export async function POST(request: Request): Promise<Response> {
  const noStore = { "Cache-Control": "no-store" };
  if (!sameOrigin(request)) {
    return new NextResponse(null, { status: 403, headers: noStore });
  }
  if (rateLimited(clientIp(request))) {
    return new NextResponse(null, { status: 429, headers: noStore });
  }

  let parsed: unknown;
  try {
    const text = await request.text();
    if (text.length === 0 || text.length > MAX_BODY) {
      return new NextResponse(null, { status: 400, headers: noStore });
    }
    parsed = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400, headers: noStore });
  }

  const event = parseAdClick(parsed);
  if (event === null) {
    return new NextResponse(null, { status: 400, headers: noStore });
  }

  try {
    const now = new Date();
    const directory = adsDir();
    await mkdir(directory, { recursive: true });
    await appendFile(
      path.join(directory, `${now.toISOString().slice(0, 7)}.jsonl`),
      `${JSON.stringify({ ts: now.toISOString(), ...event })}\n`,
      "utf8",
    );
  } catch {
    // The click already happened. Measurement is best-effort and never blocks it.
  }
  return new NextResponse(null, { status: 204, headers: noStore });
}
