/**
 * Feedback intake for PlanMyTrip.health.
 *
 * The route keeps a local JSONL fallback and forwards only product feedback to the
 * central OpenCode Self service. Destination, condition, saved trips, and
 * form values are never included.
 */

import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEEDBACK_DIR = process.env.PLANMYTRIP_FEEDBACK_DIR ?? "/var/lib/planmytrip/feedback";
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const buckets = new Map<string, number[]>();

function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf !== null && cf.length > 0) return cf.slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null && forwarded.length > 0) return forwarded.split(",")[0].trim().slice(0, 64);
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

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  if (rateLimited(clientIp(request))) return NextResponse.json({ ok: false, error: "Too many feedback attempts" }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 16_000) return NextResponse.json({ ok: false }, { status: 413 });
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object") return NextResponse.json({ ok: false }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ratingValue = Number(body.rating);
  const rating = Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null;
  const allowed = new Set(["bug", "feature", "ux", "docs", "other"]);
  const requested = typeof body.category === "string" ? body.category.toLowerCase() : "other";
  const category = allowed.has(requested) ? requested : "other";
  const message = (typeof body.message === "string" ? body.message : "").trim().slice(0, 2_000);
  const page = typeof body.page === "string" ? body.page.split("?")[0].slice(0, 180) : "";
  const release = typeof body.release === "string" ? body.release.slice(0, 80) : "";
  if (rating === null && message.length < 3) return NextResponse.json({ ok: false }, { status: 400 });

  const { userId } = await auth();
  const suppliedActor = typeof body.actorId === "string" && body.actorId.length >= 8 ? body.actorId.slice(0, 120) : "";
  const actorType = userId !== null ? "account" : "anonymous";
  const actorId = userId !== null
    ? `acct:${createHash("sha256").update(`planmytrip:${userId}`).digest("hex").slice(0, 24)}`
    : `anon:${suppliedActor || randomUUID()}`;

  try {
    const month = new Date().toISOString().slice(0, 7);
    await mkdir(FEEDBACK_DIR, { recursive: true });
    await appendFile(
      path.join(FEEDBACK_DIR, `${month}.jsonl`),
      JSON.stringify({ ts: new Date().toISOString(), rating, category, message, page }) + "\n",
      "utf8",
    );
  } catch {
    // Local fallback is best-effort; the central copy still goes out.
  }

  const endpoint = process.env.OPS_INGEST_URL ?? "http://127.0.0.1:3100";
  const token = process.env.OPS_INGEST_TOKEN ?? "";
  if (token.length > 0) {
    void fetch(`${endpoint}/api/v1/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-token": token },
      body: JSON.stringify({
        app: "planmytrip",
        category,
        rating,
        message,
        page,
        release,
        actorId,
        actorType,
      }),
      signal: AbortSignal.timeout(2_500),
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
