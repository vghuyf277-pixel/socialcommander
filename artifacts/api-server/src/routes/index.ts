import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import postsRouter from "./posts";
import analyticsRouter from "./analytics";
import aiRouter from "./ai";
import queueRouter from "./queue";
import auditRouter from "./audit";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountsRouter);
router.use(postsRouter);
router.use(analyticsRouter);
router.use(aiRouter);
router.use(queueRouter);
router.use(auditRouter);
router.use(settingsRouter);

export default router;
