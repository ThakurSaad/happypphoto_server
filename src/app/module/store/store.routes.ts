import { Router } from "express";
import { StoreController } from "./store.controller";
import auth from "../../middleware/auth";
import config from "../../../config";

const router = Router();

router.get(
  "/nearby",
  auth(config.auth_level.all),
  StoreController.getNearbyStores,
);
router.get(
  "/:id",
  auth(config.auth_level.all),
  StoreController.getStoreDetails,
);
router.get(
  "/:id/products",
  auth(config.auth_level.all),
  StoreController.getStoreProducts,
);

export const StoreRoutes = router;
