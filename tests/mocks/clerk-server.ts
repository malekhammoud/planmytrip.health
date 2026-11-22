/**
 * Test-only stand-in for @clerk/nextjs/server.
 *
 * Route-handler tests import the handlers directly, outside Next's server boundary.
 * The real Clerk module imports `server-only`, which throws in Vitest. This stub keeps
 * route logic testable and gives every request a stable test account.
 */

/** Test account used by authenticated route-handler tests. */
export const TEST_USER_ID = "test-user";

/** Returns the test account for every request. */
export async function auth(): Promise<{
  userId: string;
  isAuthenticated: true;
}> {
  return { userId: TEST_USER_ID, isAuthenticated: true };
}

/** Minimal middleware stand-in; proxy behavior is covered by Next's build. */
export function clerkMiddleware(): () => undefined {
  return () => undefined;
}
