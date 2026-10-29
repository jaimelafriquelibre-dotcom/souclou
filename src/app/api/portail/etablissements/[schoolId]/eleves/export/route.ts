import { appendAuditEvent } from "@/server/audit";
import { canUserPerformInSchool } from "@/server/permissions";
import { prisma } from "@/server/db";
import { requireActiveUserId } from "@/server/session";
import { toCsvRow } from "@/lib/csv";

const BATCH_SIZE = 500;
const headers = [
  "Référence interne",
  "Nom",
  "Prénoms",
  "Statut élève",
  "Dernière classe",
  "Année scolaire",
  "Statut inscription",
];

type ExportRouteContext = {
  params: Promise<{ schoolId: string }>;
};

function csvRow(student: {
  localReference: string | null;
  familyName: string;
  givenNames: string;
  status: string;
  enrollments: {
    status: string;
    classGroup: { label: string };
    academicYear: { label: string };
  }[];
}) {
  const enrollment = student.enrollments[0];
  return toCsvRow([
    student.localReference ?? "",
    student.familyName,
    student.givenNames,
    student.status === "ACTIVE" ? "Actif" : "Archivé",
    enrollment?.classGroup.label ?? "",
    enrollment?.academicYear.label ?? "",
    enrollment
      ? enrollment.status === "ACTIVE"
        ? "Inscrit"
        : "Retiré"
      : "",
  ]);
}

export async function GET(
  _request: Request,
  { params }: ExportRouteContext,
) {
  const actorUserId = await requireActiveUserId();
  const { schoolId } = await params;
  if (
    !(await canUserPerformInSchool(
      actorUserId,
      schoolId,
      "manage_student_records",
    ))
  ) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }

  const school = await prisma.school.findFirst({
    where: {
      id: schoolId,
      countryCode: "CI",
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
    },
    select: { id: true, organizationId: true, code: true },
  });
  if (!school) {
    return Response.json({ error: "Établissement introuvable." }, { status: 404 });
  }

  const where = { schoolId };
  const firstBatch = await prisma.student.findMany({
    where,
    orderBy: { id: "asc" },
    take: BATCH_SIZE,
    select: {
      id: true,
      localReference: true,
      familyName: true,
      givenNames: true,
      status: true,
      enrollments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          status: true,
          classGroup: { select: { label: true } },
          academicYear: { select: { label: true } },
        },
      },
    },
  });

  await prisma.$transaction(async (transaction) => {
    await appendAuditEvent(transaction, {
      organizationId: school.organizationId,
      schoolId,
      actorUserId,
      action: "STUDENT_REGISTER_EXPORT_REQUESTED",
      entityType: "StudentExport",
      after: { format: "CSV" },
    });
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const enqueue = (value: string) => controller.enqueue(encoder.encode(value));
      try {
        enqueue(`\uFEFF${toCsvRow(headers)}\r\n`);
        let batch = firstBatch;
        let cursor = batch.at(-1)?.id;
        while (batch.length > 0) {
          for (const student of batch) {
            enqueue(`${csvRow(student)}\r\n`);
          }
          if (batch.length < BATCH_SIZE || !cursor) {
            break;
          }
          batch = await prisma.student.findMany({
            where,
            orderBy: { id: "asc" },
            cursor: { id: cursor },
            skip: 1,
            take: BATCH_SIZE,
            select: {
              id: true,
              localReference: true,
              familyName: true,
              givenNames: true,
              status: true,
              enrollments: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  status: true,
                  classGroup: { select: { label: true } },
                  academicYear: { select: { label: true } },
                },
              },
            },
          });
          cursor = batch.at(-1)?.id;
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  const safeCode = school.code.replace(/[^A-Za-z0-9_-]/g, "_");
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="souclou-eleves-${safeCode}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
