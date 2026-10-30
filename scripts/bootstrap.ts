import { config as loadEnv } from "dotenv";
import { Prisma } from "../src/generated/prisma/client";
import type { PrismaClient } from "../src/generated/prisma/client";
import { z } from "zod";
import { hashPassword, normalizeUsername } from "../src/lib/password";

loadEnv({ path: [".env.local", ".env"] });

const bootstrapSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(128),
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  organizationName: z.string().trim().min(1).max(160),
  schoolName: z.string().trim().min(1).max(160),
  schoolCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/),
});

function getBootstrapInput() {
  const parsed = bootstrapSchema.safeParse({
    username: process.env.BOOTSTRAP_USERNAME,
    password: process.env.BOOTSTRAP_PASSWORD,
    email: process.env.BOOTSTRAP_EMAIL,
    name: process.env.BOOTSTRAP_NAME,
    organizationName: process.env.BOOTSTRAP_ORGANIZATION,
    schoolName: process.env.BOOTSTRAP_SCHOOL,
    schoolCode: process.env.BOOTSTRAP_SCHOOL_CODE,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Missing or invalid bootstrap settings: ${missing}.`);
  }

  return parsed.data;
}

async function bootstrap(prisma: PrismaClient, input: z.infer<typeof bootstrapSchema>) {
  await prisma.$transaction(
    async (transaction) => {
      if ((await transaction.organization.count()) > 0) {
        throw new Error(
          "Bootstrap is allowed only before the first organization is created.",
        );
      }

      if (
        await transaction.user.findUnique({
          where: { emailNormalized: input.email },
          select: { id: true },
        })
      ) {
        throw new Error("The bootstrap e-mail already belongs to an account.");
      }

      const normalizedUsername = normalizeUsername(input.username);

      if (
        await transaction.user.findUnique({
          where: { usernameNormalized: normalizedUsername },
          select: { id: true },
        })
      ) {
        throw new Error("The bootstrap username is already in use.");
      }

      const passwordHash = await hashPassword(input.password);

      const user = await transaction.user.create({
        data: {
          name: input.name,
          username: input.username,
          usernameNormalized: normalizedUsername,
          email: input.email,
          emailNormalized: input.email,
          passwordHash,
          status: "ACTIVE",
        },
      });
      const organization = await transaction.organization.create({
        data: { name: input.organizationName },
      });
      const school = await transaction.school.create({
        data: {
          organizationId: organization.id,
          name: input.schoolName,
          code: input.schoolCode,
        },
      });

      await transaction.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "FOUNDER",
          status: "ACTIVE",
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId: organization.id,
          schoolId: school.id,
          actorUserId: user.id,
          action: "BOOTSTRAP_COMPLETED",
          entityType: "Organization",
          entityId: organization.id,
          reason: "Initial organization and founder setup.",
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  console.info("Initial founder, organization, and school created.");
  console.info(
    "The founder can sign in using the configured username and password.",
  );
}

async function main() {
  let prisma: PrismaClient | undefined;

  try {
    const input = getBootstrapInput();
    ({ prisma } = await import("../src/server/prisma-client"));
    await bootstrap(prisma, input);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error(
        "Bootstrap failed: verify DATABASE_URL and PostgreSQL availability.",
      );
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`Bootstrap failed: database error ${error.code}.`);
    } else {
      console.error(
        "Bootstrap failed:",
        error instanceof Error ? error.message : "unexpected error",
      );
    }

    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

void main();
