"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword, normalizeUsername } from "@/lib/password";
import { prisma } from "@/server/db";
import { isResendConfigured } from "@/lib/resend-config";
import { signIn } from "../../../auth";

export type SignInState = {
  error?: string;
  success?: string;
};

const credentialSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(128),
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  schoolId: z.string().min(1),
  role: z.enum([
    "STUDIES_DIRECTOR",
    "EDUCATOR",
    "ADMINISTRATIVE_STAFF",
    "TEACHER",
    "STUDENT",
    "GUARDIAN",
  ]),
});

export async function signInWithCredentials(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsedCredentials = credentialSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsedCredentials.success) {
    return { error: "Nom d’utilisateur ou mot de passe invalide." };
  }

  try {
    await signIn("credentials", {
      username: parsedCredentials.data.username,
      password: parsedCredentials.data.password,
      redirectTo: "/portail",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Nom d’utilisateur ou mot de passe incorrect.",
      };
    }

    throw error;
  }

  return {
    success: "Connexion réussie.",
  };
}

export async function signInWithEmail(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (!isResendConfigured(process.env)) {
    return { error: "La connexion par e-mail n’est pas activée sur cet environnement." };
  }

  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Adresse e-mail invalide." };
  try {
    await signIn("resend", { email: email.data, redirectTo: "/portail" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Le lien de connexion n’a pas pu être envoyé." };
    throw error;
  }
  return { success: "Si ce compte est autorisé, un lien de connexion vient d’être envoyé." };
}

export async function registerAccount(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsedRegistration = registerSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    schoolId: formData.get("schoolId"),
    role: formData.get("role"),
  });

  if (!parsedRegistration.success) {
    return {
      error: "Vérifiez les informations du compte avant de l’enregistrer.",
    };
  }

  const normalizedUsername = normalizeUsername(parsedRegistration.data.username);
  const passwordHash = await hashPassword(parsedRegistration.data.password);

  try {
    await prisma.$transaction(
      async (transaction) => {
        const school = await transaction.school.findFirst({
          where: {
            id: parsedRegistration.data.schoolId,
            status: "ACTIVE",
            organization: { status: "ACTIVE" },
          },
          select: { id: true },
        });

        if (!school) {
          throw new Error("REGISTRATION_SCHOOL_UNAVAILABLE");
        }

        const existingUser = await transaction.user.findFirst({
          where: {
            OR: [
              { usernameNormalized: normalizedUsername },
              { emailNormalized: parsedRegistration.data.email },
            ],
          },
          select: { usernameNormalized: true, emailNormalized: true },
        });

        if (existingUser) {
          throw new Error("REGISTRATION_CREDENTIALS_TAKEN");
        }

        await transaction.user.create({
          data: {
            name: parsedRegistration.data.name,
            username: parsedRegistration.data.username,
            usernameNormalized: normalizedUsername,
            email: parsedRegistration.data.email,
            emailNormalized: parsedRegistration.data.email,
            passwordHash,
            status: "PENDING",
            schoolMemberships: {
              create: {
                schoolId: school.id,
                role: parsedRegistration.data.role,
                status: "PENDING",
              },
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REGISTRATION_SCHOOL_UNAVAILABLE") {
      return { error: "Cet établissement n’est plus disponible." };
    }

    if (
      error instanceof Error &&
      error.message === "REGISTRATION_CREDENTIALS_TAKEN"
    ) {
      return {
        error:
          "Le nom d’utilisateur ou l’adresse e-mail est déjà utilisé. Vérifiez vos informations.",
      };
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Le nom d’utilisateur ou l’adresse e-mail est déjà utilisé." };
    }

    throw error;
  }

  return {
    success:
      "Compte créé. Il est en attente d’approbation par l’administration.",
  };
}
