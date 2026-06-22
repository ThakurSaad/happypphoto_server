const { status } = require("http-status");

// import status from "http-status";
import Auth from "../auth/Auth";
import User from "./User";
import deleteFalsyField from "../../../util/deleteFalsyField";
import ApiError from "../../../error/ApiError";
import unlinkFile from "../../../util/unlinkFile";
import { Request } from "express";
import { AuthUserPayload } from "../../../types/auth.types";
import { EnumUserRole } from "../../../util/enum";

const updateProfile = async (req: Request) => {
  const { body: data } = req;
  const { userId, authId } = req.user;
  const updateData: Record<string, any> = { ...data };
  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };

  deleteFalsyField(data);
  const existingUser = await User.findById(userId).lean();

  let hasNewImage = false;
  if (files && files.profile_image) {
    updateData.profile_image = files.profile_image[0].path;
    hasNewImage = true;
  }

  const [auth, user] = await Promise.all([
    Auth.findByIdAndUpdate(
      authId,
      { name: updateData.name },
      {
        returnDocument: "after",
      },
    ),
    User.findByIdAndUpdate(
      userId,
      { ...updateData },
      {
        returnDocument: "after",
      },
    ).populate("authId"),
  ]);

  if (!auth || !user) throw new ApiError(status.NOT_FOUND, "User not found!");

  if (hasNewImage && existingUser && existingUser.profile_image) {
    unlinkFile(existingUser.profile_image);
  }

  return user;
};

const getProfile = async (userData: AuthUserPayload) => {
  const { userId, authId } = userData;

  const [auth, result] = await Promise.all([
    Auth.findById(authId).lean(),
    User.findById(userId).populate("authId").lean(),
  ]);

  if (!auth || !result) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  if (auth.isBlocked) {
    throw new ApiError(status.FORBIDDEN, "You are blocked. Contact support");
  }

  return result;
};

const deleteMyAccount = async (payload: {
  email: string;
  password: string;
}) => {
  const { email, password } = payload;

  const [auth, user] = await Promise.all([
    Auth.findOne({ email }).select("+password").lean(),
    User.findOne({ email }).lean(),
  ]);

  if (!auth || !user) {
    throw new ApiError(status.NOT_FOUND, "User does not exist");
  }

  if (
    auth.password &&
    !(await Auth.isPasswordMatched(password, auth.password))
  ) {
    throw new ApiError(status.FORBIDDEN, "Password is incorrect");
  }

  if (user.profile_image) {
    unlinkFile(user.profile_image);
  }

  await Promise.all([
    Auth.deleteOne({ _id: auth._id }),
    User.deleteOne({ _id: user._id }),
  ]);
};

const updateDriverInformation = async (req: Request) => {
  const { body: data, user } = req;
  const { userId } = user;
  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };
  const updatedData: Record<string, any> = {
    licenseNumber: data.licenseNumber,
    plateNumber: data.plateNumber,
  };

  deleteFalsyField(data);
  const existingUser = await User.findById(userId).lean();

  if (!existingUser) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  if (existingUser.role !== EnumUserRole.DRIVER) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }

  let replaceDrivingLicense = false;
  let replaceIdCard = false;
  let replaceVehicleRegistration = false;

  if (files?.drivingLicense_image) {
    updatedData.drivingLicense_image = files.drivingLicense_image[0].path;
    replaceDrivingLicense = true;
  }

  if (files?.idCard_image) {
    updatedData.idCard_image = files.idCard_image[0].path;
    replaceIdCard = true;
  }

  if (files?.vehicleRegistration_image) {
    updatedData.vehicleRegistration_image =
      files.vehicleRegistration_image[0].path;
    replaceVehicleRegistration = true;
  }

  const [userFromDB] = await Promise.all([
    User.findByIdAndUpdate(userId, updatedData, {
      returnDocument: "after",
    }).populate("authId"),
  ]);

  if (replaceDrivingLicense && existingUser.drivingLicense_image) {
    unlinkFile(existingUser.drivingLicense_image);
  }

  if (replaceIdCard && existingUser.idCard_image) {
    unlinkFile(existingUser.idCard_image);
  }

  if (replaceVehicleRegistration && existingUser.vehicleRegistration_image) {
    unlinkFile(existingUser.vehicleRegistration_image);
  }

  return userFromDB;
};

