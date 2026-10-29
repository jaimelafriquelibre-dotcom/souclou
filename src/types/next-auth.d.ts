import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    status: "PENDING" | "ACTIVE" | "SUSPENDED";
  }

  interface Session {
    user: {
      id: string;
      status: "PENDING" | "ACTIVE" | "SUSPENDED";
    } & DefaultSession["user"];
  }
}
