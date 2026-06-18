import { Schema, model } from "mongoose";

const productSchema = new Schema(
  {},
  {
    timestamps: true,
  },
);

export const Product = model("Product", productSchema);
