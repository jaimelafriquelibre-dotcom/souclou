import { config as loadEnv } from "dotenv";
import { Resend } from "resend";

loadEnv({ path: [".env.local", ".env"] });

async function sendTestEmail() {
  const apiKey = process.env.AUTH_RESEND_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const to =
    process.env.RESEND_TEST_TO?.trim() || process.env.BOOTSTRAP_EMAIL?.trim();
  const missing = [
    ["AUTH_RESEND_KEY", apiKey],
    ["EMAIL_FROM", from],
    ["RESEND_TEST_TO or BOOTSTRAP_EMAIL", to],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (!apiKey || !from || !to) {
    throw new Error(
      `Configuration Resend incomplète dans .env.local : ${missing.join(", ")}.`,
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Hello World",
    html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
  });

  if (error) {
    throw new Error(`Resend a refusé le courriel : ${error.message}`);
  }

  console.info("Courriel de test accepté par Resend.");
}

sendTestEmail().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Échec inattendu du test Resend.",
  );
  process.exitCode = 1;
});
