export type ResendEnvironment = Record<string, string | undefined>;

export function isResendConfigured(environment: ResendEnvironment) {
  return Boolean(environment.RESEND_API_KEY?.trim() && environment.RESEND_FROM?.trim());
}
