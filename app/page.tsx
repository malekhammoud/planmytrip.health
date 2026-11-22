import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PlannerHome } from "@/components/PlannerHome";

export const dynamic = "force-dynamic";

/**
 * The planner is account-only. The relative redirect keeps the public host and port
 * intact behind the reverse proxy; auth.protect() would build an absolute URL from the
 * internal loopback request.
 */
export default async function Home() {
  const { userId } = await auth();
  if (userId === null) redirect("/sign-in");
  return <PlannerHome />;
}
