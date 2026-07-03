const EnumUserRole = {
  USER: "USER",
  PROPERTY_HOST: "PROPERTY_HOST",
  DRIVER: "DRIVER",
  MERCHANT: "MERCHANT",
  ADMIN: "ADMIN",
};

const EnumPaymentStatus = {
  SUCCEEDED: "succeeded",
  UNPAID: "unpaid",
};

const EnumSocketEvent = {
  CONNECTION: "connection",
  DISCONNECT: "disconnect",

  SOCKET_ERROR: "socket_error",
  ONLINE_STATUS: "online_status",
  UPDATE_LOCATION: "update_location",

  START_CHAT: "start_chat",
  SEND_MESSAGE: "send_message",
};

const EnumLoginProvider = {
  LOCAL: "local",
  GOOGLE: "google",
  APPLE: "apple",
};

const EnumUserAccountStatus = {
  VERIFIED: "verified",
  UNVERIFIED: "unverified",
};

const EnumVehicleType = {
  CAR: "CAR",
  VAN: "VAN",
  TRUCK: "TRUCK",
};

const EnumApplicationStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const EnumReviewType = {};

const EnumProductStatus = {};

export {
  EnumUserRole,
  EnumPaymentStatus,
  EnumSocketEvent,
  EnumLoginProvider,
  EnumUserAccountStatus,
  EnumVehicleType,
  EnumApplicationStatus,
  EnumReviewType,
  EnumProductStatus,
};
