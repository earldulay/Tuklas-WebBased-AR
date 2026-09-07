import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(32, "Username must be at most 32 characters.")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, and _ . -");

export const passwordSchema = z.string().min(8, "Password must be at least 8 characters.");
