import express from "express";
import auth from "../../middleware/auth";
import { PaymentController } from "./payment.controller";
import config from "../../../config";

const router = express.Router();

router
  // Payment
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
  // Connect
  .post(
    "/create-connect-account",
    auth(config.auth_level.all),
    PaymentController.createConnectAccount,
  )
  .get(
    "/connect-status",
    auth(config.auth_level.all),
    PaymentController.getConnectStatus,
  )
  // Payouts & Earnings
  .post(
    "/request-withdrawal",
    auth(config.auth_level.all),
    PaymentController.requestWithdrawal,
  )
  .get(
    "/my-payouts",
    auth(config.auth_level.all),
    PaymentController.getMyPayouts,
  )
  .get(
    "/my-earnings",
    auth(config.auth_level.all),
    PaymentController.getMyEarnings,
  )
  .get(
    "/my-transactions",
    auth(config.auth_level.merchant),
    PaymentController.getMyTransactions,
  );

export = router;
