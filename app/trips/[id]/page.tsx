import { notFound, redirect } from "next/navigation";
import { SavedTripView } from "@/components/SavedTripView";
import { readBilling } from "@/lib/billing/server";
import { getSavedTrip } from "@/lib/db/savedTrips";
import { parseSavedTripId } from "@/lib/savedTrips";

export const dynamic = "force-dynamic";

/** One owned saved trip. The id is validated before it reaches the database. */
export default async function SavedTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId, entitlements } = await readBilling();
  if (userId === null) redirect("/sign-in");
  const id = parseSavedTripId((await params).id);
  if (id === null) notFound();
  const trip = await getSavedTrip(userId, id);
  if (trip === null) notFound();
  return <SavedTripView saved={trip} entitlements={entitlements} />;
}
