import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import postsRouter from "./posts";
import analyticsRouter from "./analytics";
import aiRouter from "./ai";
import queueRouter from "./queue";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountsRouter);
router.use(postsRouter);
router.use(analyticsRouter);
router.use(aiRouter);
router.use(queueRouter);
router.use(auditRouter);

export default router;
