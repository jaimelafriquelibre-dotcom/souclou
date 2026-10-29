import { describe, expect, it } from "vitest";
import { notificationAccessScope } from "./notification-scope";

describe("notificationAccessScope", () => {
  it("limits notification access to the user and active school memberships", () => {
    expect(notificationAccessScope("user-1")).toEqual({
      userId: "user-1",
      school: {
        status: "ACTIVE",
        organization: { status: "ACTIVE" },
        OR: [
          { memberships: { some: { userId: "user-1", status: "ACTIVE" } } },
          {
            organization: {
              memberships: {
                some: { userId: "user-1", status: "ACTIVE" },
              },
            },
          },
        ],
      },
    });
  });

  it("uses the authenticated user scope rather than accepting a browser tenant", () => {
    const firstUserScope = notificationAccessScope("user-1");
    const secondUserScope = notificationAccessScope("user-2");

    expect(firstUserScope).not.toEqual(secondUserScope);
    expect(JSON.stringify(firstUserScope)).not.toContain("schoolId");
  });
});
