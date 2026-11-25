import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteAccountData = vi.fn();

vi.mock("@/lib/db/account", () => ({
  deleteAccountData: (...args: unknown[]) => deleteAccountData(...args),
}));

import { POST } from "@/app/api/account/delete/route";

describe("POST /api/account/delete", () => {
  beforeEach(() => {
    deleteAccountData.mockReset();
    deleteAccountData.mockResolvedValue({ savedTrips: 1, usageEvents: 2 });
  });

  it("closes the account after removing account-owned rows", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(deleteAccountData).toHaveBeenCalledWith("test-user");
  });

  it("does not close the Clerk account when the database cleanup fails", async () => {
    deleteAccountData.mockRejectedValue(new Error("database down"));
    const response = await POST();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("could not be removed"),
    });
  });
});
