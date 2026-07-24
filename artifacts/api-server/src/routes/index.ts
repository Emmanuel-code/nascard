import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ocrRouter from "./ocr";
import whopRouter from "./whop";
import organizationsRouter from "./organizations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ocrRouter);
router.use(whopRouter);
router.use(organizationsRouter);

export default router;
