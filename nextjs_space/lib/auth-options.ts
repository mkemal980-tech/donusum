import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma, withRetry } from "./db";
import bcrypt from "bcryptjs";

const nextAuthUrl = process.env.NEXTAUTH_URL;
const nextAuthSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
const useSecureCookies =
  process.env.NODE_ENV === "production" || nextAuthUrl?.startsWith("https://");
const cookiePrefix = useSecureCookies ? "__Secure-" : "";
const sameSite = useSecureCookies ? ("none" as const) : ("lax" as const);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: nextAuthSecret,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies
      }
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        sameSite,
        path: '/',
        secure: useSecureCookies
      }
    },
    csrfToken: {
      name: `${cookiePrefix}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies
      }
    }
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Use withRetry to handle connection timeout issues
        const user = await withRetry(() => prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() }
        }));

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Email doğrulama kontrolü
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // Hesap aktivasyon kontrolü
        if (!user.isActive) {
          throw new Error("ACCOUNT_DISABLED");
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          organization: user.organization,
          role: user.role,
          unitId: user.unitId,
          sectorId: user.sectorId,
          subSectorId: user.subSectorId,
          emailVerified: user.emailVerified
        };
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.firstName = (user as any).firstName;
        token.lastName = (user as any).lastName;
        token.organization = (user as any).organization;
        token.role = (user as any).role;
        token.unitId = (user as any).unitId;
        token.sectorId = (user as any).sectorId;
        token.subSectorId = (user as any).subSectorId;
        token.emailVerified = (user as any).emailVerified;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).firstName = token.firstName;
        (session.user as any).lastName = token.lastName;
        (session.user as any).organization = token.organization;
        (session.user as any).role = token.role;
        (session.user as any).unitId = token.unitId;
        (session.user as any).sectorId = token.sectorId;
        (session.user as any).subSectorId = token.subSectorId;
        (session.user as any).emailVerified = token.emailVerified;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login"
  }
};
