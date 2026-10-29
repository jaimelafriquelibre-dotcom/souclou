import { describe, expect, it } from "vitest";
import {
  canInviteSchoolRole,
  hasPermission,
  type OrganizationMembership,
  type SchoolMembership,
  type UserStatus,
} from "./authorization";

const school = {
  organizationId: "org-1",
  schoolId: "school-1",
  organizationStatus: "ACTIVE" as const,
  schoolStatus: "ACTIVE" as const,
};

function memberships(
  userStatus: UserStatus = "ACTIVE",
  organizationMemberships: readonly OrganizationMembership[] = [],
  schoolMemberships: readonly SchoolMembership[] = [],
) {
  return { userStatus, organizationMemberships, schoolMemberships };
}

describe("hasPermission", () => {
  it("allows only founders and studies directors to manage school structure", () => {
    expect(
      hasPermission(
        memberships("ACTIVE", [], [
          {
            organizationId: "org-1",
            schoolId: "school-1",
            role: "STUDIES_DIRECTOR",
            status: "ACTIVE",
          },
        ]),
        "manage_academic_structure",
        school,
      ),
    ).toBe(true);

    expect(
      hasPermission(
        memberships("ACTIVE", [], [
          {
            organizationId: "org-1",
            schoolId: "school-1",
            role: "EDUCATOR",
            status: "ACTIVE",
          },
        ]),
        "manage_academic_structure",
        school,
      ),
    ).toBe(false);
  });

  it("limits student records to studies directors and administrative staff", () => {
    for (const role of ["STUDIES_DIRECTOR", "ADMINISTRATIVE_STAFF"] as const) {
      expect(
        hasPermission(
          memberships("ACTIVE", [], [
            {
              organizationId: "org-1",
              schoolId: "school-1",
              role,
              status: "ACTIVE",
            },
          ]),
          "manage_student_records",
          school,
        ),
      ).toBe(true);
    }

    expect(
      hasPermission(
        memberships("ACTIVE", [], [
          {
            organizationId: "org-1",
            schoolId: "school-1",
            role: "TEACHER",
            status: "ACTIVE",
          },
        ]),
        "manage_student_records",
        school,
      ),
    ).toBe(false);
  });

  it("allows only educators and studies directors to record attendance", () => {
    for (const role of ["STUDIES_DIRECTOR", "EDUCATOR"] as const) {
      expect(
        hasPermission(
          memberships("ACTIVE", [], [
            {
              organizationId: "org-1",
              schoolId: "school-1",
              role,
              status: "ACTIVE",
            },
          ]),
          "record_attendance",
          school,
        ),
      ).toBe(true);
    }

    expect(
      hasPermission(
        memberships("ACTIVE", [], [
          {
            organizationId: "org-1",
            schoolId: "school-1",
            role: "TEACHER",
            status: "ACTIVE",
          },
        ]),
        "record_attendance",
        school,
      ),
    ).toBe(false);
  });

  it("limits publication management to directors while allowing staff to submit", () => {
    const membership = (role: SchoolMembership["role"]) =>
      memberships("ACTIVE", [], [
        {
          organizationId: "org-1",
          schoolId: "school-1",
          role,
          status: "ACTIVE",
        },
      ]);

    expect(
      hasPermission(
        membership("STUDIES_DIRECTOR"),
        "manage_publication_policies",
        school,
      ),
    ).toBe(true);
    expect(
      hasPermission(
        membership("EDUCATOR"),
        "manage_publication_policies",
        school,
      ),
    ).toBe(false);
    expect(
      hasPermission(membership("EDUCATOR"), "create_publication", school),
    ).toBe(true);
    expect(
      hasPermission(membership("GUARDIAN"), "create_publication", school),
    ).toBe(false);
  });

  it("allows only studies directors to decide guardian links", () => {
    for (const role of ["STUDIES_DIRECTOR", "EDUCATOR"] as const) {
      expect(
        hasPermission(
          memberships("ACTIVE", [], [
            {
              organizationId: "org-1",
              schoolId: "school-1",
              role,
              status: "ACTIVE",
            },
          ]),
          "approve_guardian_links",
          school,
        ),
      ).toBe(role === "STUDIES_DIRECTOR");
    }
  });

  it("allows an active founder within their own organization", () => {
    expect(
      hasPermission(
        memberships("ACTIVE", [
          {
            organizationId: "org-1",
            role: "FOUNDER",
            status: "ACTIVE",
          },
        ]),
        "update_official_school_settings",
        school,
      ),
    ).toBe(true);
  });

  it("allows educators to approve accounts in their school only", () => {
    const actor = memberships("ACTIVE", [], [
      {
        organizationId: "org-1",
        schoolId: "school-1",
        role: "EDUCATOR",
        status: "ACTIVE",
      },
    ]);

    expect(hasPermission(actor, "approve_accounts", school)).toBe(true);
    expect(
      hasPermission(actor, "approve_accounts", {
        ...school,
        schoolId: "school-2",
      }),
    ).toBe(false);
  });

  it("does not grant official-settings access to educators", () => {
    expect(
      hasPermission(
        memberships("ACTIVE", [], [
          {
            organizationId: "org-1",
            schoolId: "school-1",
            role: "EDUCATOR",
            status: "ACTIVE",
          },
        ]),
        "update_official_school_settings",
        school,
      ),
    ).toBe(false);
  });

  it("denies pending memberships", () => {
    expect(
      hasPermission(
        memberships("ACTIVE", [], [
          {
            organizationId: "org-1",
            schoolId: "school-1",
            role: "STUDIES_DIRECTOR",
            status: "PENDING",
          },
        ]),
        "approve_accounts",
        school,
      ),
    ).toBe(false);
  });

  it("denies suspended memberships and technical administrators", () => {
    expect(
      hasPermission(
        memberships("ACTIVE", [
          {
            organizationId: "org-1",
            role: "FOUNDER",
            status: "SUSPENDED",
          },
        ]),
        "approve_accounts",
        school,
      ),
    ).toBe(false);
    expect(
      hasPermission(
        memberships("ACTIVE", [
          {
            organizationId: "org-1",
            role: "TECHNICAL_ADMIN",
            status: "ACTIVE",
          },
        ]),
        "approve_accounts",
        school,
      ),
    ).toBe(false);
  });

  it("does not grant a founder access to another organization", () => {
    expect(
      hasPermission(
        memberships("ACTIVE", [
          {
            organizationId: "org-1",
            role: "FOUNDER",
            status: "ACTIVE",
          },
        ]),
        "approve_accounts",
        {
          ...school,
          organizationId: "org-2",
          schoolId: "school-2",
        },
      ),
    ).toBe(false);
  });

  it("denies inactive users and schools even when membership is active", () => {
    const founder = [
      {
        organizationId: "org-1",
        role: "FOUNDER" as const,
        status: "ACTIVE" as const,
      },
    ];

    expect(
      hasPermission(memberships("PENDING", founder), "approve_accounts", school),
    ).toBe(false);
    expect(
      hasPermission(
        memberships("ACTIVE", founder),
        "approve_accounts",
        { ...school, schoolStatus: "SUSPENDED" },
      ),
    ).toBe(false);
  });
});

describe("canInviteSchoolRole", () => {
  it("allows a founder to invite any school role in their organization", () => {
    expect(
      canInviteSchoolRole(
        memberships("ACTIVE", [
          {
            organizationId: "org-1",
            role: "FOUNDER",
            status: "ACTIVE",
          },
        ]),
        "STUDIES_DIRECTOR",
        school,
      ),
    ).toBe(true);
  });

  it("prevents account approvers from granting other account-approver roles", () => {
    const educator = memberships("ACTIVE", [], [
      {
        organizationId: "org-1",
        schoolId: "school-1",
        role: "EDUCATOR",
        status: "ACTIVE",
      },
    ]);

    expect(canInviteSchoolRole(educator, "STUDIES_DIRECTOR", school)).toBe(
      false,
    );
    expect(canInviteSchoolRole(educator, "EDUCATOR", school)).toBe(false);
    expect(canInviteSchoolRole(educator, "TEACHER", school)).toBe(true);
  });
});
