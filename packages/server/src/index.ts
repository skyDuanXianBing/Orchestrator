// ============================================
// server/src/index.ts — Express 服务入口
// ============================================

import express from "express";
import cors from "cors";
import { createTaskRouter } from "./routes/task.js";
import { createPipelineRouter } from "./routes/pipeline.js";
import { createEventRouter } from "./routes/events.js";
import { createHealthRouter } from "./routes/health.js";
import { createDirectoriesRouter } from "./routes/directories.js";
import { TaskManager } from "./services/task-manager.js";
import { OpencodeClientManager } from "./core/client.js";
import { EventBus } from "./utils/event-bus.js";
import { Logger } from "./utils/logger.js";
import { closeDatabase, initializeDatabase } from "./db/database.js";
import { TaskRepository } from "./db/repositories/task-repository.js";
import { PhaseRepository } from "./db/repositories/phase-repository.js";
import { EventRepository } from "./db/repositories/event-repository.js";
import {
  BlackboardSnapshotRepository,
} from "./db/repositories/blackboard-snapshot-repository.js";

const PORT = Number(process.env.PORT ?? 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

const logger = new Logger();

const database = initializeDatabase();
const taskRepository = new TaskRepository(database);
const phaseRepository = new PhaseRepository(database);
const eventRepository = new EventRepository(database);
const snapshotRepository = new BlackboardSnapshotRepository(database);

const eventBus = new EventBus(eventRepository);
const clientManager = new OpencodeClientManager(logger);
const taskManager = new TaskManager(
  eventBus,
  logger,
  clientManager,
  taskRepository,
  phaseRepository,
  snapshotRepository,
);

const app: express.Express = express();

// ─── 中间件 ───
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// ─── 路由 ───
app.use("/api/task", createTaskRouter(taskManager));
app.use("/api/pipeline", createPipelineRouter(taskManager));
app.use("/api/events", createEventRouter(eventBus));
app.use("/api", createHealthRouter(taskManager));
app.use("/api", createDirectoriesRouter());

// ─── 全局错误处理 ───
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error("Unhandled error", err.message);
    res.status(500).json({
      success: false,
      data: null,
      error: err.message,
    });
  },
);

const server = app.listen(PORT, () => {
  logger.info(`Orchestrator server running on http://localhost:${PORT}`);
});

const gracefulShutdown = (): void => {
  logger.info("Received shutdown signal, closing services...");
  clientManager.close();
  closeDatabase();
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

export { app };
