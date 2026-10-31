export function canManageOrganizationMembership(input: {
  actorIsFounder: boolean;
  organizationActive: boolean;
  targetUserActive: boolean;
}) {
  return input.actorIsFounder && input.organizationActive && input.targetUserActive;
}
