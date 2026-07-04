import express from "express";
import auth from "../../middleware/auth";
import { PaymentController } from "./payment.controller";
import config from "../../../config";

const router = express.Router();

router
  .post(
    "/create-intent",
    auth(config.auth_level.user),
    PaymentController.createIntent,
  )
  .get(
    "/get-payment",
    auth(config.auth_level.all),
    PaymentController.getPayment,
  )
  .post(
    "/refund",
    auth(config.auth_level.admin),
    PaymentController.refundPayment,
  )
  .post(
    "/create-connect-account",
    auth(config.auth_level.all),
    PaymentController.createConnectAccount,
  )
  .get(
    "/connect-status",
    auth(config.auth_level.all),
    PaymentController.getConnectStatus,
  );

export = router;