const updateMerchantBusinessInformation = async (
  userData: AuthUserPayload,
  payload: Record<string, string>,
) => {
  const { storeName, businessType, businessRegistrationNumber, vatNumber } =
    payload;
  const { userId } = userData;

  deleteFalsyField(payload);
  const existingUser = await User.findById(userId).lean();

  if (!existingUser) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  if (existingUser.role !== EnumUserRole.MERCHANT) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }

  const updatedData: Record<string, string> = {
    storeName,
    businessType,
    businessRegistrationNumber,
    vatNumber,
  };

  const [userFromDB] = await Promise.all([
    User.findByIdAndUpdate(userId, updatedData, {
      returnDocument: "after",
    }),
  ]);

  return userFromDB;
};

const updateMerchantStoreLocation = async (
  userData: AuthUserPayload,
  payload: Record<string, number | string>,
) => {
  const {
    storeLocationCoordinatesLat,
    storeLocationCoordinatesLong,
    storeAddress,
    storeCity,
    storeState,
    storePostalCode,
    storeCountry,
  } = payload;
  const { userId } = userData;

  deleteFalsyField(payload);
  const existingUser = await User.findById(userId).lean();

  if (!existingUser) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  if (existingUser.role !== EnumUserRole.MERCHANT) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }

  const updatedData: Record<
    string,
    string | number | { coordinates: number[] }
  > = {
    storeLocationCoordinates: {
      coordinates: [
        Number(storeLocationCoordinatesLong),
        Number(storeLocationCoordinatesLat),
      ],
    },
    storeAddress,
    storeCity,
    storeState,
    storePostalCode,
    storeCountry,
  };

  const [userFromDB] = await Promise.all([
    User.findByIdAndUpdate(userId, updatedData, {
      returnDocument: "after",
    }),
  ]);

  return userFromDB;
};

const updateMerchantStoreProfile = async (req: Request) => {
  const {
    storeDescription,
    storeOpeningTime,
    storeClosingTime,
    storeAveragePrepTime,
  } = req.body;
  const { userId } = req.user;
  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };
  const updatedData: Record<string, any> = {
    storeDescription,
    storeOpeningTime,
    storeClosingTime,
    storeAveragePrepTime,
  };

  deleteFalsyField(updatedData);
  const existingUser = await User.findById(userId).lean();

  if (!existingUser) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  let replaceStoreLogo = false;
  let replaceStoreBannerImage = false;

  if (files?.store_logo) {
    updatedData.store_logo = files.store_logo[0].path;
    replaceStoreLogo = true;
  }

  if (files?.store_banner_image) {
    updatedData.store_banner_image = files.store_banner_image[0].path;
    replaceStoreBannerImage = true;
  }

  const [userFromDB] = await Promise.all([
    User.findByIdAndUpdate(userId, updatedData, {
      returnDocument: "after",
    }),
  ]);

  if (replaceStoreLogo && existingUser.store_logo) {
    unlinkFile(existingUser.store_logo);
  }

  if (replaceStoreBannerImage && existingUser.store_banner_image) {
    unlinkFile(existingUser.store_banner_image);
  }

  return userFromDB;
};

const updateMerchantDocument = async (req: Request) => {
  const { userId } = req.user;
  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };
  const updatedData: Record<string, any> = {};

  const existingUser = await User.findById(userId).lean();

  if (!existingUser) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  if (existingUser.role !== EnumUserRole.MERCHANT) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }

  let replaceStoreFrontImage = false;
  let replaceTradeLicenseDocument = false;
  let replaceMerchantIdCardImage = false;

  if (files?.store_front_image) {
    updatedData.store_front_image = files.store_front_image[0].path;
    replaceStoreFrontImage = true;
  }

  if (files?.trade_license_document) {
    updatedData.trade_license_document = files.trade_license_document[0].path;
    replaceTradeLicenseDocument = true;
  }

  if (files?.merchant_id_card_image) {
    updatedData.merchant_id_card_image = files.merchant_id_card_image[0].path;
    replaceMerchantIdCardImage = true;
  }

  const [userFromDB] = await Promise.all([
    User.findByIdAndUpdate(userId, updatedData, {
      returnDocument: "after",
    }),
  ]);

  if (replaceStoreFrontImage && existingUser.store_front_image) {
    unlinkFile(existingUser.store_front_image);
  }

  if (replaceTradeLicenseDocument && existingUser.trade_license_document) {
    unlinkFile(existingUser.trade_license_document);
  }

  if (replaceMerchantIdCardImage && existingUser.merchant_id_card_image) {
    unlinkFile(existingUser.merchant_id_card_image);
  }

  return userFromDB;
};

const UserService = {
  getProfile,
  deleteMyAccount,
  updateProfile,
  updateDriverInformation,
  updateMerchantBusinessInformation,
  updateMerchantStoreLocation,
  updateMerchantStoreProfile,
  updateMerchantDocument,
};

export { UserService };
