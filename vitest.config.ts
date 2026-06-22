import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the `@/...` path alias (tsconfig `paths`) to the project root, the
// same way Next does — but only for specifiers that start with `@/`, so scoped
// npm packages like `@ai-sdk/gateway` are left untouched.
const root = fileURLToPath(new URL(".", import.meta.url)).replace(/\\/g, "/").replace(/\/$/, "");

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
