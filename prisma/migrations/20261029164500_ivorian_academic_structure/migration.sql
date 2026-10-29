CREATE TYPE "AcademicYearStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED');

CREATE TYPE "SchoolCycle" AS ENUM (
    'PRESCHOOL',
    'PRIMARY',
    'LOWER_SECONDARY',
    'UPPER_SECONDARY'
);

CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'COMPLETED');

CREATE TYPE "AttendanceStatus" AS ENUM (
    'PRESENT',
    'ABSENT',
    'LATE',
    'EXCUSED'
);

ALTER TABLE "School"
ADD COLUMN "countryCode" CHAR(2) NOT NULL DEFAULT 'CI',
ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Africa/Abidjan';

CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "status" "AcademicYearStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AcademicYear_date_order_check" CHECK ("startsOn" < "endsOn"),
    CONSTRAINT "AcademicYear_schoolId_fkey"
        FOREIGN KEY ("schoolId") REFERENCES "School"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AcademicYear_id_schoolId_key"
ON "AcademicYear"("id", "schoolId");

CREATE TABLE "ClassGroup" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cycle" "SchoolCycle" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassGroup_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClassGroup_schoolId_fkey"
        FOREIGN KEY ("schoolId") REFERENCES "School"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassGroup_academicYearId_schoolId_fkey"
        FOREIGN KEY ("academicYearId", "schoolId")
        REFERENCES "AcademicYear"("id", "schoolId")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClassGroup_id_schoolId_academicYearId_key"
ON "ClassGroup"("id", "schoolId", "academicYearId");

CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "localReference" TEXT,
    "familyName" TEXT NOT NULL,
    "givenNames" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Student_schoolId_fkey"
        FOREIGN KEY ("schoolId") REFERENCES "School"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Student_id_schoolId_key"
ON "Student"("id", "schoolId");

CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Enrollment_studentId_schoolId_fkey"
        FOREIGN KEY ("studentId", "schoolId")
        REFERENCES "Student"("id", "schoolId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_academicYearId_schoolId_fkey"
        FOREIGN KEY ("academicYearId", "schoolId")
        REFERENCES "AcademicYear"("id", "schoolId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_classGroupId_schoolId_academicYearId_fkey"
        FOREIGN KEY ("classGroupId", "schoolId", "academicYearId")
        REFERENCES "ClassGroup"("id", "schoolId", "academicYearId")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Enrollment_id_schoolId_key"
ON "Enrollment"("id", "schoolId");

CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AttendanceRecord_enrollmentId_schoolId_fkey"
        FOREIGN KEY ("enrollmentId", "schoolId")
        REFERENCES "Enrollment"("id", "schoolId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceRecord_schoolId_fkey"
        FOREIGN KEY ("schoolId") REFERENCES "School"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceRecord_recordedByUserId_fkey"
        FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AcademicYear_schoolId_label_key"
ON "AcademicYear"("schoolId", "label");

CREATE INDEX "AcademicYear_schoolId_status_startsOn_idx"
ON "AcademicYear"("schoolId", "status", "startsOn");

CREATE UNIQUE INDEX "AcademicYear_one_active_per_school_idx"
ON "AcademicYear"("schoolId")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "ClassGroup_academicYearId_label_key"
ON "ClassGroup"("academicYearId", "label");

CREATE INDEX "ClassGroup_schoolId_academicYearId_cycle_idx"
ON "ClassGroup"("schoolId", "academicYearId", "cycle");

CREATE UNIQUE INDEX "Student_schoolId_localReference_key"
ON "Student"("schoolId", "localReference");

CREATE INDEX "Student_schoolId_status_familyName_givenNames_idx"
ON "Student"("schoolId", "status", "familyName", "givenNames");

CREATE UNIQUE INDEX "Enrollment_studentId_academicYearId_key"
ON "Enrollment"("studentId", "academicYearId");

CREATE INDEX "Enrollment_schoolId_academicYearId_classGroupId_status_idx"
ON "Enrollment"("schoolId", "academicYearId", "classGroupId", "status");

CREATE UNIQUE INDEX "AttendanceRecord_enrollmentId_attendanceDate_key"
ON "AttendanceRecord"("enrollmentId", "attendanceDate");

CREATE INDEX "AttendanceRecord_schoolId_attendanceDate_status_idx"
ON "AttendanceRecord"("schoolId", "attendanceDate", "status");
