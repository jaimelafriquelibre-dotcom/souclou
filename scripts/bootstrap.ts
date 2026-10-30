import { config as loadEnv } from "dotenv";
import { Prisma } from "../src/generated/prisma/client";
import type { PrismaClient } from "../src/generated/prisma/client";
import { z } from "zod";
import { hashPassword, normalizeUsername } from "../src/lib/password";

const envFileIndex = process.argv.indexOf("--env-file");
const envFile = envFileIndex >= 0 ? process.argv[envFileIndex + 1] : undefined;

loadEnv({
  path: envFile ? [envFile] : [".env.local", ".env"],
  override: Boolean(envFile),
});

if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}

const bootstrapSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(128),
  email: z.string().trim().toLowerCase().email().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  organizationName: z.string().trim().min(1).max(160).optional(),
  schoolName: z.string().trim().min(1).max(160).optional(),
  schoolCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});

const initialBootstrapSchema = bootstrapSchema.extend({
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
  const normalizedUsername = normalizeUsername(input.username);
  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(
    async (transaction) => {
      const organizationCount = await transaction.organization.count();

      if (organizationCount > 0) {
        const founders = await transaction.user.findMany({
          where: {
            organizationMemberships: {
              some: { role: "FOUNDER", status: "ACTIVE" },
            },
          },
          select: {
            id: true,
            status: true,
            organizationMemberships: {
              where: { role: "FOUNDER", status: "ACTIVE" },
              select: { organizationId: true },
            },
          },
        });

        if (founders.length !== 1) {
          throw new Error(
            "Founder credential reset requires exactly one active founder account.",
          );
        }

        const founder = founders[0];

        if (founder.status === "SUSPENDED") {
          throw new Error(
            "The founder account is suspended and cannot be reset by bootstrap.",
          );
        }

        const usernameConflict = await transaction.user.findFirst({
          where: {
            id: { not: founder.id },
            OR: [
              { usernameNormalized: normalizedUsername },
              { username: input.username },
            ],
          },
          select: { id: true },
        });

        if (usernameConflict) {
          throw new Error("The bootstrap username is already in use.");
        }

        await transaction.user.update({
          where: { id: founder.id },
          data: {
            username: input.username,
            usernameNormalized: normalizedUsername,
            passwordHash,
            status: "ACTIVE",
          },
        });

        await transaction.auditLog.createMany({
          data: founder.organizationMemberships.map(({ organizationId }) => ({
            organizationId,
            actorUserId: founder.id,
            action: "FOUNDER_CREDENTIALS_RESET",
            entityType: "User",
            entityId: founder.id,
            reason: "Founder credentials were reset through the bootstrap command.",
          })),
        });

        console.info("Existing founder credentials updated.");
        return;
      }

      const initialInput = initialBootstrapSchema.safeParse(input);

      if (!initialInput.success) {
        const missing = initialInput.error.issues
          .map((issue) => issue.path.join("."))
          .join(", ");
        throw new Error(`Missing or invalid bootstrap settings: ${missing}.`);
      }

      if (
        await transaction.user.findUnique({
          where: { emailNormalized: initialInput.data.email },
          select: { id: true },
        })
      ) {
        throw new Error("The bootstrap e-mail already belongs to an account.");
      }

      if (
        await transaction.user.findUnique({
          where: { usernameNormalized: normalizedUsername },
          select: { id: true },
        })
      ) {
        throw new Error("The bootstrap username is already in use.");
      }

      const user = await transaction.user.create({
        data: {
          name: initialInput.data.name,
          username: input.username,
          usernameNormalized: normalizedUsername,
          email: initialInput.data.email,
          emailNormalized: initialInput.data.email,
          passwordHash,
          status: "ACTIVE",
        },
      });
      const organization = await transaction.organization.create({
        data: { name: initialInput.data.organizationName },
      });
      const school = await transaction.school.create({
        data: {
          organizationId: organization.id,
          name: initialInput.data.schoolName,
          code: initialInput.data.schoolCode,
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
