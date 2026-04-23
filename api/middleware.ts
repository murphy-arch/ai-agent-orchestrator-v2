import { TRPCError, initTRPC } from "@trpc/server";
import { Context } from "hono";
import { jwtVerify } from "jose";
import superjson from "superjson";
import { eq, and } from "drizzle-orm";
import { getDb } from "@db/connection";
import { users, stackMembers } from "@db/schema";

// ─── JWT Secret ───
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "change-me-in-production"
);

// ─── Context Builder ───
export async function createContext(c: Context) {
  const token =
    c.req.header("authorization")?.replace("Bearer ", "") ||
    c.req.header("x-jwt") ||
    "";

  let user: { id: number; email: string; name: string | null; role: string } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET, { clockTolerance: 60 });
      if (payload.sub) {
        const db = getDb();
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, Number(payload.sub)));
        if (dbUser) {
          user = {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role || "user",
          };
        }
      }
    } catch {
      // Invalid token — user remains null
    }
  }

  return { user, c };
}

export type ContextType = Awaited<ReturnType<typeof createContext>>;

// ─── tRPC Setup ───
const t = initTRPC.context<ContextType>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicQuery = t.procedure;

// ─── Auth Middleware ───
export const authedQuery = publicQuery.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminQuery = authedQuery.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});
