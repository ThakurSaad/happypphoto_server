const { default: status } = require("http-status");
import ApiError from "../../../error/ApiError";
import Auth from "../auth/Auth";
import Admin from "./Admin";
import unlinkFile from "../../../util/unlinkFile";
import deleteFalsyField from "../../../util/deleteFalsyField";
import { Request } from "express";
import { AuthUserPayload } from "../../../types/auth.types";

import User from "../user/User";
import Order from "../order/Order";
import DeliveryRequest from "../order/DeliveryRequest";
import Property from "../property/Property";
import Payout from "../payment/Payout";
import QueryBuilder, { QueryParams } from "../../../builder/queryBuilder";

const updateProfile = async (req: Request) => {
  const { body: data } = req;
  const { userId, authId } = req.user as AuthUserPayload;
  const files = req.files as
    | {
        [fieldname: string]: Express.Multer.File[];
      }
    | undefined;

  const updatedData: Record<string, string> = {
    ...(data.address && { address: data.address }),
    ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
    ...(data.name && { name: data.name }),
  };

  deleteFalsyField(updatedData);
  const existingUser = await Admin.findById(userId).lean();

  let hasNewImage = false;
  if (files && files.profile_image) {
    updatedData.profile_image = files.profile_image[0].path;
    hasNewImage = true;
  }

  const [auth, admin] = await Promise.all([
    Auth.findByIdAndUpdate(
      authId,
      { name: updatedData.name },
      {
        returnDocument: "after",
      },
    ),
    Admin.findByIdAndUpdate(
      userId,
      { ...updatedData },
      {
        returnDocument: "after",
      },
    ).populate("authId"),
  ]);

  if (!auth || !admin) throw new ApiError(status.NOT_FOUND, "User not found!");

  if (hasNewImage && existingUser && existingUser.profile_image) {
    unlinkFile(existingUser.profile_image);
  }

  return admin;
};

const getProfile = async (userData: AuthUserPayload) => {
  const { userId, authId } = userData;

  const [auth, result] = await Promise.all([
    Auth.findById(authId).lean(),
    Admin.findById(userId).populate("authId").lean(),
  ]);

  if (!result || !auth) throw new ApiError(status.NOT_FOUND, "Admin not found");
  if (auth.isBlocked)
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");

  return result;
};

const deleteMyAccount = async (payload: {
  email: string;
  password: string;
}) => {
  const { email, password } = payload;

  const [auth, admin] = await Promise.all([
    Auth.findOne({ email }).select("+password").lean(),
    Admin.findOne({ email }).lean(),
  ]);

  if (!auth || !admin) {
    throw new ApiError(status.NOT_FOUND, "Admin does not exist");
  }
  if (
    auth.password &&
    !(await Auth.isPasswordMatched(password, auth.password))
  ) {
    throw new ApiError(status.FORBIDDEN, "Password is incorrect");
  }

  if (admin.profile_image) {
    unlinkFile(admin.profile_image);
  }

  await Promise.all([
    Auth.deleteOne({ _id: auth._id }),
    Admin.deleteOne({ _id: admin._id }),
  ]);
};

// --- User Management ---
const getAllUsers = async (query: QueryParams) => {
  const userQuery = new QueryBuilder(User.find(), query)
    .filter()
    .sort()
    .paginate();
  const [users, meta] = await Promise.all([
    userQuery.modelQuery,
    userQuery.countTotal(),
  ]);
  return { meta, users };
};

const blockUser = async (authId: string, isBlocked: boolean) => {
  const user = await Auth.findByIdAndUpdate(
    authId,
    { isBlocked },
    { new: true },
  );
  if (!user) throw new ApiError(status.NOT_FOUND, "User not found");
  return user;
};

const approveDriver = async (userId: string) => {
  return await User.findByIdAndUpdate(
    userId,
    { isApproved: true, applicationStatus: "approved" },
    { new: true },
  );
};

const rejectDriver = async (userId: string, reason?: string) => {
  return await User.findByIdAndUpdate(
    userId,
    { isApproved: false, applicationStatus: "rejected" },
    { new: true },
  );
};

const approveMerchant = async (userId: string) => {
  return await User.findByIdAndUpdate(
    userId,
    { isApproved: true },
    { new: true },
  );
};

