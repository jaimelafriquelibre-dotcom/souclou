"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { hashPassword, normalizeUsername } from "@/lib/password";
import { prisma } from "@/server/db";
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

export async function registerAccount(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsedRegistration = registerSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsedRegistration.success) {
    return {
      error: "Vérifiez les informations du compte avant de l’enregistrer.",
    };
  }

  const normalizedUsername = normalizeUsername(parsedRegistration.data.username);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { usernameNormalized: normalizedUsername },
        { emailNormalized: parsedRegistration.data.email },
      ],
    },
    select: { id: true, usernameNormalized: true, emailNormalized: true },
  });

  if (existingUser?.usernameNormalized === normalizedUsername) {
    return { error: "Ce nom d’utilisateur est déjà utilisé." };
  }

  if (existingUser?.emailNormalized === parsedRegistration.data.email) {
    return { error: "Cette adresse e-mail est déjà associée à un compte." };
  }

  const passwordHash = await hashPassword(parsedRegistration.data.password);

  await prisma.user.create({
    data: {
      name: parsedRegistration.data.name,
      username: parsedRegistration.data.username,
      usernameNormalized: normalizedUsername,
      email: parsedRegistration.data.email,
      emailNormalized: parsedRegistration.data.email,
      passwordHash,
      status: "PENDING",
    },
  });

  return {
    success:
      "Compte créé. Il est en attente d’approbation par l’administration.",
  };
}
