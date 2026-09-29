import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { env } from '@/config/env';
import { upsertOAuthUser } from '@/repositories';

/**
 * Auth.js v5 (Blueprint §5.1). Google is the sole sign-in: no password
 * storage, no reset flow, no credential-stuffing surface. Guest checkout stays
 * open — nothing on the ordering path is gated behind authentication.
 *
 * Sessions are stateless JWTs. The one database write is at sign-in: the guest
 * is found by email or their account is opened, and that row's id rides in the
 * token so orders, loyalty and subscriptions attach to a real account.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: env.AUTH_SECRET,

  // Vercel and Cloudflare are trusted automatically; any other host (Render,
  // Railway, a VPS behind nginx) would otherwise fail every sign-in with
  // `UntrustedHost`. Callback URLs are still validated against the origin.
  trustHost: true,

  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },

  // Both land on our own page, which reads `?error=` and says what happened.
  pages: { signIn: '/login', error: '/login' },

  callbacks: {
    /** Google marks unverified addresses; an email we cannot trust is not an identity. */
    async signIn({ profile }) {
      return Boolean(profile?.email) && profile?.email_verified !== false;
    },

    async jwt({ token, profile }) {
      // `profile` is only present on the sign-in round trip itself.
      if (profile?.email) {
        token.email = profile.email;
        token.name = profile.name ?? token.name;
        token.picture = (profile as { picture?: string }).picture ?? token.picture;
        try {
          const user = await upsertOAuthUser({
            email: profile.email,
            name: profile.name ?? null,
            image: (profile as { picture?: string }).picture ?? null,
          });
          (token as { uid?: string }).uid = user.id;
        } catch (err) {
          // The account row is re-resolved lazily on the next request that
          // needs it (lib/session.ts) — a database blip must not block sign-in.
          console.error('auth_user_upsert_failed', err);
        }
      }
      return token;
    },

    /** Only what the header and account page render reaches the browser. */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token as { uid?: string }).uid ?? '';
        session.user.name = token.name ?? '';
        session.user.email = token.email ?? '';
        session.user.image = (token.picture as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
