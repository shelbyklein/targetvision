import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import albumsRouter from "./albums";
import photosRouter from "./photos";
import searchRouter from "./search";
import tagsCategoriesRouter from "./tagsCategories";
import statsRouter from "./stats";
import storageRouter from "./storage";
import collectionsRouter from "./collections";
import projectsRouter from "./projects";
import assetsRouter from "./assets";
import adminRouter from "./admin";
import bulkUploadBatchesRouter from "./bulkUploadBatches";
import attributionTagsRouter from "./attributionTags";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(albumsRouter);
// Before photosRouter so its /photos/... routes are never shadowed.
router.use(attributionTagsRouter);
router.use(photosRouter);
router.use(searchRouter);
router.use(tagsCategoriesRouter);
router.use(statsRouter);
router.use(storageRouter);
router.use(collectionsRouter);
router.use(projectsRouter);
router.use(assetsRouter);
router.use(adminRouter);
router.use(bulkUploadBatchesRouter);

export default router;
