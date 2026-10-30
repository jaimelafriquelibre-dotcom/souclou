import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { normalizeUsername, verifyPassword } from "@/lib/password";
import { prisma } from "@/server/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      name: "SOUCLOU",
      credentials: {
        username: { label: "Nom d’utilisateur", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const username = normalizeUsername(String(credentials?.username ?? ""));
        const password = String(credentials?.password ?? "");

        if (!username || !password) {
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
