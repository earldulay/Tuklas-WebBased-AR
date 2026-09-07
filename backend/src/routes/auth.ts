import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { hashPassword, requireAuth, requireRole, signToken, verifyPassword } from "../lib/auth.js";
import { hasDatabaseUrl } from "../lib/database.js";
import { prisma } from "../lib/prisma.js";

export const authRouter = Router();

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(32, "Username must be at most 32 characters.")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, and _ . -");

const passwordSchema = z.string().min(8, "Password must be at least 8 characters.");

function requireDatabase(response: import("express").Response) {
  if (!hasDatabaseUrl()) {
    response.status(503).json({ error: "DATABASE_URL is required before using accounts." });
    return false;
  }
  return true;
}

function toPublicUser(user: { id: string; username: string; role: string; name: string; section: string | null; createdAt: Date }) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    section: user.section,
    createdAt: user.createdAt,
  };
}

const registerTeacherSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, "Name is required.").max(100),
});

authRouter.post("/register-teacher", async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const payload = registerTeacherSchema.parse(request.body);
    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.user.create({
      data: {
        username: payload.username,
        passwordHash,
        role: "teacher",
        name: payload.name,
      },
    });

    const token = signToken({ sub: user.id, username: user.username, role: "teacher" });
    response.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      response.status(409).json({ error: "That username is already taken." });
      return;
    }
    next(error);
  }
});

const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Password is required."),
});

authRouter.post("/login", async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const payload = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { username: payload.username } });

    if (!user || !(await verifyPassword(payload.password, user.passwordHash))) {
      response.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const token = signToken({ sub: user.id, username: user.username, role: user.role });
    response.json({ token, user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const user = await prisma.user.findUnique({ where: { id: request.user!.sub } });
    if (!user) {
      response.status(404).json({ error: "Account no longer exists." });
      return;
    }
    response.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

const createStudentSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, "Name is required.").max(100),
  section: z.string().trim().max(50).optional(),
});

authRouter.post("/students", requireAuth, requireRole("teacher"), async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const payload = createStudentSchema.parse(request.body);
    const passwordHash = await hashPassword(payload.password);

    const student = await prisma.user.create({
      data: {
        username: payload.username,
        passwordHash,
        role: "student",
        name: payload.name,
        section: payload.section,
        createdById: request.user!.sub,
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

authRouter.get("/students", requireAuth, requireRole("teacher"), async (request, response, next) => {
  if (!requireDatabase(response)) return;

  try {
    const students = await prisma.user.findMany({
      where: { createdById: request.user!.sub },
      orderBy: { createdAt: "desc" },
    });
    response.json({ students: students.map(toPublicUser) });
  } catch (error) {
    next(error);
  }
});
