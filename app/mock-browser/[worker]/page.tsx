import { notFound } from "next/navigation";
import { MockBrowser } from "./MockBrowser";
import { isWorkerId } from "@/lib/swarmTypes";

/**
 * Dev-only fake browser viewport for the SWARM_MOCK timeline. Production always 404s,
 * so this route can never be reached on the deployed app.
 */
export default async function MockBrowserPage({
  params,
}: {
  params: Promise<{ worker: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { worker } = await params;
  if (!isWorkerId(worker)) notFound();
  return <MockBrowser worker={worker} />;
}
