import { Router } from "express";
import { z } from "zod";
import { modules, toPersistedModule } from "../data/modules.js";
import { requireAuth } from "../lib/auth.js";
import { hasDatabaseUrl } from "../lib/database.js";
import { prisma } from "../lib/prisma.js";

const recordSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().min(1),
  mode: z.enum(["ar", "fallback"]),
  stage: z.enum(["Predict", "Observe", "Explain", "Reflection"]),
  text: z.string().min(1),
  createdAt: z.string().datetime(),
});

const syncSchema = z.object({
  records: z.array(recordSchema),
});

export const syncRouter = Router();

syncRouter.post("/", requireAuth, async (request, response, next) => {
  if (!hasDatabaseUrl()) {
    response.status(503).json({ error: "DATABASE_URL is required before syncing records." });
    return;
  }

  try {
    const payload = syncSchema.parse(request.body);
    // The authenticated user, not the client payload, decides who a record
    // belongs to and what role it was submitted under.
    const { sub: userId, role } = request.user!;

    await Promise.all(
      modules.map((module) => {
        const persisted = toPersistedModule(module);
        return prisma.module.upsert({
          where: { id: module.id },
          update: persisted,
          create: persisted,
        });
      }),
    );

    const records = await Promise.all(
      payload.records.map((record) =>
        prisma.activityRecord.upsert({
          where: { id: record.id },
          update: {
            userId,
            role,
            moduleId: record.moduleId,
            mode: record.mode,
            stage: record.stage,
            text: record.text,
            createdAt: new Date(record.createdAt),
          },
          create: {
            id: record.id,
            userId,
            role,
            moduleId: record.moduleId,
            mode: record.mode,
            stage: record.stage,
            text: record.text,
            createdAt: new Date(record.createdAt),
          },
        }),
      ),
    );

    response.json({ records });
  } catch (error) {
    next(error);
  }
});