const approvePropertyHost = async (userId: string) => {
  return await User.findByIdAndUpdate(
    userId,
    { isApproved: true },
    { new: true },
  );
};

// --- Order & Delivery Requests ---
const getAllOrders = async (query: QueryParams) => {
  const orderQuery = new QueryBuilder(
    Order.find().populate("customerId storeId"),
    query,
  )
    .filter()
    .sort()
    .paginate();
  const [orders, meta] = await Promise.all([
    orderQuery.modelQuery,
    orderQuery.countTotal(),
  ]);
  return { meta, orders };
};

const getAllDeliveryRequests = async (query: QueryParams) => {
  const requestQuery = new QueryBuilder(
    DeliveryRequest.find().populate("orderId hostId propertyId"),
    query,
  )
    .filter()
    .sort()
    .paginate();
  const [requests, meta] = await Promise.all([
    requestQuery.modelQuery,
    requestQuery.countTotal(),
  ]);
  return { meta, requests };
};

const forceApproveRequest = async (requestId: string) => {
  const request = await DeliveryRequest.findByIdAndUpdate(
    requestId,
    { status: "force_approved" },
    { new: true },
  );
  if (!request) throw new ApiError(status.NOT_FOUND, "Request not found");
  await Order.findByIdAndUpdate(request.orderId, { status: "preparing" });
  return request;
};

// --- Store & Property Management ---
const getAllStores = async (query: QueryParams) => {
  const storeQuery = new QueryBuilder(User.find({ role: "MERCHANT" }), query)
    .filter()
    .sort()
    .paginate();
  const [stores, meta] = await Promise.all([
    storeQuery.modelQuery,
    storeQuery.countTotal(),
  ]);
  return { meta, stores };
};

const getAllProperties = async (query: QueryParams) => {
  const propertyQuery = new QueryBuilder(
    Property.find().populate("hostId"),
    query,
  )
    .filter()
    .sort()
    .paginate();
  const [properties, meta] = await Promise.all([
    propertyQuery.modelQuery,
    propertyQuery.countTotal(),
  ]);
  return { meta, properties };
};

const flagProperty = async (propertyId: string, reason: string) => {
  return await Property.findByIdAndUpdate(
    propertyId,
    { isFlagged: true, flaggedReason: reason },
    { new: true },
  );
};

// --- Payments & Payouts ---
const getAllPayments = async (query: QueryParams) => {
  const payoutQuery = new QueryBuilder(Payout.find().populate("userId"), query)
    .filter()
    .sort()
    .paginate();
  const [transactions, meta] = await Promise.all([
    payoutQuery.modelQuery,
    payoutQuery.countTotal(),
  ]);
  return { meta, transactions };
};

const approvePayout = async (payoutId: string) => {
  const payout = await Payout.findById(payoutId).populate("userId");
  if (!payout) throw new ApiError(status.NOT_FOUND, "Payout not found");

  // Logic for Stripe Transfer would go here...

  payout.status = "completed";
  await payout.save();
  return payout;
};

const rejectPayout = async (payoutId: string, reason: string) => {
  return await Payout.findByIdAndUpdate(
    payoutId,
    { status: "rejected", note: reason },
    { new: true },
  );
};

// --- Dashboard & Reports ---
const getDashboardStats = async () => {
  const [totalCustomers, totalMerchants, totalDrivers, totalOrders] =
    await Promise.all([
      User.countDocuments({ role: "USER" }),
      User.countDocuments({ role: "MERCHANT" }),
      User.countDocuments({ role: "DRIVER" }),
      Order.countDocuments(),
    ]);

  return {
    users: {
      customers: totalCustomers,
      merchants: totalMerchants,
      drivers: totalDrivers,
    },
    logistics: { totalOrders },
  };
};

const AdminService = {
  updateProfile,
  getProfile,
  deleteMyAccount,
  getAllUsers,
  blockUser,
  approveDriver,
  rejectDriver,
  approveMerchant,
  approvePropertyHost,
  getAllOrders,
  getAllDeliveryRequests,
  forceApproveRequest,
  getAllStores,
  getAllProperties,
  flagProperty,
  getAllPayments,
  approvePayout,
  rejectPayout,
  getDashboardStats,
};

export { AdminService };
