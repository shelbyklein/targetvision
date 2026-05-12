import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import albumsRouter from "./albums";
import photosRouter from "./photos";
import searchRouter from "./search";
import tagsCategoriesRouter from "./tagsCategories";
import statsRouter from "./stats";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(albumsRouter);
router.use(photosRouter);
router.use(searchRouter);
router.use(tagsCategoriesRouter);
router.use(statsRouter);
router.use(storageRouter);

export default router;
