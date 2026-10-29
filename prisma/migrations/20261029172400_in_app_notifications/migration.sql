CREATE TYPE "NotificationType" AS ENUM (
    'ACCOUNT_APPROVED',
    'PUBLICATION_APPROVAL_REQUIRED',
    'PUBLICATION_DECISION',
    'PUBLICATION_PUBLISHED',
    'GUARDIAN_LINK_DECISION'
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "href" VARCHAR(500) NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Notification_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_schoolId_fkey"
        FOREIGN KEY ("schoolId") REFERENCES "School"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Notification_userId_readAt_createdAt_idx"
ON "Notification"("userId", "readAt", "createdAt");

CREATE INDEX "Notification_schoolId_createdAt_idx"
ON "Notification"("schoolId", "createdAt");
