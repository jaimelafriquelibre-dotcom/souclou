import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import {
  canInviteSchoolRole,
  hasPermission,
  type AuthorizationMemberships,
  type OrganizationMembership,
  type Permission,
  type SchoolMembership,
  type SchoolRole,
  type SchoolScope,
} from "@/server/authorization";

type PermissionReader = Pick<
  PrismaClient,
  "user" | "school" | "classTeachingAssignment" | "schoolMembership"
>;

const schoolRoles = [
  "STUDIES_DIRECTOR",
  "EDUCATOR",
  "ADMINISTRATIVE_STAFF",
  "TEACHER",
  "STUDENT",
  "GUARDIAN",
] as const satisfies readonly SchoolRole[];

async function getAuthorizationContext(
  reader: PermissionReader,
  userId: string,
  schoolId: string,
): Promise<
  | {
      memberships: AuthorizationMemberships;
      scope: SchoolScope;
    }
  | null
> {
  const [user, school] = await Promise.all([
    reader.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        organizationMemberships: {
          where: { status: "ACTIVE" },
          select: { organizationId: true, role: true, status: true },
        },
        schoolMemberships: {
          where: { status: "ACTIVE" },
          select: {
            schoolId: true,
            role: true,
            status: true,
            school: { select: { organizationId: true } },
          },
        },
      },
    }),
    reader.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        organization: { select: { status: true } },
      },
    }),
  ]);

  if (!user || !school) {
    return null;
  }

  const organizationMemberships: OrganizationMembership[] =
    user.organizationMemberships;
  const schoolMemberships: SchoolMembership[] = user.schoolMemberships.map(
    (membership) => ({
      organizationId: membership.school.organizationId,
      schoolId: membership.schoolId,
      role: membership.role,
      status: membership.status,
    }),
  );

  return {
    memberships: {
      userStatus: user.status,
      organizationMemberships,
      schoolMemberships,
    },
    scope: {
      organizationId: school.organizationId,
      schoolId: school.id,
      organizationStatus: school.organization.status,
      schoolStatus: school.status,
    },
  };
}

export async function canUserPerformInSchoolUsing(
  reader: PermissionReader,
  userId: string,
  schoolId: string,
  permission: Permission,
): Promise<boolean> {
  const context = await getAuthorizationContext(reader, userId, schoolId);
  return context
    ? hasPermission(context.memberships, permission, context.scope)
    : false;
}

export async function getInvitableSchoolRolesUsing(
  reader: PermissionReader,
  userId: string,
  schoolId: string,
): Promise<SchoolRole[]> {
  const context = await getAuthorizationContext(reader, userId, schoolId);

  if (!context) {
    return [];
  }

  return schoolRoles.filter((role) =>
    canInviteSchoolRole(context.memberships, role, context.scope),
  );
}

export async function canUserViewSchoolUsing(
  reader: PermissionReader,
  userId: string,
  schoolId: string,
): Promise<boolean> {
  const context = await getAuthorizationContext(reader, userId, schoolId);

  if (!context || context.memberships.userStatus !== "ACTIVE") {
    return false;
  }

  return (
    context.memberships.organizationMemberships.some(
      (membership) =>
        membership.organizationId === context.scope.organizationId &&
        membership.status === "ACTIVE",
    ) ||
    context.memberships.schoolMemberships.some(
      (membership) =>
        membership.schoolId === schoolId &&
        membership.status === "ACTIVE",
    )
  );
}

export async function canUserTeachClassUsing(
  reader: PermissionReader,
  userId: string,
  schoolId: string,
  classGroupId: string,
): Promise<boolean> {
  const membership = await reader.schoolMembership.findFirst({
    where: {
      userId,
      schoolId,
      role: "TEACHER",
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      school: {
        status: "ACTIVE",
        organization: { status: "ACTIVE" },
      },
    },
    select: { id: true },
  });

  if (!membership) {
    return false;
  }

  return Boolean(
    await reader.classTeachingAssignment.findFirst({
      where: {
        teacherUserId: userId,
        schoolId,
        classGroupId,
        classGroup: { academicYear: { status: "ACTIVE" } },
      },
      select: { id: true },
    }),
  );
}

export async function canUserRecordAttendanceInClassUsing(
  reader: PermissionReader,
  userId: string,
  schoolId: string,
  classGroupId: string,
): Promise<boolean> {
  return (
    (await canUserPerformInSchoolUsing(
      reader,
      userId,
      schoolId,
      "record_attendance",
    )) ||
    (await canUserTeachClassUsing(reader, userId, schoolId, classGroupId))
  );
}

export function canUserPerformInSchool(
  // The caller must take userId from a verified server-side session.
  userId: string,
  schoolId: string,
  permission: Permission,
) {
  return canUserPerformInSchoolUsing(prisma, userId, schoolId, permission);
}

export function canUserViewSchool(userId: string, schoolId: string) {
  return canUserViewSchoolUsing(prisma, userId, schoolId);
}

export function getInvitableSchoolRoles(userId: string, schoolId: string) {
  return getInvitableSchoolRolesUsing(prisma, userId, schoolId);
}
