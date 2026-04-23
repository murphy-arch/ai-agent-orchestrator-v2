import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import * as cookie from "cookie";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { signSessionToken } from "./kimi/session";
import { getSessionCookieOptions } from "./lib/cookies";
import { Session } from "@contracts/constants";

export const localAuthRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        email: z.string().email().max(320),
        password: z.string().min(8).max(100),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const unionId = `local:${input.email.toLowerCase()}`;

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.unionId, unionId))
        .limit(1);

      if (existing.length > 0) {
        throw new Error("An account with this email already exists.");
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      await db.insert(users).values({
        unionId,
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: "user",
      });

      const token = await signSessionToken({
        unionId,
        clientId: "local",
      });

      const opts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.cookieName, token, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: Session.maxAgeMs / 1000,
        })
      );

      return { success: true };
    }),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const unionId = `local:${input.email.toLowerCase()}`;

      const rows = await db
        .select()
        .from(users)
        .where(eq(users.unionId, unionId))
        .limit(1);

      const user = rows.at(0);
      if (!user || !user.passwordHash) {
        throw new Error("Invalid email or password.");
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new Error("Invalid email or password.");
      }

      await db
        .update(users)
        .set({ lastSignInAt: new Date() })
        .where(eq(users.id, user.id));

      const token = await signSessionToken({
        unionId,
        clientId: "local",
      });

      const opts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.cookieName, token, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: Session.maxAgeMs / 1000,
        })
      );

      return { success: true };
    }),
});
