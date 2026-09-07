import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export interface AuthTokenPayload {
  sub: string;
  username: string;
  role: "student" | "teacher";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required.");
  }
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "30d" });
}

function readBearerToken(request: Request) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = readBearerToken(request);
  if (!token) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    request.user = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    next();
  } catch {
    response.status(401).json({ error: "Invalid or expired session." });
  }
}

export function requireRole(role: AuthTokenPayload["role"]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (request.user?.role !== role) {
      response.status(403).json({ error: `${role} role required.` });
      return;
    }
    next();
  };
}
