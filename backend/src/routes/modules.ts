import { Router } from "express";
import { modules, toPersistedModule } from "../data/modules.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { hasDatabaseUrl } from "../lib/database.js";
import { prisma } from "../lib/prisma.js";

export const modulesRouter = Router();

modulesRouter.get("/", async (_request, response, next) => {
  if (!hasDatabaseUrl()) {
    response.json(modules);
    return;
  }

  try {
    const stored = await prisma.module.findMany({ orderBy: { createdAt: "asc" } });
    response.json(stored.length ? modules.map((module) => ({ ...stored.find((item) => item.id === module.id), ...module })) : modules);
  } catch (error) {
    console.warn("Serving bundled modules because PostgreSQL is unavailable.");
    response.json(modules);
  }
});

modulesRouter.post("/seed", requireAuth, requireRole("teacher"), async (_request, response, next) => {
  if (!hasDatabaseUrl()) {
    response.status(503).json({ error: "DATABASE_URL is required before seeding modules." });
    return;
  }

  try {
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
    response.status(201).json({ seeded: modules.length });
  } catch (error) {
    next(error);
  }
});
