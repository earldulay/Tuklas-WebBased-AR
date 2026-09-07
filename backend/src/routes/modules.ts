import { Router } from "express";
import { modules } from "../data/modules.js";
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
    response.json(stored.length ? stored : modules);
  } catch (error) {
    console.warn("Serving bundled modules because PostgreSQL is unavailable.");
    response.json(modules);
  }
});

modulesRouter.post("/seed", async (_request, response, next) => {
  if (!hasDatabaseUrl()) {
    response.status(503).json({ error: "DATABASE_URL is required before seeding modules." });
    return;
  }

  try {
    await Promise.all(
      modules.map((module) =>
        prisma.module.upsert({
          where: { id: module.id },
          update: module,
          create: module,
        }),
      ),
    );
    response.status(201).json({ seeded: modules.length });
  } catch (error) {
    next(error);
  }
});
