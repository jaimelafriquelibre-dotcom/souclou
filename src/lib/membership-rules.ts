export function canTransitionMembership(
  current: "ACTIVE" | "SUSPENDED" | "PENDING",
  next: "ACTIVE" | "SUSPENDED",
) {
  return current !== "PENDING" && current !== next;
}
