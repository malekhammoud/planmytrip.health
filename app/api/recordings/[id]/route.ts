/**
 * GET /api/recordings/[id]: streams one archived TinyFish run recording.
 *
 * Inputs: an authenticated Clerk session and a UUID recording id.
 * Outputs: an inline WebM response, or a JSON 401/400/404.
 * Invariants: only an authenticated user can read a recording; the id must be a UUID and
 * must resolve to a file inside the configured recording directory; no directory path is
 * reflected to the client.
 */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { auth } from "@clerk/nextjs/server";
import { recordingFile } from "@/lib/cache/recordings";

export const runtime = "nodejs";

function json(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Streams one archived recording to a signed-in user. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await auth();
  if (userId === null) return json(401, "Sign in to watch a recorded run.");
  const { id } = await context.params;
  const file = await recordingFile(id);
  if (file === null) return json(404, "That recording was not found.");
  const info = await stat(file);
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "video/webm",
      "Content-Length": String(info.size),
      "Content-Disposition": `inline; filename="run-${id}.webm"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
