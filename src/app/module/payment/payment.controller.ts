const { default: status } = require("http-status");
import { PaymentService } from "./payment.service";
import sendResponse from "../../../util/sendResponse";
import catchAsync from "../../../util/catchAsync";
import type { Request, Response } from "express";
import ApiError from "../../../error/ApiError";

const createIntent = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  const result = await PaymentService.createIntent(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payment intent created",
    data: result,
  });
});

const getPayment = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  const result = await PaymentService.getPayment(req.user, req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payment retrieved",
    data: result,
  });
});

const refundPayment = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  const result = await PaymentService.refund(req.user, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Refund processed",
    data: result,
  });
});

const createConnectAccount = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  const result = await PaymentService.createConnectAccount(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Connect account created",
    data: result,
  });
});

const getConnectStatus = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  const result = await PaymentService.getConnectStatus(req.user);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Connect status retrieved",
    data: result,
  });
});

const PaymentController = {
  createIntent,
  getPayment,
  refundPayment,
  createConnectAccount,
  getConnectStatus,
};

export { PaymentController };
