import type { RoleCode } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  OPS_ROLES,
  canManageTicketSchedule,
  isOpsRole,
  opsSectionWhere,
} from "./ops-access";

const ALL_ROLES: RoleCode[] = [
  "REQUESTER",
  "SECTION_MANAGER",
  "GM",
  "EM_MANAGER",
  "EM_TECHNICIAN",
  "IT_MANAGER",
  "IT_TECHNICIAN",
  "ADMIN",
];

const PLANT_WIDE_OPS: RoleCode[] = [
  "EM_MANAGER",
  "IT_MANAGER",
  "GM",
  "ADMIN",
];

const NON_OPS: RoleCode[] = ["REQUESTER", "EM_TECHNICIAN", "IT_TECHNICIAN"];

describe("OPS_ROLES and isOpsRole", () => {
  it("lists exactly the five ops roles", () => {
    expect([...OPS_ROLES].sort()).toEqual(
      [
        "SECTION_MANAGER",
        "EM_MANAGER",
        "IT_MANAGER",
        "GM",
        "ADMIN",
      ].sort(),
    );
  });

  it("classifies all eight roles", () => {
    for (const role of NON_OPS) {
      expect(isOpsRole(role)).toBe(false);
    }
    for (const role of OPS_ROLES) {
      expect(isOpsRole(role)).toBe(true);
    }
    expect(ALL_ROLES).toHaveLength(8);
  });
});

describe("canManageTicketSchedule", () => {
  const sectionA = "sec-a";
  const sectionB = "sec-b";

  describe("non-ops roles", () => {
    it.each(NON_OPS)("denies %s regardless of section", (role) => {
      expect(
        canManageTicketSchedule(
          { role, sectionId: null },
          { sectionId: sectionA },
        ),
      ).toBe(false);
      expect(
        canManageTicketSchedule(
          { role, sectionId: sectionA },
          { sectionId: sectionA },
        ),
      ).toBe(false);
      expect(
        canManageTicketSchedule({ role, sectionId: null }, { sectionId: null }),
      ).toBe(false);
    });
  });

  describe("SECTION_MANAGER", () => {
    it("allows same non-null section", () => {
      expect(
        canManageTicketSchedule(
          { role: "SECTION_MANAGER", sectionId: sectionA },
          { sectionId: sectionA },
        ),
      ).toBe(true);
    });

    it("denies other section", () => {
      expect(
        canManageTicketSchedule(
          { role: "SECTION_MANAGER", sectionId: sectionA },
          { sectionId: sectionB },
        ),
      ).toBe(false);
    });

    it("denies when actor section is null", () => {
      expect(
        canManageTicketSchedule(
          { role: "SECTION_MANAGER", sectionId: null },
          { sectionId: sectionA },
        ),
      ).toBe(false);
      expect(
        canManageTicketSchedule(
          { role: "SECTION_MANAGER", sectionId: null },
          { sectionId: null },
        ),
      ).toBe(false);
    });

    it("denies ticket with null section even when actor has a section", () => {
      expect(
        canManageTicketSchedule(
          { role: "SECTION_MANAGER", sectionId: sectionA },
          { sectionId: null },
        ),
      ).toBe(false);
    });
  });

  describe("plant-wide ops roles", () => {
    it.each(PLANT_WIDE_OPS)(
      "allows %s for any section including null",
      (role) => {
        expect(
          canManageTicketSchedule(
            { role, sectionId: null },
            { sectionId: sectionA },
          ),
        ).toBe(true);
        expect(
          canManageTicketSchedule(
            { role, sectionId: sectionA },
            { sectionId: sectionB },
          ),
        ).toBe(true);
        expect(
          canManageTicketSchedule({ role, sectionId: null }, { sectionId: null }),
        ).toBe(true);
      },
    );
  });
});

describe("opsSectionWhere", () => {
  it("returns section filter for section manager with a section", () => {
    expect(
      opsSectionWhere({ role: "SECTION_MANAGER", sectionId: "sec-a" }),
    ).toEqual({ sectionId: "sec-a" });
  });

  it("returns undefined for section manager with null section", () => {
    expect(
      opsSectionWhere({ role: "SECTION_MANAGER", sectionId: null }),
    ).toBeUndefined();
  });

  it.each(PLANT_WIDE_OPS)("returns undefined for plant-wide role %s", (role) => {
    expect(opsSectionWhere({ role, sectionId: null })).toBeUndefined();
    expect(opsSectionWhere({ role, sectionId: "sec-a" })).toBeUndefined();
  });

  it.each(NON_OPS)("returns undefined for non-ops role %s", (role) => {
    expect(opsSectionWhere({ role, sectionId: "sec-a" })).toBeUndefined();
    expect(opsSectionWhere({ role, sectionId: null })).toBeUndefined();
  });
});
