import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getOne, query } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await getOne<{
          id: string;
          name: string;
          email: string;
          password_hash: string;
          image: string | null;
        }>(
          "SELECT id, name, email, password_hash, image FROM users WHERE email = $1",
          [credentials.email as string]
        );

        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        // Upsert user for OAuth
        const existing = await getOne<{ id: string }>(
          "SELECT id FROM users WHERE email = $1",
          [user.email]
        );

        if (existing) {
          // Link account if not already linked
          const linked = await getOne<{ id: string }>(
            "SELECT id FROM accounts WHERE provider = $1 AND provider_account_id = $2",
            [account.provider, account.providerAccountId]
          );
          if (!linked) {
            await query(
              `INSERT INTO accounts (user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                existing.id,
                account.type,
                account.provider,
                account.providerAccountId,
                account.refresh_token || null,
                account.access_token || null,
                account.expires_at || null,
                account.token_type || null,
                account.scope || null,
                account.id_token || null,
              ]
            );
          }
          user.id = existing.id;
        } else {
          // Create new user
          const result = await query<{ id: string }>(
            `INSERT INTO users (name, email, email_verified, image)
             VALUES ($1, $2, NOW(), $3)
             RETURNING id`,
            [user.name || user.email, user.email, user.image || null]
          );
          const newUserId = result.rows[0].id;
          user.id = newUserId;

          await query(
            `INSERT INTO accounts (user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              newUserId,
              account.type,
              account.provider,
              account.providerAccountId,
              account.refresh_token || null,
              account.access_token || null,
              account.expires_at || null,
              account.token_type || null,
              account.scope || null,
              account.id_token || null,
            ]
          );
        }

        // Auto-accept pending invites
        const invite = await getOne<{ org_id: string; role: string }>(
          "SELECT org_id, role FROM org_invites WHERE email = $1 AND expires_at > NOW()",
          [user.email]
        );
        if (invite) {
          await query(
            `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3)
             ON CONFLICT (org_id, user_id) DO NOTHING`,
            [invite.org_id, user.id, invite.role]
          );
          await query("DELETE FROM org_invites WHERE email = $1", [user.email]);
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id!;
      }

      // Load org membership if not cached
      if (token.userId && !token.orgId) {
        const membership = await getOne<{ org_id: string; role: string }>(
          "SELECT org_id, role FROM org_members WHERE user_id = $1 LIMIT 1",
          [token.userId]
        );
        if (membership) {
          token.orgId = membership.org_id;
          token.role = membership.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.orgId = token.orgId || "";
      session.user.role = token.role || "";
      return session;
    },
  },
});
