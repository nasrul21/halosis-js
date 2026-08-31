import { describe, expect, it } from "vitest";

describe("browser entry", () => {
  it("rejects direct browser usage with deployment guidance", async () => {
    await expect(import("../src/browser-error.js")).rejects.toThrow(
      "The halosis SDK only supports server-side Node.js",
    );
  });
});
