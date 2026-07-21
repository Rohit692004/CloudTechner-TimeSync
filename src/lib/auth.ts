import NextAuth from "next-auth";
import AzureAD from "next-auth/providers/azure-ad";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

const azureClientId = process.env.AZURE_AD_CLIENT_ID;
const azureClientSecret = process.env.AZURE_AD_CLIENT_SECRET;
const azureTenantId = process.env.AZURE_AD_TENANT_ID;
const azureEnabled = !!azureClientId && !!azureClientSecret && !!azureTenantId;

async function findActiveEmployeeByEmail(email: string) {
  return prisma.employee.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, passwordHash: true },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    ...(azureEnabled
      ? [
          AzureAD({
            clientId: azureClientId!,
            clientSecret: azureClientSecret!,
            issuer: `https://login.microsoftonline.com/${azureTenantId}/v2.0`,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const employee = await findActiveEmployeeByEmail(email);
        if (!employee) return null;

        const valid = await bcrypt.compare(password, employee.passwordHash);
        if (!valid) return null;

        return {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
        };
      },
    }),
  ],
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      if (account?.provider !== "azure-ad") return true;

      const profileEmail =
        user.email ??
        (profile as { email?: string; preferred_username?: string } | undefined)?.email ??
        (profile as { email?: string; preferred_username?: string } | undefined)?.preferred_username;
      if (!profileEmail) return false;

      const employee = await findActiveEmployeeByEmail(profileEmail);
      if (!employee) return false;

      user.id = employee.id;
      user.name = employee.name;
      user.email = employee.email;
      user.role = employee.role;
      return true;
    },
    jwt: ({ token, user }) => {
      if (user) {
        token.employeeId = user.id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.employeeId as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
