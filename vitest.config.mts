import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");

export default defineConfig({
  resolve: {
    alias: {
      "@": projectRoot,
      // Route-handler tests import Next handlers outside the server boundary. The real
      // Clerk module imports server-only, so tests use a stable account stub instead.
      "@clerk/nextjs/server": fileURLToPath(
        new URL("./tests/mocks/clerk-server.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Database tests share one Postgres schema and truncate it between cases.
    fileParallelism: false,
  },
});
