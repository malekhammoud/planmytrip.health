/**
 * Test-only stand-in for @clerk/nextjs/server.
 *
 * Route-handler tests import the handlers directly, outside Next's server boundary.
 * The real Clerk module imports `server-only`, which throws in Vitest. This stub keeps
 * route logic testable and gives every request a stable test account.
 */

/** Test account used by authenticated route-handler tests. */
export const TEST_USER_ID = "test-user";

/** Returns the test account for every request, with all paid features enabled. */
export async function auth(): Promise<{
  userId: string;
  isAuthenticated: true;
  has: (params: { plan?: string; feature?: string }) => boolean;
}> {
  return {
    userId: TEST_USER_ID,
    isAuthenticated: true,
    has: () => true,
  };
}

/** Minimal middleware stand-in; proxy behavior is covered by Next's build. */
export function clerkMiddleware(): () => undefined {
  return () => undefined;
}

/** Minimal backend client stand-in for account-deletion route tests. */
export async function clerkClient(): Promise<{
  users: { deleteUser: (userId: string) => Promise<{ id: string }> };
}> {
  return {
    users: {
      deleteUser: async (userId: string) => ({ id: userId }),
    },
  };
}
