import { describe, expect, it } from "vitest";

import { Halosis, VERSION } from "../src/index.js";

describe("halosis", () => {
  it("exports the package version", () => {
    expect(VERSION).toBe("0.1.0");
  });

  it("exports the Halosis client", () => {
    expect(new Halosis()).toBeInstanceOf(Halosis);
  });
});
