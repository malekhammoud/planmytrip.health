/**
 * Local health probe for the OpenCode Self worker.
 *
 * Requires the shared ops health token; never exposes secret values or the trip data.
 */

import { constants } from "node:fs";
import { access, mkdir, readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RELEASE_FILE = "/opt/planmytrip.health/.deploy-sha";

async function writable(path: string): Promise<boolean> {
  try {
    await mkdir(path, { recursive: true });
    await access(path, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function database(): Promise<boolean> {
  try {
    await Promise.race([
      getPool().query("SELECT 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2_500)),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.OPS_HEALTH_TOKEN;
  if (expected !== undefined && expected.length > 0) {
    if (request.headers.get("x-ops-token") !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
  const recordingsDir =
    process.env.PLANMYTRIP_RECORDINGS_DIR ??
    (process.env.HOME ? `${process.env.HOME}/recordings` : ".next/cache/recordings");
  const [db, recordings] = await Promise.all([database(), writable(recordingsDir)]);
  let release = process.env.DEPLOY_SHA ?? "";
  if (release.length === 0) {
    release = (await readFile(RELEASE_FILE, "utf8").catch(() => "")).trim().slice(0, 80);
  }
  const checks = {
    database: db,
    recordingsDir: recordings,
    tinyfishConfigured: (process.env.TINYFISH_API_KEY ?? "").length > 0,
    clerkConfigured: (process.env.CLERK_SECRET_KEY ?? "").length > 0,
    opencodeConfigured: (process.env.OPENCODE_API_KEY ?? "").length > 0 || (process.env.OPENCODE_SERVER_URL ?? "").length > 0,
    cacheEnabled: process.env.PLANMYTRIP_CACHE !== "0",
  };
  const ok = db && recordings && checks.tinyfishConfigured && checks.clerkConfigured && checks.opencodeConfigured;
  return NextResponse.json(
    {
      ok,
      app: "planmytrip",
      release,
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage().rss,
      checks,
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
