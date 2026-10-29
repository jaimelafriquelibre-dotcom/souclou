export type OrganizationRole = "FOUNDER" | "TECHNICAL_ADMIN";

export type SchoolRole =
  | "STUDIES_DIRECTOR"
  | "EDUCATOR"
  | "ADMINISTRATIVE_STAFF"
  | "TEACHER"
  | "STUDENT"
  | "GUARDIAN";

export type MembershipStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export type OrganizationMembership = {
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
};

export type SchoolMembership = {
  organizationId: string;
  schoolId: string;
  role: SchoolRole;
  status: MembershipStatus;
};

export type Permission =
  | "approve_accounts"
  | "update_official_school_settings"
  | "manage_academic_structure"
  | "manage_student_records"
  | "record_attendance"
  | "manage_guardian_links"
  | "manage_teaching_assignments"
  | "manage_publication_policies"
  | "approve_guardian_links"
  | "create_publication";

export type SchoolScope = {
  organizationId: string;
  schoolId: string;
  organizationStatus: "ACTIVE" | "SUSPENDED";
  schoolStatus: "ACTIVE" | "SUSPENDED";
};

export type AuthorizationMemberships = {
  userStatus: UserStatus;
  organizationMemberships: readonly OrganizationMembership[];
  schoolMemberships: readonly SchoolMembership[];
};

const organizationRolesByPermission: Record<
  Permission,
  readonly OrganizationRole[]
> = {
  approve_accounts: ["FOUNDER"],
  update_official_school_settings: ["FOUNDER"],
  manage_academic_structure: ["FOUNDER"],
  manage_student_records: ["FOUNDER"],
  record_attendance: ["FOUNDER"],
  manage_guardian_links: ["FOUNDER"],
  manage_teaching_assignments: ["FOUNDER"],
  manage_publication_policies: ["FOUNDER"],
  approve_guardian_links: ["FOUNDER"],
  create_publication: ["FOUNDER"],
};

const schoolRolesByPermission: Record<Permission, readonly SchoolRole[]> = {
  approve_accounts: ["STUDIES_DIRECTOR", "EDUCATOR"],
  update_official_school_settings: ["STUDIES_DIRECTOR"],
  manage_academic_structure: ["STUDIES_DIRECTOR"],
  manage_student_records: ["STUDIES_DIRECTOR", "ADMINISTRATIVE_STAFF"],
  record_attendance: ["STUDIES_DIRECTOR", "EDUCATOR"],
  manage_guardian_links: ["STUDIES_DIRECTOR", "ADMINISTRATIVE_STAFF"],
  manage_teaching_assignments: ["STUDIES_DIRECTOR"],
  manage_publication_policies: ["STUDIES_DIRECTOR"],
  approve_guardian_links: ["STUDIES_DIRECTOR"],
  create_publication: [
    "STUDIES_DIRECTOR",
    "EDUCATOR",
    "ADMINISTRATIVE_STAFF",
  ],
};

export function hasPermission(
  memberships: AuthorizationMemberships,
  permission: Permission,
  scope: SchoolScope,
): boolean {
  if (
    memberships.userStatus !== "ACTIVE" ||
    scope.organizationStatus !== "ACTIVE" ||
    scope.schoolStatus !== "ACTIVE"
  ) {
    return false;
  }

  const hasOrganizationPermission =
    memberships.organizationMemberships.some(
      (membership) =>
        membership.organizationId === scope.organizationId &&
        organizationRolesByPermission[permission].includes(membership.role) &&
        membership.status === "ACTIVE",
    );

  if (hasOrganizationPermission) {
    return true;
  }

  return memberships.schoolMemberships.some(
    (membership) =>
      membership.organizationId === scope.organizationId &&
      membership.schoolId === scope.schoolId &&
      membership.status === "ACTIVE" &&
      schoolRolesByPermission[permission].includes(membership.role),
  );
}

export function canInviteSchoolRole(
  memberships: AuthorizationMemberships,
  role: SchoolRole,
  scope: SchoolScope,
): boolean {
  if (
    memberships.userStatus !== "ACTIVE" ||
    scope.organizationStatus !== "ACTIVE" ||
    scope.schoolStatus !== "ACTIVE"
  ) {
    return false;
  }

  const isFounder = memberships.organizationMemberships.some(
    (membership) =>
      membership.organizationId === scope.organizationId &&
      membership.role === "FOUNDER" &&
      membership.status === "ACTIVE",
  );

  if (isFounder) {
    return true;
  }

  if (role === "STUDIES_DIRECTOR" || role === "EDUCATOR") {
    return false;
  }

  return hasPermission(memberships, "approve_accounts", scope);
}
