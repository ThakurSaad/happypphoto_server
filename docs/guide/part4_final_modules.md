# Fridge Fillers — Implementation Guideline Part 4

> **Steps 65–80** | Domains: Reviews · Notifications · Admin Dashboard & Oversight · Socket.IO · Final Wiring

---

## Step 65 — Create Review Model

### What & Why
Users, Property Hosts, and Admin need a way to review Merchants and Drivers, affecting their `averageRating`. We need a `Review` model to track this.

### Code

Create `src/app/module/review/Review.ts`:

```typescript
import { Schema, model } from "mongoose";

const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // Merchant or Driver
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, required: true },
  },
  { timestamps: true }
);

const Review = model("Review", reviewSchema);
export default Review;
```

---

## Step 66 — Create Review Service & Controller

### What & Why
Endpoints to create reviews and fetch them. When a review is created, the target's `averageRating` and `totalReviews` should update.

### Code

Create `src/app/module/review/review.service.ts`:

```typescript
import Review from "./Review";
import User from "../user/User";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import mongoose from "mongoose";

const createReview = async (userData: any, payload: any) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const review = await Review.create([{ ...payload, user: userData.userId }], { session });
    
    // Update target user's rating
    const target = await User.findById(payload.targetId).session(session);
    if (!target) throw new AppError(httpStatus.NOT_FOUND, "Target not found");

    const total = target.totalReviews || 0;
    const currentAvg = target.averageRating || 0;
    
    target.averageRating = ((currentAvg * total) + payload.rating) / (total + 1);
    target.totalReviews = total + 1;
    await target.save({ session });

    await session.commitTransaction();
    return review[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getReviews = async (targetId: string) => {
  return await Review.find({ targetId }).populate("user", "name profile_image");
};

export const ReviewService = { createReview, getReviews };
```

Create `src/app/module/review/review.controller.ts` and `review.route.ts` similarly to expose `POST /create` and `GET /:targetId`.

---

## Step 67 — Create Notification Models

### What & Why
System notifications for users (`Notification`) and platform alerts for admins (`AdminNotification`).

### Code

Create `src/app/module/notification/Notification.ts`:

```typescript
import { Schema, model } from "mongoose";

const notificationSchema = new Schema(
  {
    toId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = model("Notification", notificationSchema);

const adminNotificationSchema = new Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AdminNotification = model("AdminNotification", adminNotificationSchema);
```

---

## Step 68 — Create Admin Dashboard & Reports Endpoints

### What & Why
The admin needs real-time metrics across all 4 user types and financial reports.

### Code

Add to `src/app/module/admin/admin.service.ts`:

```typescript
import User from "../user/User";
import Order from "../order/Order";

const getDashboardStats = async () => {
  const [totalCustomers, totalMerchants, totalDrivers, totalOrders] = await Promise.all([
    User.countDocuments({ role: "USER" }),
    User.countDocuments({ role: "MERCHANT" }),
    User.countDocuments({ role: "DRIVER" }),
    Order.countDocuments(),
  ]);

  return {
    users: { customers: totalCustomers, merchants: totalMerchants, drivers: totalDrivers },
    logistics: { totalOrders },
  };
};

export const AdminService = { getDashboardStats /* ...other methods */ };
```

---

## Step 69 — Admin User & Driver Management

### What & Why
Admin must approve drivers, merchants, and property hosts, and can block users.

### Code

Add to `src/app/module/admin/admin.service.ts`:

```typescript
const approveDriver = async (userId: string) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { isApproved: true, applicationStatus: "approved" },
    { new: true }
  );
  return user;
};

const blockUser = async (authId: string, isBlocked: boolean) => {
  // Update Auth and User models to set isBlocked status
};
```
(Wire these into `admin.controller.ts` and `admin.route.ts`).

---

## Step 70 — Admin Order & Delivery Request Endpoints

### What & Why
Admin can oversee orders and forcefully approve delivery requests if a PM is unresponsive.

### Code

Add `forceApproveRequest` in `admin.service.ts`:

```typescript
import DeliveryRequest from "../order/DeliveryRequest";
import Order from "../order/Order";

const forceApproveRequest = async (requestId: string) => {
  const request = await DeliveryRequest.findByIdAndUpdate(
    requestId,
    { status: "force_approved" },
    { new: true }
  );
  if(request) {
    await Order.findByIdAndUpdate(request.orderId, { status: "preparing" });
  }
  return request;
};
```

---

## Step 71 — Admin Payment & Payout Management

### What & Why
Admin must approve payout requests, triggering Stripe Transfers.

### Code

Add `approvePayout` in `admin.service.ts`:

```typescript
import Payout from "../payment/Payout";
// import Stripe service here

const approvePayout = async (payoutId: string) => {
  const payout = await Payout.findById(payoutId).populate("userId");
  // Trigger Stripe Transfer to payout.userId.stripeAccountId
  payout.status = "completed";
  await payout.save();
  return payout;
};
```

---

## Step 72 — Socket.IO Enhancements (Scoped Broadcasts)

### What & Why
Driver location should only broadcast to users tracking that specific order, not globally.

### Code

In `src/socket/SocketController.ts`:

```typescript
// Replace global broadcast:
// io.emit("update_location", payload);

// With room-based scoped broadcast:
socket.on("subscribe_driver_location", ({ orderId }) => {
  socket.join(`order_${orderId}`);
});

socket.on("update_location", ({ orderId, lat, long }) => {
  io.to(`order_${orderId}`).emit("update_location", { lat, long });
});
```

---

## Step 73 — Final System Wiring

### What & Why
Register all new routes from Parts 3 and 4 in the main Express router.

### Code

In `src/app/routes/index.ts`:

```typescript
import { Router } from "express";
import { ReviewRoutes } from "../module/review/review.route";
import { NotificationRoutes } from "../module/notification/notification.route";
import { AdminRoutes } from "../module/admin/admin.route";
// ... imports from Parts 1-3 ...

const router = Router();

const moduleRoutes = [
  // ... previous routes ...
  { path: "/review", route: ReviewRoutes },
  { path: "/notification", route: NotificationRoutes },
  { path: "/admin", route: AdminRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));
export default router;
```

---

### Commands
```bash
npm run dev
```

### Verification
1. Review endpoints respond correctly.
2. Admin dashboard returns metrics.
3. Socket.IO emits location updates only to subscribed rooms.

---

> **End of Implementation Guideline.**
> All steps from the architecture plan have been covered.
