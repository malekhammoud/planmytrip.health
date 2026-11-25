import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ads/click/route";

const directories: string[] = [];

async function tempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "planmytrip-ads-"));
  directories.push(directory);
  return directory;
}

function request(
  body: unknown,
  options: { origin?: string; ip?: string } = {},
): Request {
  return new Request("http://localhost/api/ads/click", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "sec-fetch-site": "same-origin",
      origin: options.origin ?? "http://localhost",
      host: "localhost",
      "x-real-ip": options.ip ?? "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

const valid = {
  destination: "Paris, France",
  placement: "landing",
  intent: "plan",
  variant: "poster",
  target: "plan",
};

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("POST /api/ads/click", () => {
  it("records one aggregate click and stores no identifier", async () => {
    const directory = await tempDir();
    vi.stubEnv("PLANMYTRIP_ADS_DIR", directory);
    const response = await POST(request(valid));
    expect(response.status).toBe(204);
    const month = new Date().toISOString().slice(0, 7);
    const contents = await readFile(path.join(directory, `${month}.jsonl`), "utf8");
    const row = JSON.parse(contents.trim()) as Record<string, unknown>;
    expect(row.destination).toBe("Paris, France");
    expect(row.placement).toBe("landing");
    expect(row.target).toBe("plan");
    expect(row).not.toHaveProperty("ip");
    expect(row).not.toHaveProperty("userId");
  });

  it("rejects a cross-origin beacon", async () => {
    const directory = await tempDir();
    vi.stubEnv("PLANMYTRIP_ADS_DIR", directory);
    const response = await POST(
      request(valid, { origin: "https://example.test", ip: "203.0.113.11" }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects a malformed click without writing", async () => {
    const directory = await tempDir();
    vi.stubEnv("PLANMYTRIP_ADS_DIR", directory);
    const response = await POST(
      request({ ...valid, target: "checkout" }, { ip: "203.0.113.12" }),
    );
    expect(response.status).toBe(400);
  });
});
