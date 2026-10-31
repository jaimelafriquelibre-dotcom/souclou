import { z } from "zod";

export const schoolSettingsSchema = z.object({
  schoolId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9_-]+$/),
  timeZone: z.string().trim().min(1).max(80).refine((value) => {
    try {
      new Intl.DateTimeFormat("fr-CI", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Le fuseau horaire doit être un identifiant IANA valide."),
});

export function normalizeSchoolSettings(input: z.input<typeof schoolSettingsSchema>) {
  const parsed = schoolSettingsSchema.parse(input);
  return { ...parsed, code: parsed.code.toUpperCase() };
}
