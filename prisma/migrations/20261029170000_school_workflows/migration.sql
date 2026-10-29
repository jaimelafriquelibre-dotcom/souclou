CREATE TYPE "GuardianLinkStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

CREATE TYPE "PublicationType" AS ENUM (
    'NOTICE',
    'EVENT',
    'OFFICIAL_INFORMATION'
);

CREATE TYPE "PublicationStatus" AS ENUM (
    'DRAFT',
    'PENDING',
    'PUBLISHED',
    'REJECTED'
);

CREATE TYPE "PublicationDecision" AS ENUM ('APPROVED', 'REJECTED');

CREATE TYPE "Weekday" AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY'
);

CREATE TABLE "GuardianStudentLink" (
    "id" TEXT NOT NULL,
    "guardianUserId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "GuardianLinkStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuardianStudentLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GuardianStudentLink_guardianUserId_fkey"
        FOREIGN KEY ("guardianUserId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GuardianStudentLink_studentId_schoolId_fkey"
        FOREIGN KEY ("studentId", "schoolId")
        REFERENCES "Student"("id", "schoolId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GuardianStudentLink_schoolId_fkey"
        FOREIGN KEY ("schoolId") REFERENCES "School"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ClassTeachingAssignment" (
    "id" TEXT NOT NULL,
    "teacherUserId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "subject" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassTeachingAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClassTeachingAssignment_teacherUserId_fkey"
        FOREIGN KEY ("teacherUserId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassTeachingAssignment_schoolId_fkey"
        FOREIGN KEY ("schoolId") REFERENCES "School"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassTeachingAssignment_classGroupId_schoolId_academicYearId_fkey"
        FOREIGN KEY ("classGroupId", "schoolId", "academicYearId")
        REFERENCES "ClassGroup"("id", "schoolId", "academicYearId")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClassTeachingAssignment_scope_subject_key"
ON "ClassTeachingAssignment"("id", "schoolId", "classGroupId", "academicYearId", "subject");

CREATE UNIQUE INDEX "ClassTeachingAssignment_scope_subject_teacher_key"
ON "ClassTeachingAssignment"("id", "schoolId", "classGroupId", "academicYearId", "subject", "teacherUserId");

CREATE UNIQUE INDEX "Enrollment_id_schoolId_classGroupId_academicYearId_key"
ON "Enrollment"("id", "schoolId", "classGroupId", "academicYearId");

CREATE TABLE "GradeEntry" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "subject" VARCHAR(80) NOT NULL,
    "assessmentLabel" VARCHAR(120) NOT NULL,
    "score" DECIMAL(8,2) NOT NULL,
    "maximumScore" DECIMAL(8,2) NOT NULL,
    "assessedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradeEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GradeEntry_score_range_check"
        CHECK ("score" >= 0 AND "maximumScore" > 0 AND "score" <= "maximumScore"),
    CONSTRAINT "GradeEntry_enrollmentId_schoolId_fkey"
        FOREIGN KEY ("enrollmentId", "schoolId", "classGroupId", "academicYearId")
        REFERENCES "Enrollment"("id", "schoolId", "classGroupId", "academicYearId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GradeEntry_classGroupId_schoolId_academicYearId_fkey"
        FOREIGN KEY ("classGroupId", "schoolId", "academicYearId")
        REFERENCES "ClassGroup"("id", "schoolId", "academicYearId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GradeEntry_assignmentId_scope_subject_fkey"
        FOREIGN KEY ("assignmentId", "schoolId", "classGroupId", "academicYearId", "subject")
        REFERENCES "ClassTeachingAssignment"("id", "schoolId", "classGroupId", "academicYearId", "subject")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GradeEntry_recordedByUserId_fkey"
        FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "TimetableSlot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "teacherUserId" TEXT NOT NULL,
    "subject" VARCHAR(80) NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "startsAt" VARCHAR(5) NOT NULL,
    "endsAt" VARCHAR(5) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TimetableSlot_time_check"
        CHECK (
            "startsAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            AND "endsAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            AND "startsAt" < "endsAt"
        ),
    CONSTRAINT "TimetableSlot_schoolId_fkey"
        FOREIGN KEY ("schoolId") REFERENCES "School"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_classGroupId_scope_fkey"
        FOREIGN KEY ("classGroupId", "schoolId", "academicYearId")
        REFERENCES "ClassGroup"("id", "schoolId", "academicYearId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_assignment_scope_teacher_fkey"
        FOREIGN KEY ("assignmentId", "schoolId", "classGroupId", "academicYearId", "subject", "teacherUserId")
        REFERENCES "ClassTeachingAssignment"("id", "schoolId", "classGroupId", "academicYearId", "subject", "teacherUserId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableSlot_teacherUserId_fkey"
        FOREIGN KEY ("teacherUserId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PublicationPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "PublicationType" NOT NULL,
    "requiredApprovals" INTEGER NOT NULL,
    "approverRoles" "SchoolRole"[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PublicationPolicy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PublicationPolicy_approval_quorum_check"
        CHECK (
            "requiredApprovals" BETWEEN 1 AND 3
            AND cardinality("approverRoles") > 0
            AND "requiredApprovals" <= cardinality("approverRoles")
        ),
    CONSTRAINT "PublicationPolicy_schoolId_fkey"
        FOREIGN KEY ("schoolId") REFERENCES "School"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PublicationPolicy_id_schoolId_key"
ON "PublicationPolicy"("id", "schoolId");

CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "type" "PublicationType" NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Publication_schoolId_fkey"
        FOREIGN KEY ("schoolId") REFERENCES "School"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Publication_policyId_schoolId_fkey"
        FOREIGN KEY ("policyId", "schoolId")
        REFERENCES "PublicationPolicy"("id", "schoolId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Publication_authorUserId_fkey"
        FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PublicationApproval" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "decision" "PublicationDecision" NOT NULL,
    "comment" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicationApproval_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PublicationApproval_publicationId_fkey"
        FOREIGN KEY ("publicationId") REFERENCES "Publication"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PublicationApproval_approverUserId_fkey"
        FOREIGN KEY ("approverUserId") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GuardianStudentLink_guardianUserId_studentId_key"
ON "GuardianStudentLink"("guardianUserId", "studentId");

CREATE INDEX "GuardianStudentLink_schoolId_studentId_status_idx"
ON "GuardianStudentLink"("schoolId", "studentId", "status");

CREATE INDEX "GuardianStudentLink_guardianUserId_status_idx"
ON "GuardianStudentLink"("guardianUserId", "status");

CREATE UNIQUE INDEX "ClassTeachingAssignment_teacherUserId_classGroupId_subject_key"
ON "ClassTeachingAssignment"("teacherUserId", "classGroupId", "subject");

CREATE INDEX "ClassTeachingAssignment_schoolId_academicYearId_classGroupId_idx"
ON "ClassTeachingAssignment"("schoolId", "academicYearId", "classGroupId");

CREATE UNIQUE INDEX "GradeEntry_enrollmentId_subject_assessmentLabel_key"
ON "GradeEntry"("enrollmentId", "subject", "assessmentLabel");

CREATE INDEX "GradeEntry_schoolId_academicYearId_classGroupId_subject_idx"
ON "GradeEntry"("schoolId", "academicYearId", "classGroupId", "subject");

CREATE INDEX "TimetableSlot_schoolId_academicYearId_weekday_startsAt_idx"
ON "TimetableSlot"("schoolId", "academicYearId", "weekday", "startsAt");

CREATE INDEX "TimetableSlot_teacherUserId_weekday_startsAt_idx"
ON "TimetableSlot"("teacherUserId", "weekday", "startsAt");

CREATE UNIQUE INDEX "PublicationPolicy_schoolId_type_key"
ON "PublicationPolicy"("schoolId", "type");

CREATE INDEX "Publication_schoolId_status_createdAt_idx"
ON "Publication"("schoolId", "status", "createdAt");

CREATE UNIQUE INDEX "PublicationApproval_publicationId_approverUserId_key"
ON "PublicationApproval"("publicationId", "approverUserId");

CREATE INDEX "PublicationApproval_publicationId_decision_idx"
ON "PublicationApproval"("publicationId", "decision");
