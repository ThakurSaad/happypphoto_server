# 📊 Summary Status

| Role          | Registration & Login          | Route Authorization | Profile Storage  | Status              |
| ------------- | ----------------------------- | ------------------- | ---------------- | ------------------- |
| USER          | ✅ Fully Functional           | ✅ Fully Authorized | User Collection  | Completed           |
| ADMIN         | ✅ Fully Functional           | ✅ Fully Authorized | Admin Collection | Completed           |
| PROPERTY_HOST | ⚠️ Partial (shares User flow) | ❌ Forbidden (403)  | User Collection  | Incomplete / Broken |
| DRIVER        | ⚠️ Partial (shares User flow) | ❌ Forbidden (403)  | User Collection  | Incomplete / Broken |
| MERCHANT      | ⚠️ Partial (shares User flow) | ❌ Forbidden (403)  | User Collection  | Incomplete / Broken |

---

# 🔍 Detailed Findings

## 1. Completed Roles (USER & ADMIN)

### USER

- **Registration & Login:**  
  In `auth.service.ts`, when registering as a `USER`, the system creates a credentials record in the `Auth` collection, sends an activation email, and inserts a profile document in the `User` collection.

- **Authorization:**  
  The auth middleware checks permissions using `config.auth_level.user` defined in `index.ts` as:

  ```ts
  ["USER", "ADMIN", "SUPER_ADMIN"];
  ```

  Since `"USER"` is present here, all user-protected routes (like `/profile`, `/edit-profile`, chat, notifications, etc.) are fully accessible.

### ADMIN

- **Registration & Login:**  
  Handled separately in `auth.service.ts`: it creates a profile document in the dedicated `Admin` collection instead of `User`, and bypasses sending the initial registration activation email.

- **Authorization:**  
  `"ADMIN"` is allowed on both admin-specific endpoints (under `config.auth_level.admin`) and user-level endpoints (under `config.auth_level.user`).

---

## 2. Incomplete / Broken Roles (PROPERTY_HOST, DRIVER & MERCHANT)

While these roles are defined in the role enum, their authentication and authorization flows are incomplete and non-functional.

### Role Definition Type-Mismatch

In `enum.ts`, the roles are defined as:

```ts
const EnumUserRole = {
  USER: "USER",
  PROPERTY_HOST: "PROPERTY_HOST",
  DRIVER: "DRIVER",
  MERCHANT: "MERCHANT",
  ADMIN: "ADMIN",
};
```

However, in the TypeScript types file `auth.types.ts`, the `AppRole` type is defined as:

```ts
export type AppRole = "USER" | "DRIVER" | "PROPERTY_OWNER" | "ADMIN";
```

- `MERCHANT` and `PROPERTY_HOST` are completely missing from the type definition.
- It uses `PROPERTY_OWNER` instead of `PROPERTY_HOST`.

### Registration & Login Mappings

- During registration, because they are not `ADMIN`, they default to the `User` collection profile creation.
- Although registration and login successfully issue a JWT containing the role (e.g. `role: "DRIVER"`), there are no separate collections or properties defined for their distinct profiles.

### Authorization Failure (403 Forbidden)

When a user logged in with a role of `PROPERTY_HOST`, `DRIVER`, or `MERCHANT` tries to access any protected endpoints guarded by the auth middleware (such as `/profile`, `/edit-profile`, chat, notifications), they will receive a **403 Forbidden** error.

This is because `auth.ts` validates if the token's role is in the endpoint's allowed list.

For user-protected endpoints, the allowed list is:

```ts
config.auth_level.user = ["USER", "ADMIN", "SUPER_ADMIN"];
```

which does not include:

- `PROPERTY_HOST`
- `DRIVER`
- `MERCHANT`
