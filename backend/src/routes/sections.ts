import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { hashPassword, requireAuth, requireRole } from "../lib/auth.js";
import { hasDatabaseUrl } from "../lib/database.js";
import { prisma } from "../lib/prisma.js";
import { passwordSchema, usernameSchema } from "../lib/validation.js";

export const sectionsRouter = Router();

sectionsRouter.use(requireAuth, requireRole("teacher"));

function requireDatabase(response: import("express").Response) {
  if (!hasDatabaseUrl()) {
    response.status(503).json({ error: "DATABASE_URL is required before using sections." });
    return false;
  }
  return true;
}

function toPublicUser(user: { id: string; username: string; role: string; name: string; createdAt: Date }) {
  return { id: user.id, username: user.username, role: user.role, name: user.name, createdAt: user.createdAt };
}

const createSectionSchema = z.object({
  name: z.string().trim().min(1, "Section name is required.").max(80),
});

sectionsRouter.post("/", async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const payload = createSectionSchema.parse(request.body);
    const section = await prisma.section.create({
      data: { name: payload.name, teacherId: request.user!.sub },
    });
    response.status(201).json({ section });
  } catch (error) {
    next(error);
  }
});

sectionsRouter.get("/", async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const sections = await prisma.section.findMany({
      where: { teacherId: request.user!.sub },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { students: true } } },
    });
    response.json({
      sections: sections.map((section) => ({
        id: section.id,
        name: section.name,
        createdAt: section.createdAt,
        studentCount: section._count.students,
      })),
    });
  } catch (error) {
    next(error);
  }
});

async function loadOwnedSection(teacherId: string, sectionId: string) {
  return prisma.section.findFirst({ where: { id: sectionId, teacherId } });
}

sectionsRouter.get("/:id", async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const section = await loadOwnedSection(request.user!.sub, request.params.id);
    if (!section) {
      response.status(404).json({ error: "Section not found." });
      return;
    }

    const students = await prisma.user.findMany({
      where: { sectionId: section.id },
      orderBy: { createdAt: "desc" },
    });

    const studentIds = students.map((student) => student.id);
    const records = studentIds.length
      ? await prisma.activityRecord.findMany({
          where: { userId: { in: studentIds } },
          orderBy: { createdAt: "desc" },
        })
      : [];

    response.json({
      section,
      students: students.map(toPublicUser),
      records: records.map((record) => ({
        id: record.id,
        userId: record.userId,
        moduleId: record.moduleId,
        stage: record.stage,
        mode: record.mode,
        text: record.text,
        createdAt: record.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

const createStudentSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, "Name is required.").max(100),
});

sectionsRouter.post("/:id/students", async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const section = await loadOwnedSection(request.user!.sub, request.params.id);
    if (!section) {
      response.status(404).json({ error: "Section not found." });
      return;
    }

    const payload = createStudentSchema.parse(request.body);
    const passwordHash = await hashPassword(payload.password);

    const student = await prisma.user.create({
      data: {
        username: payload.username,
        passwordHash,
        role: "student",
        name: payload.name,
        createdById: request.user!.sub,
        sectionId: section.id,
      },
    });

    response.status(201).json({ user: toPublicUser(student) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      response.status(409).json({ error: "That username is already taken." });
      return;
    }
    next(error);
  }
});
