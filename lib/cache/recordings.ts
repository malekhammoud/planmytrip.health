/**
 * Local archive for TinyFish run recordings.
 *
 * Inputs: a presigned video URL, a generated recording id, and the configured recording
 * directory.
 * Outputs: a WebM recording on disk and an authenticated same-origin path.
 * Invariants: ids are UUIDs; writes use a partial file and an atomic rename; a download
 * larger than the cap is discarded; no API key or presigned URL is logged.
 */

import { createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

// VERIFY: TinyFish run recordings are WebM today. Confirm the codec, typical size,
// provider retention, and that local archival is permitted before a production launch.
const MAX_BYTES = 250 * 1024 * 1024;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Directory that survives a Next build in production. */
export function recordingDirectory(): string {
  const configured = process.env.PLANMYTRIP_RECORDINGS_DIR?.trim();
  if (configured !== undefined && configured.length > 0) return configured;
  if (process.env.NODE_ENV === "production" && process.env.HOME) {
    return path.join(process.env.HOME, "recordings");
  }
  return path.join(process.cwd(), ".next", "cache", "recordings");
}

/** A fresh recording id. */
export function newRecordingId(): string {
  return randomUUID();
}

/** The authenticated URL the browser uses. */
export function recordingApiPath(id: string): string {
  return `/api/recordings/${id}`;
}

/** Resolves a recording id to an existing file, or null for a bad id or missing file. */
export async function recordingFile(id: string): Promise<string | null> {
  if (!ID_PATTERN.test(id)) return null;
  const file = path.join(recordingDirectory(), `${id}.webm`);
  try {
    const info = await stat(file);
    return info.isFile() && info.size > 0 ? file : null;
  } catch {
    return null;
  }
}

/** Downloads one recording and returns its authenticated path, or null on failure. */
export async function archiveRecording(
  videoUrl: string,
  id: string,
): Promise<string | null> {
  if (!ID_PATTERN.test(id)) return null;
  const directory = recordingDirectory();
  const finalFile = path.join(directory, `${id}.webm`);
  const partial = `${finalFile}.part`;
  try {
    const response = await fetch(videoUrl, {
      signal: AbortSignal.timeout(120_000),
      cache: "no-store",
    });
    if (!response.ok || response.body === null) return null;
    const length = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > MAX_BYTES) return null;
    await mkdir(directory, { recursive: true });
    let written = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        written += chunk.length;
        if (written > MAX_BYTES) {
          callback(new Error("Recording exceeds the archive limit."));
          return;
        }
        callback(null, chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(response.body as never),
      limit,
      createWriteStream(partial),
    );
    if (written === 0) {
      await unlink(partial).catch(() => {});
      return null;
    }
    await rename(partial, finalFile);
    return recordingApiPath(id);
  } catch {
    await unlink(partial).catch(() => {});
    return null;
  }
}
