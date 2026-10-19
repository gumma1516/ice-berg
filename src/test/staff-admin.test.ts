import { describe, expect, it } from "vitest";

import { STAFF_ROLES } from "@/lib/admin-auth";
import { isValidRole, passwordProblem } from "@/lib/staff-admin";

describe("passwordProblem", () => {
  it("accepts a password with enough length, a letter and a digit", () => {
    expect(passwordProblem("iceage2026")).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(passwordProblem("ice2")).toContain("8 characters");
  });

  it("rejects passwords without a digit or without a letter", () => {
    expect(passwordProblem("icecreamery")).toContain("letter and one number");
    expect(passwordProblem("12345678")).toContain("letter and one number");
  });
});

describe("isValidRole", () => {
  it("accepts every supported role", () => {
    for (const role of STAFF_ROLES) expect(isValidRole(role)).toBe(true);
  });

  it("rejects anything else, including attempts to invent a role", () => {
    expect(isValidRole("owner")).toBe(false);
    expect(isValidRole("superadmin")).toBe(false);
    expect(isValidRole("")).toBe(false);
  });
});
