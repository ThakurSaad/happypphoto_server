import express from "express";
import auth from "../../middleware/auth";
import { uploadFile } from "../../middleware/fileUploader";
import { AdminController } from "./admin.controller";
import config from "../../../config";

const router = express.Router();

router
  .get("/profile", auth(config.auth_level.admin), AdminController.getProfile)
  .patch(
    "/edit-profile",
    auth(config.auth_level.admin),
    uploadFile(),
    AdminController.updateProfile,
  )
  .delete(
    "/delete-account",
    auth(config.auth_level.admin),
    AdminController.deleteMyAccount,
  )
  .get(
    "/get-all-users",
    auth(config.auth_level.admin),
    AdminController.getAllUsers,
  )
  .patch(
    "/block-user",
    auth(config.auth_level.admin),
    AdminController.blockUser,
  )
  .patch(
    "/approve-driver",
    auth(config.auth_level.admin),
    AdminController.approveDriver,
  )
  .patch(
    "/reject-driver",
    auth(config.auth_level.admin),
    AdminController.rejectDriver,
  )
  .patch(
    "/approve-merchant",
    auth(config.auth_level.admin),
    AdminController.approveMerchant,
  )
  .patch(
    "/approve-property-host",
    auth(config.auth_level.admin),
    AdminController.approvePropertyHost,
  )
  .get(
    "/get-all-orders",
    auth(config.auth_level.admin),
    AdminController.getAllOrders,
  )
  .get(
    "/get-all-delivery-requests",
    auth(config.auth_level.admin),
    AdminController.getAllDeliveryRequests,
  )
  .patch(
    "/force-approve-request",
    auth(config.auth_level.admin),
    AdminController.forceApproveRequest,
  )
  .get(
    "/get-all-stores",
    auth(config.auth_level.admin),
    AdminController.getAllStores,
  )
  .get(
    "/get-all-properties",
    auth(config.auth_level.admin),
    AdminController.getAllProperties,
  )
  .patch(
    "/flag-property",
    auth(config.auth_level.admin),
    AdminController.flagProperty,
  )
  .get(
    "/get-all-payments",
    auth(config.auth_level.admin),
    AdminController.getAllPayments,
  )
  .patch(
    "/approve-payout",
    auth(config.auth_level.admin),
    AdminController.approvePayout,
  )
  .patch(
    "/reject-payout",
    auth(config.auth_level.admin),
    AdminController.rejectPayout,
  )
  .get(
    "/dashboard",
    auth(config.auth_level.admin),
    AdminController.getDashboardStats,
  );

export = router;
