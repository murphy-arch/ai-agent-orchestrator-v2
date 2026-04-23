import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@db/connection";
import { stackMembers } from "@db/schema";

/**
 * Verify that a user has access to a stack with the required role.
 * Throws TRPCError FORBIDDEN if access is denied.
 */
export async function verifyStackAccess(
  userId: number,
  stackId: number,
  allowedRoles: string[] = ["owner", "admin", "member"]
) {
  const db = getDb();
  const [membership] = await db
    .select()
    .from(stackMembers)
    .where(
      and(
        eq(stackMembers.userId, userId),
        eq(stackMembers.stackId, stackId)
      )
    );

  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied for this stack",
    });
  }

  return membership;
}

/**
 * Check if user is at least an admin of the stack.
 */
export async function verifyStackAdmin(userId: number, stackId: number) {
  return verifyStackAccess(userId, stackId, ["owner", "admin"]);
}

/**
 * Check if user is the owner of the stack.
 */
export async function verifyStackOwner(userId: number, stackId: number) {
  return verifyStackAccess(userId, stackId, ["owner"]);
}
