const { status } = require("http-status");

import User from "../user/User";
import { Product } from "../product/Product";
import ApiError from "../../../error/ApiError";
import QueryBuilder from "../../../builder/queryBuilder";

const getNearbyStores = async (query: any) => {
  const { longitude, latitude, maxDistance = 10000, ...restQuery } = query;

  if (!longitude || !latitude) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Longitude and latitude are required",
    );
  }

  const locationQuery = {
    role: "merchant",
    storeLocationCoordinates: {
      $nearSphere: {
        $geometry: {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
        $maxDistance: parseFloat(maxDistance),
      },
    },
  };

  const storeQuery = new QueryBuilder(User.find(locationQuery), restQuery)
    .search(["storeName", "storeDescription"])
    .filter()
    .paginate()
    .fields();

  const result = await storeQuery.modelQuery;
  const meta = await storeQuery.countTotal();

  return { meta, result };
};

const getStoreDetails = async (storeId: string) => {
  const store = await User.findOne({ _id: storeId, role: "merchant" });
  if (!store) {
    throw new ApiError(status.NOT_FOUND, "Store not found");
  }
  return store;
};

const getStoreProducts = async (storeId: string, query: any) => {
  // ensure store exists
  const store = await User.findOne({ _id: storeId, role: "merchant" });
  if (!store) {
    throw new ApiError(status.NOT_FOUND, "Store not found");
  }

  const productQuery = new QueryBuilder(
    Product.find({ merchant: storeId }),
    query,
  )
    .search(["name", "description", "category"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await productQuery.modelQuery;
  const meta = await productQuery.countTotal();

  return { meta, result };
};

export const StoreService = {
  getNearbyStores,
  getStoreDetails,
  getStoreProducts,
};
