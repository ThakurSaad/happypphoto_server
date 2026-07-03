const { status } = require("http-status");
import ApiError from "../../../error/ApiError";
import validateFields from "../../../util/validateFields";
import Property from "./Property";
import User from "../user/User";
import generatePropertyCode from "../../../util/generatePropertyCode";
import QueryBuilder, { QueryParams } from "../../../builder/queryBuilder";
import type { Request } from "express";
import unlinkFile from "../../../util/unlinkFile";

const addProperty = async (req: Request) => {
  const { body: data, user: userData } = req;

  if (!userData) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }

  validateFields(data, [
    "propertyName",
    "propertyType",
    "physicalAddress",
    "city",
    "postalCode",
    "country",
  ]);

  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };

  const propertyCode = await generatePropertyCode();

  const propertyData: Record<string, any> = {
    hostId: userData.userId,
    propertyName: data.propertyName,
    propertyType: data.propertyType,
    physicalAddress: data.physicalAddress,
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    country: data.country,
    propertyCode,
  };

  if (data.lat && data.long) {
    propertyData.locationCoordinates = {
      type: "Point",
      coordinates: [parseFloat(data.long), parseFloat(data.lat)],
    };
  }

  if (files?.property_image) {
    propertyData.propertyImage = files.property_image[0].path;
  }

  const property = await Property.create(propertyData);
  return property;
};

const getProperties = async (userData: any, query: QueryParams) => {
  const propertyQuery = new QueryBuilder(
    Property.find({ hostId: userData.userId }).lean(),
    query,
  )
    .search(["propertyName", "propertyCode", "city"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [properties, meta] = await Promise.all([
    propertyQuery.modelQuery,
    propertyQuery.countTotal(),
  ]);

  return { meta, properties };
};

const getProperty = async (userData: any, query: { propertyId?: string }) => {
  validateFields(query, ["propertyId"]);

  const property = await Property.findById(query.propertyId).lean();
  if (!property) {
    throw new ApiError(status.NOT_FOUND, "Property not found");
  }

  // Ownership check (non-admin)
  if (
    userData.role !== "ADMIN" &&
    property.hostId.toString() !== userData.userId
  ) {
    throw new ApiError(
      status.FORBIDDEN,
      "You are not authorized to view this property",
    );
  }

  return property;
};

const updateProperty = async (req: Request) => {
  const { body: data, user: userData } = req;

  if (!userData) {
    throw new ApiError(status.UNAUTHORIZED, "Unauthorized");
  }

  validateFields(data, ["propertyId"]);

  const existingProperty = await Property.findById(data.propertyId);
  if (!existingProperty) {
    throw new ApiError(status.NOT_FOUND, "Property not found");
  }

  if (existingProperty.hostId.toString() !== userData.userId) {
    throw new ApiError(
      status.FORBIDDEN,
      "You are not authorized to update this property",
    );
  }

  const updateData: Record<string, any> = {};
  if (data.propertyName) updateData.propertyName = data.propertyName;
  if (data.propertyType) updateData.propertyType = data.propertyType;
  if (typeof data.isActive === "boolean") updateData.isActive = data.isActive;

  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };

  let replaceImage = false;
  if (files?.property_image) {
    updateData.propertyImage = files.property_image[0].path;
    replaceImage = true;
  }

  const updatedProperty = await Property.findByIdAndUpdate(
    data.propertyId,
    updateData,
    { returnDocument: "after", runValidators: true },
  );

  if (replaceImage && existingProperty.propertyImage) {
    unlinkFile(existingProperty.propertyImage);
  }

  return updatedProperty;
};

const deleteProperty = async (
  userData: any,
  payload: { propertyId?: string },
) => {
  validateFields(payload, ["propertyId"]);

  const property = await Property.findById(payload.propertyId);
  if (!property) {
    throw new ApiError(status.NOT_FOUND, "Property not found");
  }

  if (property.hostId.toString() !== userData.userId) {
    throw new ApiError(
      status.FORBIDDEN,
      "You are not authorized to delete this property",
    );
  }

  // Note: Check for active orders is done after Order model exists (Step 29+)
  // For now, just delete
  if (property.propertyImage) {
    unlinkFile(property.propertyImage);
  }

  await Property.deleteOne({ _id: payload.propertyId });
  return { message: "Property deleted successfully" };
};

const resolveCode = async (query: { propertyCode?: string }) => {
  validateFields(query, ["propertyCode"]);

  const property = await Property.findOne({
    propertyCode: query.propertyCode,
    isActive: true,
  }).lean();

  if (!property) {
    throw new ApiError(status.NOT_FOUND, "Property not found or inactive");
  }

  // Get host info for display
  const host = await User.findById(property.hostId)
    .select("businessName name")
    .lean();

  // NEVER expose physical address or coordinates
  return {
    propertyName: property.propertyName,
    propertyType: property.propertyType,
    hostCompany: host?.businessName || host?.name || "Host",
    city: property.city,
    state: property.state,
  };
};

const updateDeliveryRules = async (
  userData: any,
  payload: Record<string, any>,
) => {
  validateFields(payload, ["propertyId"]);

  const property = await Property.findById(payload.propertyId);
  if (!property) {
    throw new ApiError(status.NOT_FOUND, "Property not found");
  }

  if (property.hostId.toString() !== userData.userId) {
    throw new ApiError(
      status.FORBIDDEN,
      "You are not authorized to update this property",
    );
  }

  const deliveryRules: Record<string, any> = {};
  if (payload.defaultWindowStart)
    deliveryRules.defaultWindowStart = payload.defaultWindowStart;
  if (payload.defaultWindowEnd)
    deliveryRules.defaultWindowEnd = payload.defaultWindowEnd;
  if (payload.guestStayCheckIn)
    deliveryRules.guestStayCheckIn = new Date(payload.guestStayCheckIn);
  if (payload.guestStayCheckOut)
    deliveryRules.guestStayCheckOut = new Date(payload.guestStayCheckOut);

  const guestStayDates: Record<string, any> = {};
  if (payload.guestStayCheckIn)
    guestStayDates.checkIn = new Date(payload.guestStayCheckIn);
  if (payload.guestStayCheckOut)
    guestStayDates.checkOut = new Date(payload.guestStayCheckOut);

  const updatedProperty = await Property.findByIdAndUpdate(
    payload.propertyId,
    {
      deliveryRules,
      ...(Object.keys(guestStayDates).length > 0 && { guestStayDates }),
    },
    { returnDocument: "after", runValidators: true },
  );

  return updatedProperty;
};

const getDashboardStats = async (userData: any) => {
  const propertiesCount = await Property.countDocuments({
    hostId: userData.userId,
  });

  // These will be populated after DeliveryRequest model exists
  // For now, return zeros — updated in Step 46
  return {
    propertiesCount,
    pendingCount: 0,
    upcomingCount: 0,
    approvedCount: 0,
  };
};

const PropertyService = {
  addProperty,
  getProperties,
  getProperty,
  updateProperty,
  deleteProperty,
  resolveCode,
  updateDeliveryRules,
  getDashboardStats,
};

export { PropertyService };
