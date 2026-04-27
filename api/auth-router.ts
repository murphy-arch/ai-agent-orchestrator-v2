import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { randomUUID } from "crypto";
import { router, publicQuery } from "./middleware";
import { getDb } from "@db/connection";
import { users } from "@db/schema";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "change-me-in-production"
);

async function createToken(userId: number) {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export const authRouter = router({
  register: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email));

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already registered",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      const [result] = await db.insert(users).values({
        unionId: randomUUID(),
        email: input.email,
        passwordHash,
        name: input.name || input.email.split("@")[0],
        role: "user",
      });

      const userId = Number(result.insertId);
      const token = await createToken(userId);

      return { token, user: { id: userId, email: input.email, name: input.name, timezone: "UTC" } };
    }),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email));

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid email or password",
        });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const token = await createToken(user.id);
      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }),

  me: publicQuery.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    return ctx.user;
  }),
});
