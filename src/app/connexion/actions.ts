"use server";

import { AuthError } from "next-auth";
import { signIn } from "../../../auth";
import { z } from "zod";

export type SignInState = {
  error?: string;
  success?: string;
};

const emailSchema = z.string().trim().toLowerCase().email();

export async function requestMagicLink(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsedEmail = emailSchema.safeParse(formData.get("email"));

  if (!parsedEmail.success) {
    return { error: "Saisissez une adresse e-mail valide." };
  }

  if (
    !process.env.AUTH_RESEND_KEY?.trim() ||
    !process.env.EMAIL_FROM?.trim()
  ) {
    return {
      error:
        "La connexion par e-mail n’est pas encore configurée. Contactez l’administrateur de l’application.",
    };
  }

  try {
    await signIn("resend", {
      email: parsedEmail.data,
      redirectTo: "/portail",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          "Connexion indisponible. Vérifiez votre adresse ou contactez votre établissement.",
      };
    }

    throw error;
  }

  return {
    success:
      "Si votre compte est autorisé, un lien temporaire vient d’être envoyé.",
  };
}
