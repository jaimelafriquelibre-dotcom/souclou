import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { normalizeUsername, verifyPassword } from "@/lib/password";
import {
  clearCredentialAttempts,
  consumeCredentialAttempt,
} from "@/server/credential-rate-limit";
import { prisma } from "@/server/db";
import { isResendConfigured } from "@/lib/resend-config";

const baseAdapter = PrismaAdapter(prisma);
const adapter = {
  ...baseAdapter,
  async createUser(data: Parameters<NonNullable<typeof baseAdapter.createUser>>[0]) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        emailNormalized: data.email.trim().toLowerCase(),
        emailVerified: data.emailVerified,
        image: data.image,
        status: "PENDING",
      },
    });
  },
  async updateUser(data: Parameters<NonNullable<typeof baseAdapter.updateUser>>[0]) {
    const { id, email, ...updates } = data;
    return prisma.user.update({
      where: { id },
      data: {
        ...updates,
        ...(email
          ? { email, emailNormalized: email.trim().toLowerCase() }
          : {}),
      },
    });
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  adapter,
  trustHost: true,
  providers: [
    ...(isResendConfigured(process.env)
      ? [Resend({ apiKey: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM })]
      : []),
    Credentials({
      name: "SOUCLOU",
      credentials: {
        username: { label: "Nom d’utilisateur", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const username = normalizeUsername(String(credentials?.username ?? ""));
        const password = String(credentials?.password ?? "");

        if (
          !/^[a-z0-9._-]{3,32}$/.test(username) ||
          password.length < 8 ||
          password.length > 128
        ) {
          return null;
        }

        if (!(await consumeCredentialAttempt(username))) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { usernameNormalized: username },
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            status: true,
            passwordHash: true,
          },
        });

        if (!user || !user.passwordHash || user.status === "SUSPENDED") {
          return null;
        }

        const isValid = await verifyPassword(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        await clearCredentialAttempts(username);

        return {
          id: user.id,
          name: user.name ?? user.username ?? user.email,
          email: user.email,
          status: user.status,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/connexion",
    error: "/connexion",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user && "status" in user) {
        token.status = user.status;
      }

      return token;
    },
    async signIn({ user }) {
      if (!user.id) {
        return false;
      }

      const account = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          status: true,
        },
      });

      return account !== null && account.status !== "SUSPENDED";
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
