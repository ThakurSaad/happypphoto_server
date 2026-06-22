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

    // merchant specific field
    storeName: {
      type: String,
    },
    businessType: {
      type: String,
    },
    businessRegistrationNumber: {
      type: String,
    },
    vatNumber: {
      type: String,
    },
    storeLocationCoordinates: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
      },
    },
    storeAddress: {
      type: String,
    },
    storeCity: {
      type: String,
    },
    storeState: {
      type: String,
    },
    storePostalCode: {
      type: String,
    },
    storeCountry: {
      type: String,
    },
    storeDescription: {
      type: String,
    },
    storeOpeningTime: {
      type: String,
    },
    storeClosingTime: {
      type: String,
    },
    storeAveragePrepTime: {
      type: Number,
    },
    store_logo: {
      type: String,
    },
    store_banner_image: {
      type: String,
    },
    store_front_image: {
      type: String,
    },
    trade_license_document: {
      type: String,
    },
    merchant_id_card_image: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

const User = model<IUser>("User", UserSchema);

export = User;
