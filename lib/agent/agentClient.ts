/**
 * Node-side OpenCode client discovery.
 *
 * Inputs: optional OPENCODE_SERVER_URL, OPENCODE_SERVER_USERNAME, and
 * OPENCODE_SERVER_PASSWORD environment values.
 * Outputs: one memoised @opencode/client instance.
 * Invariants: no secret is logged; an explicit server URL is used only when provided;
 * otherwise the local OpenCode service is discovered or started once per process.
 */

import { OpenCode } from "@opencode/client";
import type { OpenCodeClient } from "@opencode/client";

let clientPromise: Promise<OpenCodeClient> | null = null;

function basicHeaders(): Record<string, string> | undefined {
  const password = process.env.OPENCODE_SERVER_PASSWORD;
  if (password === undefined || password === "") return undefined;
  const username = process.env.OPENCODE_SERVER_USERNAME?.trim() || "opencode";
  const encoded = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  return { authorization: `Basic ${encoded}` };
}

async function createClient(): Promise<OpenCodeClient> {
  const explicitUrl = process.env.OPENCODE_SERVER_URL?.trim();
  if (explicitUrl !== undefined && explicitUrl !== "") {
    return OpenCode.make({
      baseUrl: explicitUrl,
      headers: basicHeaders(),
    });
  }
  const { Service } = await import("@opencode/client/service");
  const endpoint = await Service.ensure();
  return OpenCode.make({
    baseUrl: endpoint.url,
    headers: Service.headers(endpoint),
  });
}

/**
 * Returns the shared OpenCode client. A failed discovery is not cached, so a later
 * request can retry after the local service starts.
 */
export function getOpenCodeClient(): Promise<OpenCodeClient> {
  if (clientPromise === null) {
    clientPromise = createClient().catch((error: unknown) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}
