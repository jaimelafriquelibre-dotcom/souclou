import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { getFounderDashboardSummaryUsing } from "./founder-dashboard";

describe("getFounderDashboardSummaryUsing", () => {
  it("scopes all founder metrics to schools from active founder memberships", async () => {
    const reader = {
      organizationMembership: {
        findMany: vi.fn().mockResolvedValue([
          {
            organization: {
              id: "org-1",
              name: "Organisation fictive",
              schools: [
                { id: "school-a", name: "École A" },
                { id: "school-b", name: "École B" },
              ],
            },
          },
        ]),
      },
      student: {
        groupBy: vi.fn().mockResolvedValue([
          { schoolId: "school-a", _count: { _all: 14 } },
          { schoolId: "school-b", _count: { _all: 6 } },
        ]),
      },
      schoolMembership: {
        groupBy: vi.fn().mockResolvedValue([
          { schoolId: "school-a", _count: { _all: 2 } },
          { schoolId: "school-b", _count: { _all: 1 } },
        ]),
      },
      publication: {
        groupBy: vi.fn().mockResolvedValue([
          { schoolId: "school-b", _count: { _all: 2 } },
        ]),
      },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "audit-1",
            action: "STUDENT_ENROLLED",
            createdAt: new Date("2026-10-30T12:00:00.000Z"),
            actor: { name: "Responsable fictif" },
            school: { name: "École A" },
          },
        ]),
      },
    } as unknown as PrismaClient;

    const summary = await getFounderDashboardSummaryUsing(reader, "founder-1");

    expect(reader.organizationMembership.findMany).toHaveBeenCalledWith({
      where: {
        userId: "founder-1",
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
    expect(reader.student.groupBy).toHaveBeenCalledWith({
      by: ["schoolId"],
      where: { schoolId: { in: ["school-a", "school-b"] }, status: "ACTIVE" },
      _count: { _all: true },
    });
    expect(reader.schoolMembership.groupBy).toHaveBeenCalledWith({
      by: ["schoolId"],
      where: { schoolId: { in: ["school-a", "school-b"] }, status: "PENDING" },
      _count: { _all: true },
    });
    expect(reader.publication.groupBy).toHaveBeenCalledWith({
      by: ["schoolId"],
      where: { schoolId: { in: ["school-a", "school-b"] }, status: "PENDING" },
      _count: { _all: true },
    });
    expect(reader.auditLog.findMany).toHaveBeenCalledWith({
      where: { schoolId: { in: ["school-a", "school-b"] } },
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
    expect(summary.metrics).toEqual({
      schoolCount: 2,
      activeStudentCount: 20,
      pendingAccountCount: 3,
      pendingPublicationCount: 2,
    });
    expect(summary.organizations).toEqual([
      { id: "org-1", name: "Organisation fictive" },
    ]);
    expect(summary.schools.map(({ metrics }) => metrics)).toEqual([
      {
        activeStudentCount: 14,
        pendingAccountCount: 2,
        pendingPublicationCount: 0,
      },
      {
        activeStudentCount: 6,
        pendingAccountCount: 1,
        pendingPublicationCount: 2,
      },
    ]);
  });

  it("does not run data counts when the user has no founder organization", async () => {
    const reader = {
      organizationMembership: { findMany: vi.fn().mockResolvedValue([]) },
      student: { groupBy: vi.fn() },
      schoolMembership: { groupBy: vi.fn() },
      publication: { groupBy: vi.fn() },
      auditLog: { findMany: vi.fn() },
    } as unknown as PrismaClient;

    const summary = await getFounderDashboardSummaryUsing(reader, "teacher-1");

    expect(reader.student.groupBy).not.toHaveBeenCalled();
    expect(reader.schoolMembership.groupBy).not.toHaveBeenCalled();
    expect(reader.publication.groupBy).not.toHaveBeenCalled();
    expect(reader.auditLog.findMany).not.toHaveBeenCalled();
    expect(summary.metrics.schoolCount).toBe(0);
  });

  it("keeps a founder organization available for school creation without active schools", async () => {
    const reader = {
      organizationMembership: {
        findMany: vi.fn().mockResolvedValue([
          { organization: { id: "org-empty", name: "Organisation vide", schools: [] } },
        ]),
      },
      student: { groupBy: vi.fn() },
      schoolMembership: { groupBy: vi.fn() },
      publication: { groupBy: vi.fn() },
      auditLog: { findMany: vi.fn() },
    } as unknown as PrismaClient;

    const summary = await getFounderDashboardSummaryUsing(reader, "founder-1");

    expect(summary.organizations).toEqual([
      { id: "org-empty", name: "Organisation vide" },
    ]);
    expect(summary.schools).toEqual([]);
    expect(reader.student.groupBy).not.toHaveBeenCalled();
  });
});
