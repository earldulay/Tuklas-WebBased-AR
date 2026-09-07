import { Router } from "express";
import { z } from "zod";
import { modules } from "../data/modules.js";
import { hasDatabaseUrl } from "../lib/database.js";
import { prisma } from "../lib/prisma.js";

const recordSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["student", "teacher"]),
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

syncRouter.post("/", async (request, response, next) => {
  if (!hasDatabaseUrl()) {
    response.status(503).json({ error: "DATABASE_URL is required before syncing records." });
    return;
  }

  try {
    const payload = syncSchema.parse(request.body);

    await Promise.all(
      modules.map((module) =>
        prisma.module.upsert({
          where: { id: module.id },
          update: module,
          create: module,
        }),
      ),
    );

    const records = await Promise.all(
      payload.records.map((record) =>
        prisma.activityRecord.upsert({
          where: { id: record.id },
          update: {
            role: record.role,
            moduleId: record.moduleId,
            mode: record.mode,
            stage: record.stage,
            text: record.text,
            createdAt: new Date(record.createdAt),
          },
          create: {
            id: record.id,
            role: record.role,
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
