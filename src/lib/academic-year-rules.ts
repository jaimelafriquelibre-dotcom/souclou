export type AcademicYearLifecycleStatus = "PLANNED" | "ACTIVE" | "CLOSED";
export type AcademicYearNextStatus = "ACTIVE" | "CLOSED";

export function canTransitionAcademicYear(
  current: AcademicYearLifecycleStatus,
  next: AcademicYearNextStatus,
) {
  return (
    (current === "PLANNED" && next === "ACTIVE") ||
    (current === "ACTIVE" && next === "CLOSED")
  );
}
