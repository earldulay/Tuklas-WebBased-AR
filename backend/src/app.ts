import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";
import { healthRouter } from "./routes/health.js";
import { modulesRouter } from "./routes/modules.js";
import { syncRouter } from "./routes/sync.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.use("/api/health", healthRouter);
  app.use("/api/modules", modulesRouter);
  app.use("/api/sync", syncRouter);

  app.use((_request, response) => {
    response.status(404).json({ error: "Route not found" });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ZodError) {
      response.status(400).json({ error: "Validation failed", details: error.flatten() });
      return;
    }

    console.error(error);
    response.status(500).json({ error: "Internal server error" });
  };

  app.use(errorHandler);

  return app;
}
