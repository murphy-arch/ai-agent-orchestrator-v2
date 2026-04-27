import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { router, authedQuery } from "./middleware";
import { verifyStackAccess, verifyStackAdmin, verifyStackOwner } from "./lib/permissions";
import { getDb } from "@db/connection";
import { stacks, stackMembers, users, aiAgents, conversations } from "@db/schema";

export const stackRouter = router({
  // ─── List all stacks where user is a member ───
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userStacks = await db
      .select({
        id: stacks.id,
        name: stacks.name,
        description: stacks.description,
        slug: stacks.slug,
        ownerId: stacks.ownerId,
        isDefault: stacks.isDefault,
        status: stacks.status,
        plan: stacks.plan,
        createdAt: stacks.createdAt,
        updatedAt: stacks.updatedAt,
        role: stackMembers.role,
      })
      .from(stackMembers)
      .innerJoin(stacks, eq(stackMembers.stackId, stacks.id))
      .where(eq(stackMembers.userId, ctx.user.id))
      .orderBy(desc(stacks.createdAt));

    return userStacks;
  }),

  // ─── Get a single stack by ID ───
  getById: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [stack] = await db
        .select()
        .from(stacks)
        .where(eq(stacks.id, input.stackId))
        .limit(1);

      if (!stack) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Stack not found",
        });
      }

      return stack;
    }),

  // ─── Create a new stack ───
  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

      const [result] = await db.insert(stacks).values({
        name: input.name,
        description: input.description,
        slug,
        ownerId: ctx.user.id,
        status: "active",
        plan: "free",
      });

      const stackId = Number(result.insertId);

      await db.insert(stackMembers).values({
        stackId,
        userId: ctx.user.id,
        role: "owner",
      });

      return { id: stackId, slug };
    }),

  // ─── Update a stack ───
  update: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAdmin(ctx.user.id, input.stackId);

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.status !== undefined) updateData.status = input.status;

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update",
        });
      }

      await db
        .update(stacks)
        .set(updateData)
        .where(eq(stacks.id, input.stackId));

      return { success: true };
    }),

  // ─── Delete a stack (hard delete) ───
  delete: authedQuery
    .input(z.object({ stackId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackOwner(ctx.user.id, input.stackId);

      await db.delete(stacks).where(eq(stacks.id, input.stackId));

      return { success: true };
    }),

  // ─── Get all members of a stack ───
  getMembers: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const members = await db
        .select({
          id: stackMembers.id,
          stackId: stackMembers.stackId,
          userId: stackMembers.userId,
          role: stackMembers.role,
          invitedBy: stackMembers.invitedBy,
          joinedAt: stackMembers.joinedAt,
          email: users.email,
          name: users.name,
        })
        .from(stackMembers)
        .innerJoin(users, eq(stackMembers.userId, users.id))
        .where(eq(stackMembers.stackId, input.stackId))
        .orderBy(asc(stackMembers.joinedAt));

      return members;
    }),

  // ─── Invite a member to a stack ───
  inviteMember: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        email: z.string().email(),
        role: z.enum(["admin", "member"]).default("member"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAdmin(ctx.user.id, input.stackId);

      // Find user by email
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No user found with that email",
        });
      }

      // Check if already a member
      const [existing] = await db
        .select()
        .from(stackMembers)
        .where(
          and(
            eq(stackMembers.stackId, input.stackId),
            eq(stackMembers.userId, targetUser.id)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this stack",
        });
      }

      await db.insert(stackMembers).values({
        stackId: input.stackId,
        userId: targetUser.id,
        role: input.role,
        invitedBy: ctx.user.id,
      });

      return { success: true, userId: targetUser.id };
    }),

  // ─── Remove a member from a stack ───
  removeMember: authedQuery
    .input(
      z.object({
        stackId: z.number(),
        userId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAdmin(ctx.user.id, input.stackId);

      // Cannot remove owner
      const [membership] = await db
        .select()
        .from(stackMembers)
        .where(
          and(
            eq(stackMembers.stackId, input.stackId),
            eq(stackMembers.userId, input.userId)
          )
        )
        .limit(1);

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found in this stack",
        });
      }

      if (membership.role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot remove the stack owner",
        });
      }

      await db
        .delete(stackMembers)
        .where(
          and(
            eq(stackMembers.stackId, input.stackId),
            eq(stackMembers.userId, input.userId)
          )
        );

      return { success: true };
    }),

  // ─── Get stack stats ───
  getStats: authedQuery
    .input(z.object({ stackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await verifyStackAccess(ctx.user.id, input.stackId);

      const [agentResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(aiAgents)
        .where(eq(aiAgents.stackId, input.stackId));

      const [messageResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(conversations)
        .where(eq(conversations.stackId, input.stackId));

      const [lastActivity] = await db
        .select({ createdAt: conversations.createdAt })
        .from(conversations)
        .where(eq(conversations.stackId, input.stackId))
        .orderBy(desc(conversations.createdAt))
        .limit(1);

      return {
        agentCount: agentResult?.count ?? 0,
        messageCount: messageResult?.count ?? 0,
        lastActivity: lastActivity?.createdAt ?? null,
      };
    }),
});
