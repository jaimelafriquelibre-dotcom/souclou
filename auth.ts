import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { isMagicLinkRequestAllowed } from "@/server/magic-link-rate-limit";
import { prisma } from "@/server/db";

const prismaAdapter = PrismaAdapter(prisma);
const resendProvider = Resend({
  apiKey: process.env.AUTH_RESEND_KEY,
  from: process.env.EMAIL_FROM,
  maxAge: 15 * 60,
});

const rateLimitedResendProvider: ReturnType<typeof Resend> = {
  ...resendProvider,
  async sendVerificationRequest(params) {
    if (!(await isMagicLinkRequestAllowed(params.identifier))) {
      throw new Error("Magic link request limit exceeded.");
    }

    await resendProvider.sendVerificationRequest(params);
  },
};

const invitationOnlyAdapter: Adapter = {
  ...prismaAdapter,
  async createUser() {
    throw new Error("An account invitation is required before sign-in.");
  },
  async getUserByEmail(email) {
    return prisma.user.findUnique({
      where: { emailNormalized: email.trim().toLowerCase() },
    });
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  adapter: invitationOnlyAdapter,
  providers: [rateLimitedResendProvider],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/connexion",
    verifyRequest: "/connexion/verifier",
    error: "/connexion",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.id) {
        return false;
      }

      const account = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          status: true,
          organizationMemberships: {
            where: { status: { in: ["PENDING", "ACTIVE"] } },
            select: { id: true },
          },
          schoolMemberships: {
            where: { status: { in: ["PENDING", "ACTIVE"] } },
            select: { id: true },
          },
        },
      });

      return (
        account !== null &&
        account.status !== "SUSPENDED" &&
        (account.organizationMemberships.length > 0 ||
          account.schoolMemberships.length > 0)
      );
    },
    async session({ session, token }) {
      if (!token.sub) {
        throw new Error("The authenticated session has no user identifier.");
      }
      const account = await prisma.user.findUnique({
        where: { id: token.sub },
        select: {
          status: true,
        },
      });

      if (!account) {
        throw new Error("The authenticated account no longer exists.");
      }

      session.user.id = token.sub;
      session.user.status = account.status;
      return session;
    },
  },
});
