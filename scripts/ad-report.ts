/**
 * Prints aggregate house-ad clicks.
 *
 * Inputs: PLANMYTRIP_ADS_DIR (default /var/lib/planmytrip/ads), containing monthly JSONL.
 * Outputs: a count per destination, placement, intent, layout, and CTA target.
 * Invariants: reads only the bounded click fields; never prints a raw file path with
 * credentials, an IP address, or account data because none are stored.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

interface ClickRow {
  destination?: unknown;
  placement?: unknown;
  intent?: unknown;
  variant?: unknown;
  target?: unknown;
}

function value(row: ClickRow, key: keyof ClickRow): string {
  const raw = row[key];
  return typeof raw === "string" && raw.length > 0 ? raw : "unknown";
}

async function main(): Promise<void> {
  const directory =
    process.env.PLANMYTRIP_ADS_DIR?.trim() || "/var/lib/planmytrip/ads";
  let files: string[];
  try {
    files = (await readdir(directory))
      .filter((file) => file.endsWith(".jsonl"))
      .sort();
  } catch {
    console.log(`No ad clicks recorded at ${directory}`);
    return;
  }
  if (files.length === 0) {
    console.log(`No ad clicks recorded at ${directory}`);
    return;
  }

  const counts = new Map<string, number>();
  let total = 0;
  for (const file of files) {
    const text = await readFile(path.join(directory, file), "utf8");
    for (const line of text.split("\n")) {
      if (line.trim().length === 0) continue;
      try {
        const row = JSON.parse(line) as ClickRow;
        const key = [
          value(row, "destination"),
          value(row, "placement"),
          value(row, "intent"),
          value(row, "variant"),
          value(row, "target"),
        ].join("\t");
        counts.set(key, (counts.get(key) ?? 0) + 1);
        total += 1;
      } catch {
        // A partial trailing line from a stopped writer is ignored.
      }
    }
  }

  const rows = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  console.log(`Ad clicks: ${total} total`);
  console.log("destination\tplacement\tintent\tlayout\ttarget\tclicks");
  for (const [key, count] of rows) {
    console.log(`${key}\t${count}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
