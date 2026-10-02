import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password,
    Google({
      profile(params) {
        return {
          id: params.sub,
          email: params.email as string,
          name: params.name as string,
          image: params.picture as string | undefined,
        };
      },
    }),
  ],
  callbacks: {
    async redirect({ redirectTo }) {
      return redirectTo;
    },
  },
});