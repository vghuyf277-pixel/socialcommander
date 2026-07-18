import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler — catches unhandled errors in async route handlers
// Express 5 automatically catches async errors, so this covers all routes
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  const isDev = process.env.NODE_ENV !== "production";

  // DB connection errors — return 503 instead of 500
  const isDbError =
    message.includes("timeout") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("connect ETIMEDOUT") ||
    message.includes("Connection terminated");

  logger.error({ err }, "Unhandled request error");
  res.status(isDbError ? 503 : 500).json({
    error: isDbError ? "Database unavailable — please try again shortly" : message,
    ...(isDev && err instanceof Error ? { stack: err.stack } : {}),
  });
});

export default app;
