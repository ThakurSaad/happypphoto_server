const { status } = require("http-status");
import ApiError from "../../../error/ApiError";
import validateFields from "../../../util/validateFields";
import Order from "./Order";
import DeliveryRequest from "./DeliveryRequest";
import Cart from "../cart/Cart";
import Property from "../property/Property";
import { Product } from "../product/Product";
import QueryBuilder, { QueryParams } from "../../../builder/queryBuilder";
import postNotification from "../../../util/postNotification";

const DELIVERY_FEE = 5;
const SERVICE_FEE = 2;
const PLATFORM_COMMISSION_RATE = 0.15;
const DRIVER_PAYOUT_PER_ORDER = 3;

const placeOrder = async (userData: any, payload: Record<string, any>) => {
  const {
    propertyCode,
    deliveryAddress,
    deliveryLat,
    deliveryLong,
    specialInstructions,
  } = payload;

  // Get cart
  const cart = await Cart.findOne({ userId: userData.userId });
  if (!cart || cart.items.length === 0) {
    throw new ApiError(status.BAD_REQUEST, "Cart is empty");
  }

  // Determine delivery type
  const isPropertyOrder = !!(propertyCode || cart.propertyCode);
  const resolvedPropertyCode = propertyCode || cart.propertyCode;

  let property: any = null;
  if (isPropertyOrder) {
    property = await Property.findOne({
      propertyCode: resolvedPropertyCode,
      isActive: true,
    });
    if (!property) {
      throw new ApiError(status.NOT_FOUND, "Property not found or inactive");
    }

    // Guest stay validation
    if (property.guestStayDates?.checkIn && property.guestStayDates?.checkOut) {
      const now = new Date();
      const checkIn = new Date(property.guestStayDates.checkIn);
      const checkOut = new Date(property.guestStayDates.checkOut);
      if (now < checkIn || now > checkOut) {
        throw new ApiError(
          status.BAD_REQUEST,
          "Orders cannot be placed outside the guest stay period",
        );
      }
    }
  } else if (!deliveryAddress) {
    throw new ApiError(
      status.BAD_REQUEST,
      "Either propertyCode or deliveryAddress is required",
    );
  }

  // Group cart items by merchantId
  const merchantGroups: Record<string, any[]> = {};
  for (const item of cart.items) {
    const merchantKey = item.merchantId.toString();
    if (!merchantGroups[merchantKey]) {
      merchantGroups[merchantKey] = [];
    }
    merchantGroups[merchantKey].push(item);
  }

  // Validate products and stock
  for (const item of cart.items) {
    const product = await Product.findById(item.productId);
    if (!product) {
      throw new ApiError(
        status.BAD_REQUEST,
        `Product not found: ${item.productId}`,
      );
    }
    if (!product.isAvailable || product.status !== "active") {
      throw new ApiError(
        status.BAD_REQUEST,
        `Product "${product.name}" is not available`,
      );
    }
    if (product.quantity < item.quantity) {
      throw new ApiError(
        status.BAD_REQUEST,
        `Insufficient stock for "${product.name}". Available: ${product.quantity}`,
      );
    }
  }

  const createdOrders: any[] = [];

  // Create one order per merchant
  for (const [merchantId, items] of Object.entries(merchantGroups)) {
    // Fetch product details for order items
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId).lean();
      if (!product) continue;

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        product_image: product.product_image,
      });

      // Decrement stock
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { quantity: -item.quantity },
      });
    }

    const platformCommission =
      Math.round(subtotal * PLATFORM_COMMISSION_RATE * 100) / 100;
    const merchantNetEarnings =
      Math.round((subtotal - platformCommission) * 100) / 100;
    const total = subtotal + DELIVERY_FEE + SERVICE_FEE;

    const orderData: Record<string, any> = {
      userId: userData.userId,
      merchantId,
      items: orderItems,
      subtotal,
      deliveryFee: DELIVERY_FEE,
      serviceFee: SERVICE_FEE,
      tax: 0,
      total,
      platformCommission,
      driverPayout: DRIVER_PAYOUT_PER_ORDER,
      merchantNetEarnings,
      specialInstructions,
    };

    if (isPropertyOrder) {
      orderData.status = "pending_host_approval";
      orderData.propertyId = property._id;
      orderData.propertyHostId = property.hostId;
      // Address NOT set yet — only revealed after PM approval
    } else {
      orderData.status = "pending";
      orderData.deliveryAddress = deliveryAddress;
      if (deliveryLat && deliveryLong) {
        orderData.deliveryCoordinates = {
          type: "Point",
          coordinates: [parseFloat(deliveryLong), parseFloat(deliveryLat)],
        };
      }
    }

    const order = await Order.create(orderData);
    createdOrders.push(order);

    if (isPropertyOrder) {
      // Create DeliveryRequest for PM
      await DeliveryRequest.create({
        orderId: order._id,
        propertyId: property._id,
        hostId: property.hostId,
        customerId: userData.userId,
      });

      // Notify property host
      await postNotification(
        "New Delivery Request",
        `New delivery request for ${property.propertyName} (${order.orderId})`,
        property.hostId,
      );
    } else {
      // Notify merchant
      await postNotification(
        "New Order Received",
        `New order ${order.orderId} received`,
        merchantId,
      );
    }
  }

  // Clear cart
  cart.items = [];
  cart.propertyCode = undefined;
  await cart.save();

  return createdOrders;
};

