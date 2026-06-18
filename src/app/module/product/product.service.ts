const { status } = require("http-status");
import { Product } from "./Product";
import QueryBuilder from "../../../builder/queryBuilder";
import ApiError from "../../../error/ApiError";
import validateFields from "../../../util/validateFields";
import { Request } from "express";

const createProduct = async (req: Request) => {
  // Add your logic here
};

const getProduct = async (userData: any, query: any) => {
  validateFields(query, ["productId"]);

  const product = await Product.findOne({
    _id: query.productId,
  }).lean();

  if (!product) {
    throw new ApiError(status.NOT_FOUND, "Product not found");
  }

  return product;
};

const getAllProducts = async (userData: any, query: any) => {
  const productQuery = new QueryBuilder(Product.find({}).lean(), query)
    .search([])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [products, meta] = await Promise.all([
    productQuery.modelQuery,
    productQuery.countTotal(),
  ]);

  return {
    meta,
    products,
  };
};

const updateProduct = async (req: Request) => {
  // Add your logic here
};

const deleteProduct = async (userData: any, payload: any) => {
  validateFields(payload, ["productId"]);

  const product = await Product.deleteOne({
    _id: payload.productId,
  });

  if (!product.deletedCount) {
    throw new ApiError(status.NOT_FOUND, "Product not found");
  }

  return product;
};

const ProductService = {
  createProduct,
  getProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
};

export default ProductService;
