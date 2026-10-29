export const IVOIRIAN_LOCALE = "fr-CI";
export const IVOIRIAN_TIME_ZONE = "Africa/Abidjan";
export const IVOIRIAN_CURRENCY = "XOF";

export function formatIvoirianDate(value: Date) {
  return new Intl.DateTimeFormat(IVOIRIAN_LOCALE, {
    dateStyle: "long",
    timeZone: IVOIRIAN_TIME_ZONE,
  }).format(value);
}

export function getIvoirianToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: IVOIRIAN_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");

  if (!year || !month || !day) {
    throw new Error("Unable to determine the current date in Côte d’Ivoire.");
  }

  return `${year}-${month}-${day}`;
}
