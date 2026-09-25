import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  isTransitionAllowed,
  nextClosedAt,
  slugCode,
  type TransitionRule,
} from "./workflow";

const claim: TransitionRule = {
  id: "1",
  actionCode: "CLAIM",
  actionLabel: "รับงาน",
  formKind: "NONE",
  assignOnTake: true,
  actorScope: "ANY",
  fromCode: "QUEUED",
  toCode: "IN_PROGRESS",
  toIsTerminal: false,
  roleCodes: ["EM_TECHNICIAN"],
};

const accept: TransitionRule = {
  id: "2",
  actionCode: "ACCEPT",
  actionLabel: "ยอมรับ",
  formKind: "NONE",
  assignOnTake: false,
  actorScope: "REQUESTER",
  fromCode: "PENDING_ACCEPTANCE",
  toCode: "ACCEPTED",
  toIsTerminal: true,
  roleCodes: ["REQUESTER"],
};

describe("isTransitionAllowed", () => {
  it("lets an EM technician claim from the role list", () => {
    expect(
      isTransitionAllowed(claim, {
        role: "EM_TECHNICIAN",
        isRequester: false,
        isAssignee: false,
      }),
    ).toBe(true);
  });

  it("blocks an IT technician from an EM-only claim", () => {
    expect(
      isTransitionAllowed(claim, {
        role: "IT_TECHNICIAN",
        isRequester: false,
        isAssignee: false,
      }),
    ).toBe(false);
  });

  it("lets admin take any configured transition", () => {
    expect(
      isTransitionAllowed(claim, {
        role: "ADMIN",
        isRequester: false,
        isAssignee: false,
      }),
    ).toBe(true);
  });

  it("requires the ticket owner for requester-scoped accept", () => {
    expect(
      isTransitionAllowed(accept, {
        role: "REQUESTER",
        isRequester: true,
        isAssignee: false,
      }),
    ).toBe(true);
    expect(
      isTransitionAllowed(accept, {
        role: "REQUESTER",
        isRequester: false,
        isAssignee: false,
      }),
    ).toBe(false);
  });
});

describe("allowedTransitions", () => {
  it("returns claim from queued for EM staff", () => {
    const result = allowedTransitions([claim, accept], "QUEUED", {
      role: "EM_TECHNICIAN",
      isRequester: false,
      isAssignee: false,
    });
    expect(result.map((row) => row.actionCode)).toEqual(["CLAIM"]);
  });
});

describe("nextClosedAt", () => {
  const current = new Date("2026-09-24T10:00:00.000Z");
  const now = new Date("2026-09-25T08:00:00.000Z");

  it("stamps now when the transition completes the work", () => {
    expect(nextClosedAt("COMPLETE", current, now)).toEqual(now);
    expect(nextClosedAt("COMPLETE", null, now)).toEqual(now);
  });

  it("clears the completion timestamp when the work is rejected", () => {
    expect(nextClosedAt("REJECT", current, now)).toBeNull();
    expect(nextClosedAt("REJECT", null, now)).toBeNull();
  });

  it("keeps the current completion timestamp for plain transitions", () => {
    expect(nextClosedAt("NONE", current, now)).toBe(current);
    expect(nextClosedAt("NONE", null, now)).toBeNull();
  });
});

describe("slugCode", () => {
  it("normalizes Thai-adjacent codes to uppercase tokens", () => {
    expect(slugCode(" wait-for gm ")).toBe("WAIT_FOR_GM");
  });
});
