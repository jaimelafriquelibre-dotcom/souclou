import { z } from "zod";
import { toCsvRow } from "@/lib/csv";
import { appendAuditEvent } from "@/server/audit";
import { formatIvoirianDate } from "@/lib/locale";
import { prisma } from "@/server/db";
import { canUserRecordAttendanceInClassUsing } from "@/server/permissions";
import { requireActiveUserId } from "@/server/session";

const BATCH_SIZE = 500;
const attendanceLabels = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  LATE: "En retard",
  EXCUSED: "Absence justifiée",
} as const;

type ExportRouteContext = {
  params: Promise<{ schoolId: string }>;
};

export async function GET(
  request: Request,
  { params }: ExportRouteContext,
) {
  const actorUserId = await requireActiveUserId();
  const { schoolId } = await params;
  const searchParams = new URL(request.url).searchParams;
  const parsed = z
    .object({
      classId: z.string().min(1),
      date: z.iso.date(),
    })
    .safeParse({
      classId: searchParams.get("classId"),
      date: searchParams.get("date"),
    });

  if (!parsed.success) {
    return Response.json(
      { error: "Sélectionnez une classe et une date valides." },
      { status: 400 },
    );
  }

  const { classId, date } = parsed.data;
  const attendanceDate = new Date(`${date}T00:00:00.000Z`);
  const classGroup = await prisma.classGroup.findFirst({
    where: {
      id: classId,
      schoolId,
      school: {
        countryCode: "CI",
        status: "ACTIVE",
        organization: { status: "ACTIVE" },
      },
      academicYear: { status: "ACTIVE" },
    },
    select: {
      id: true,
      label: true,
      academicYearId: true,
      academicYear: {
        select: {
          label: true,
          startsOn: true,
          endsOn: true,
        },
      },
      school: { select: { name: true, code: true, organizationId: true } },
    },
  });

  if (!classGroup) {
    return Response.json({ error: "Classe active introuvable." }, { status: 404 });
  }

  if (
    !(await canUserRecordAttendanceInClassUsing(
      prisma,
      actorUserId,
      schoolId,
      classGroup.id,
    ))
  ) {
    return Response.json({ error: "Accès refusé." }, { status: 403 });
  }

  const yearStart = classGroup.academicYear.startsOn.toISOString().slice(0, 10);
  const yearEnd = classGroup.academicYear.endsOn.toISOString().slice(0, 10);
  if (date < yearStart || date > yearEnd) {
    return Response.json(
      { error: "La date doit se situer dans les limites de l’année scolaire." },
      { status: 400 },
    );
  }

  await prisma.$transaction((transaction) =>
    appendAuditEvent(transaction, {
      organizationId: classGroup.school.organizationId,
      schoolId,
      actorUserId,
      action: "ATTENDANCE_EXPORT_REQUESTED",
      entityType: "ClassGroup",
      entityId: classGroup.id,
      after: {
        academicYearId: classGroup.academicYearId,
        date,
        format: "CSV",
      },
    }),
  );

  const where = {
    schoolId,
    classGroupId: classGroup.id,
    academicYearId: classGroup.academicYearId,
    status: "ACTIVE" as const,
    student: { status: "ACTIVE" as const },
  };
  const select = {
    id: true,
    student: {
      select: {
        localReference: true,
        familyName: true,
        givenNames: true,
      },
    },
    attendanceRecords: {
      where: { attendanceDate },
      select: { status: true },
    },
  } as const;

  const firstBatch = await prisma.enrollment.findMany({
    where,
    orderBy: [
      { student: { familyName: "asc" } },
      { student: { givenNames: "asc" } },
      { id: "asc" },
    ],
    take: BATCH_SIZE,
    select,
  });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const enqueue = (value: string) => controller.enqueue(encoder.encode(value));
      try {
        enqueue(
          `\uFEFF${toCsvRow([
            "Référence interne",
            "Nom",
            "Prénoms",
            "Établissement",
            "Classe",
            "Année scolaire",
            "Date",
            "Statut de présence",
          ])}\r\n`,
        );
        let batch = firstBatch;
        let cursor = batch.at(-1)?.id;
        while (batch.length > 0) {
          for (const enrollment of batch) {
            const status = enrollment.attendanceRecords[0]?.status;
            enqueue(
              `${toCsvRow([
                enrollment.student.localReference ?? "",
                enrollment.student.familyName,
                enrollment.student.givenNames,
                classGroup.school.name,
                classGroup.label,
                classGroup.academicYear.label,
                formatIvoirianDate(attendanceDate),
                status ? attendanceLabels[status] : "Non saisi",
              ])}\r\n`,
            );
          }
          if (batch.length < BATCH_SIZE || !cursor) {
            break;
          }
          batch = await prisma.enrollment.findMany({
            where,
            orderBy: [
              { student: { familyName: "asc" } },
              { student: { givenNames: "asc" } },
              { id: "asc" },
            ],
            cursor: { id: cursor },
            skip: 1,
            take: BATCH_SIZE,
            select,
          });
          cursor = batch.at(-1)?.id;
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  const safeCode = classGroup.school.code.replace(/[^A-Za-z0-9_-]/g, "_");
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="souclou-presences-${safeCode}-${date}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