const getOrder = async (userData: any, query: Record<string, any>) => {
  validateFields(query, ["orderId"]);

  const order = await Order.findOne({ _id: query.orderId })
    .populate({
      path: "userId",
      select: "name email phoneNumber profile_image",
    })
    .populate({
      path: "merchantId",
      select: "storeName storeAddress store_logo storePhoneNumber",
    })
    .populate({
      path: "driverId",
      select: "name phoneNumber profile_image vehicleType locationCoordinates",
    })
    .populate({
      path: "propertyId",
      select: "propertyName propertyType propertyCode city",
    })
    .lean();

  if (!order) {
    throw new ApiError(status.NOT_FOUND, "Order not found");
  }

  // Hide delivery address for property-code orders still pending host approval
  if (order.status === "pending_host_approval" && userData.role === "USER") {
    delete (order as any).deliveryAddress;
    delete (order as any).deliveryCoordinates;
  }

  return order;
};

const getMyOrders = async (userData: any, query: QueryParams) => {
  const filter: Record<string, any> = {};

  switch (userData.role) {
    case "USER":
      filter.userId = userData.userId;
      break;
    case "MERCHANT":
      filter.merchantId = userData.userId;
      break;
    case "DRIVER":
      filter.driverId = userData.userId;
      break;
    case "PROPERTY_HOST":
      filter.propertyHostId = userData.userId;
      break;
    case "ADMIN":
      // Admin sees all
      break;
    default:
      filter.userId = userData.userId;
  }

  if (query.status) {
    filter.status = query.status;
    delete query.status;
  }

  const orderQuery = new QueryBuilder(
    Order.find(filter)
      .populate({ path: "userId", select: "name email profile_image" })
      .populate({ path: "merchantId", select: "storeName store_logo" })
      .populate({ path: "driverId", select: "name profile_image vehicleType" })
      .lean(),
    query,
  )
    .search(["orderId"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const [orders, meta] = await Promise.all([
    orderQuery.modelQuery,
    orderQuery.countTotal(),
  ]);

  return { meta, orders };
};

const getActiveOrders = async (userData: any, query: QueryParams) => {
  const filter = {
    driverId: userData.userId,
    status: {
      $in: ["driver_assigned", "picked_up", "out_for_delivery"],
    },
  };

  const orderQuery = new QueryBuilder(
    Order.find(filter)
      .populate({
        path: "userId",
        select: "name phoneNumber profile_image address",
      })
      .populate({
        path: "merchantId",
        select: "storeName storeAddress store_logo storePhoneNumber",
      })
      .lean(),
    query,
  )
    .sort()
    .paginate()
    .fields();

  const [orders, meta] = await Promise.all([
    orderQuery.modelQuery,
    orderQuery.countTotal(),
  ]);

  return { meta, orders };
};

const getPendingDeliveryRequests = async (
  userData: any,
  query: QueryParams,
) => {
  const filter = {
    status: "ready_for_pickup",
    driverId: { $exists: false },
  };

  const orderQuery = new QueryBuilder(
    Order.find(filter)
      .populate({
        path: "merchantId",
        select: "storeName storeAddress store_logo",
      })
      .select(
        "orderId items merchantId total driverPayout deliveryAddress createdAt",
      )
      .lean(),
    query,
  )
    .sort()
    .paginate()
    .fields();

  const [orders, meta] = await Promise.all([
    orderQuery.modelQuery,
    orderQuery.countTotal(),
  ]);

  return { meta, orders };
};

const trackOrder = async (userData: any, query: Record<string, any>) => {
  validateFields(query, ["orderId"]);

  const order = await Order.findOne({
    _id: query.orderId,
    userId: userData.userId,
  })
    .populate({
      path: "merchantId",
      select: "storeName storeAddress storeLocationCoordinates",
    })
    .populate({
      path: "driverId",
      select: "name phoneNumber profile_image vehicleType locationCoordinates",
    })
    .lean();

  if (!order) {
    throw new ApiError(status.NOT_FOUND, "Order not found");
  }

  return {
    order,
    driverLocation: (order as any).driverId?.locationCoordinates || null,
  };
};

// Continued in Step 30...
const OrderService = {
  placeOrder,
  getOrder,
  getMyOrders,
  getActiveOrders,
  getPendingDeliveryRequests,
  trackOrder,
};

export { OrderService };
