import { Schema, model } from "mongoose";
import type { IUser } from "./user.interface";
import { EnumUserRole } from "../../../util/enum";

const UserSchema = new Schema<IUser>(
  {
    authId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Auth",
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(EnumUserRole),
      required: true,
    },
    profile_image: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    dateOfBirth: {
      type: String,
    },
    address: {
      type: String,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },

    // property_host specific field
    businessName: {
      type: String,
    },

    // driver specific field
    isApproved: {
      type: Boolean,
    },
    licenseNumber: {
      type: String,
    },
    plateNumber: {
      type: String,
    },
    drivingLicense_image: {
      type: String,
    },
    idCard_image: {
      type: String,
    },
    vehicleRegistration_image: {
      type: String,
    },
    locationCoordinates: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
      },
    },
  },
  {
    timestamps: true,
  },
);

const User = model<IUser>("User", UserSchema);

export = User;
