import type { Types, Document } from "mongoose";

export interface IUser extends Document {
  authId: Types.ObjectId;
  name: string;
  email: string;
  role: string;
  profile_image?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string;
  isOnline?: boolean;

  // property_host specific fields
  businessName?: string;

  // driver specific fields
  isApproved?: boolean;
  licenseNumber?: string;
  plateNumber?: string;
  drivingLicense_image?: string;
  idCard_image?: string;
  vehicleRegistration_image?: string;
  locationCoordinates?: {
    type: {
      type: string;
      enum: ["Point"];
    };
    coordinates: [number, number];
  };
}
