import type { PrismaClient } from "@/generated/prisma/client";

type FounderDashboardReader = Pick<
  PrismaClient,
  | "organizationMembership"
  | "student"
  | "schoolMembership"
  | "publication"
  | "auditLog"
>;

type SchoolCountGroup = {
  schoolId: string;
  _count: { _all: number };
};

type FounderSchool = {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  metrics: {
    activeStudentCount: number;
    pendingAccountCount: number;
    pendingPublicationCount: number;
  };
};

export async function getFounderDashboardSummaryUsing(
  reader: FounderDashboardReader,
  userId: string,
) {
  const memberships = await reader.organizationMembership.findMany({
    where: {
      userId,
      role: "FOUNDER",
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
    },
    select: {
      organization: {
        select: {
          id: true,
          name: true,
          schools: {
            where: { status: "ACTIVE" },
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  const schools = memberships.flatMap(({ organization }) =>
    organization.schools.map((school) => ({
      ...school,
      organizationId: organization.id,
      organizationName: organization.name,
    })),
  );
  const organizations = memberships.map(({ organization }) => ({
    id: organization.id,
    name: organization.name,
  }));
  const schoolIds = [...new Set(schools.map(({ id }) => id))];

  if (schoolIds.length === 0) {
    return {
      schools: [] as FounderSchool[],
      organizations,
      recentActivity: [],
      metrics: {
        schoolCount: 0,
        activeStudentCount: 0,
        pendingAccountCount: 0,
        pendingPublicationCount: 0,
      },
    };
  }

  const [studentGroups, accountGroups, publicationGroups] = await Promise.all([
    reader.student.groupBy({
      by: ["schoolId"],
      where: { schoolId: { in: schoolIds }, status: "ACTIVE" },
      _count: { _all: true },
    }),
    reader.schoolMembership.groupBy({
      by: ["schoolId"],
      where: { schoolId: { in: schoolIds }, status: "PENDING" },
      _count: { _all: true },
    }),
    reader.publication.groupBy({
      by: ["schoolId"],
      where: { schoolId: { in: schoolIds }, status: "PENDING" },
      _count: { _all: true },
    }),
  ]);

  const toCountMap = (groups: SchoolCountGroup[]) =>
    new Map(groups.map(({ schoolId, _count }) => [schoolId, _count._all]));
  const studentCounts = toCountMap(studentGroups);
  const accountCounts = toCountMap(accountGroups);
  const publicationCounts = toCountMap(publicationGroups);
  const schoolsWithMetrics: FounderSchool[] = schools.map((school) => ({
    ...school,
    metrics: {
      activeStudentCount: studentCounts.get(school.id) ?? 0,
      pendingAccountCount: accountCounts.get(school.id) ?? 0,
      pendingPublicationCount: publicationCounts.get(school.id) ?? 0,
    },
  }));
  const recentActivity = await reader.auditLog.findMany({
    where: { schoolId: { in: schoolIds } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 8,
    select: {
      id: true,
      action: true,
      createdAt: true,
      actor: { select: { name: true } },
      school: { select: { name: true } },
    },
  });

  return {
    schools: schoolsWithMetrics,
    organizations,
    recentActivity,
    metrics: {
      schoolCount: schoolIds.length,
      activeStudentCount: schoolsWithMetrics.reduce(
        (total, school) => total + school.metrics.activeStudentCount,
        0,
      ),
      pendingAccountCount: schoolsWithMetrics.reduce(
        (total, school) => total + school.metrics.pendingAccountCount,
        0,
      ),
      pendingPublicationCount: schoolsWithMetrics.reduce(
        (total, school) => total + school.metrics.pendingPublicationCount,
        0,
      ),
    },
  };
}
