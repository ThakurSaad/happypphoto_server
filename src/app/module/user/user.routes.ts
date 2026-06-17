import express from "express";
import auth from "../../middleware/auth";
import { uploadFile } from "../../middleware/fileUploader";
import { UserController } from "./user.controller";
import config from "../../../config";

const router = express.Router();

router
  .get("/profile", auth(config.auth_level.all), UserController.getProfile)
  .patch(
    "/edit-profile",
    auth(config.auth_level.all),
    uploadFile(),
    UserController.updateProfile,
  )
  .delete(
    "/delete-account",
    auth(config.auth_level.all),
    UserController.deleteMyAccount,
  )
  .patch(
    "/update-documents-driver",
    auth(config.auth_level.driver),
    uploadFile(),
    UserController.updateDocumentsForDriver,
  );

export = router;
