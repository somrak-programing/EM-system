import { describe, expect, it } from "vitest";
import { formatImpact } from "./format";

describe("formatImpact", () => {
  it("joins selected QES flags", () => {
    expect(
      formatImpact({
        quality: true,
        environment: false,
        safety: true,
        impactOther: null,
      }),
    ).toBe("Quality, Safety");
  });

  it("appends a typed other impact when no matching option exists", () => {
    expect(
      formatImpact({
        quality: false,
        environment: false,
        safety: false,
        impactOther: "  สายการผลิตหยุด  ",
      }),
    ).toBe("สายการผลิตหยุด");
  });

  it("shows dash when nothing was selected or typed", () => {
    expect(
      formatImpact({
        quality: false,
        environment: false,
        safety: false,
        impactOther: "   ",
      }),
    ).toBe("—");
  });
});
