import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import assert from "assert/strict";

dotenv.config();

const BASE_URL = "http://localhost:8001";
const API_URL = "http://localhost:8001";

const report: string[] = ["# QA Testing Report - Part 1 (Using Node Assert)", ""];
let passed = 0;
let failed = 0;

function logResult(name: string, isSuccess: boolean, errorDetail: any = null) {
  if (isSuccess) {
    passed++;
    report.push(`✅ **${name}**: PASSED`);
  } else {
    failed++;
    report.push(`❌ **${name}**: FAILED`);
    if (errorDetail) {
      report.push(`   *Assertion Error: ${errorDetail}*`);
    }
  }
}

async function runTests() {
  try {
    await mongoose.connect(process.env.MONGO_URL as string);
    report.push("## Database Connection: Success");

    // Clean up
    await mongoose.connection.collection("auths").deleteMany({ email: /test.*@example\.com/ });
    await mongoose.connection.collection("users").deleteMany({ email: /test.*@example\.com/ });
    await mongoose.connection.collection("properties").deleteMany({ propertyName: /Test Property/ });
    await mongoose.connection.collection("products").deleteMany({ name: /Test Product/ });
    await mongoose.connection.collection("carts").deleteMany({});

    async function createAndLoginUser(email: string, role: string) {
      const regRes = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "QA Tester", email, password: "Password123!", confirmPassword: "Password123!", role }),
      });
      const regData = await regRes.json();
      assert.strictEqual(regData.success, true, `Registration failed: ${JSON.stringify(regData)}`);

      const authDoc = await mongoose.connection.collection("auths").findOne({ email });
      assert.ok(authDoc, "Auth document should exist in DB");
      assert.ok(authDoc.activationCode, "Activation code should exist in DB");

      const actRes = await fetch(`${API_URL}/auth/activate-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, activationCode: authDoc.activationCode }),
      });
      const actData = await actRes.json();
      assert.strictEqual(actData.success, true, `Activation failed: ${JSON.stringify(actData)}`);
      assert.ok(actData.data.accessToken, "Access token should be returned");

      return actData.data.accessToken;
    }

    report.push("## Testing Auth Routes (Step 8-9)");
    
    const hostEmail = `test.host.${Date.now()}@example.com`;
    let hostToken = "";
    try {
      hostToken = await createAndLoginUser(hostEmail, "PROPERTY_HOST");
      logResult("Register, Activate & Login PROPERTY_HOST", true);
    } catch (e: any) {
      logResult("Register, Activate & Login PROPERTY_HOST", false, e.message);
    }

    try {
      const changePassRes = await fetch(`${API_URL}/auth/change-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${hostToken}` },
        body: JSON.stringify({ oldPassword: "Password123!", newPassword: "NewPassword123!", confirmPassword: "NewPassword123!" }),
      });
      const changePassData = await changePassRes.json();
      assert.strictEqual(changePassData.success, true, "Change password response should be successful");
      
      const authDocAfterChange = await mongoose.connection.collection("auths").findOne({ email: hostEmail });
      assert.ok(authDocAfterChange, "Auth document should still exist");
      assert.ok(authDocAfterChange.password.startsWith("$2b$"), "Password should be bcrypt hashed");
      
      logResult("Change Password (auth_level.all fix & bcrypt hashing)", true);
    } catch (e: any) {
      logResult("Change Password (auth_level.all fix & bcrypt hashing)", false, e.message);
    }

    report.push("## Testing Property Routes (Step 17)");

    let propertyId = "";
    let propertyCode = "";
    try {
      const formData = new FormData();
      formData.append("propertyName", "Test Property Loft");
      formData.append("propertyType", "apartment");
      formData.append("physicalAddress", "123 QA St");
      formData.append("city", "QAVille");
      formData.append("postalCode", "12345");
      formData.append("country", "US");

      const addPropRes = await fetch(`${API_URL}/property/add-property`, {
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: formData as any,
      });
      const addPropData = await addPropRes.json();
      assert.strictEqual(addPropData.success, true, `Add property failed: ${JSON.stringify(addPropData)}`);
      assert.ok(addPropData.data._id, "Property should have an ID");
      assert.ok(addPropData.data.propertyCode, "Property should have a generated propertyCode");

      propertyId = addPropData.data._id;
      propertyCode = addPropData.data.propertyCode;
      logResult("Add Property", true);
    } catch (e: any) {
      logResult("Add Property", false, e.message);
    }

    try {
      const getPropsRes = await fetch(`${API_URL}/property/get-properties`, {
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      const getPropsData = await getPropsRes.json();
      assert.strictEqual(getPropsData.success, true, "Get properties should succeed");
      assert.ok(Array.isArray(getPropsData.data), "Data should be an array");
      assert.ok(getPropsData.data.length > 0, "Host should have at least one property");
      logResult("Get Properties List", true);
    } catch (e: any) {
      logResult("Get Properties List", false, e.message);
    }

    try {
      const formData = new FormData();
      formData.append("propertyId", propertyId);
      formData.append("propertyName", "Updated Test Property Loft");
      
      const updPropRes = await fetch(`${API_URL}/property/update-property`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: formData as any,
      });
      const updPropData = await updPropRes.json();
      assert.strictEqual(updPropData.success, true, "Update property should succeed");
      assert.strictEqual(updPropData.data.propertyName, "Updated Test Property Loft", "Property name should be updated");
      logResult("Update Property", true);
    } catch (e: any) {
      logResult("Update Property", false, e.message);
    }

    const userEmail = `test.user.${Date.now()}@example.com`;
    let userToken = "";
    try {
      userToken = await createAndLoginUser(userEmail, "USER");
      
      const resolveRes = await fetch(`${API_URL}/property/resolve-code?propertyCode=${propertyCode}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const resolveData = await resolveRes.json();
      assert.strictEqual(resolveData.success, true, `Resolve property failed: ${JSON.stringify(resolveData)}`);
      assert.strictEqual(resolveData.data.physicalAddress, undefined, "Physical address should NEVER be leaked");
      assert.ok(resolveData.data.propertyName, "Should return property name");
      logResult("Resolve Property Code (No Address Leaked)", true);
    } catch (e: any) {
      logResult("Resolve Property Code (No Address Leaked)", false, e.message);
    }

    report.push("## Testing Cart Routes (Step 23)");

    const merchantEmail = `test.merchant.${Date.now()}@example.com`;
    let merchantToken = "";
    let productId = "";
    try {
      merchantToken = await createAndLoginUser(merchantEmail, "MERCHANT");
      const merchantUser = await mongoose.connection.collection("users").findOne({ email: merchantEmail });
      assert.ok(merchantUser, "Merchant user must exist");
      
      const productObj = {
        merchant: merchantUser._id,
        name: "Test Product",
        product_image: "test.jpg",
        category: "Food",
        price: 10,
        quantity: 100,
        description: "Test Desc",
        isAvailable: true,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const pRes = await mongoose.connection.collection("products").insertOne(productObj);
      productId = pRes.insertedId.toString();
      assert.ok(productId, "Product should be inserted successfully");
      logResult("Mock Product Creation", true);
    } catch(e: any) {
      logResult("Mock Product Creation", false, e.message);
    }

    try {
      const addCartRes = await fetch(`${API_URL}/cart/add-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ productId, quantity: 2 })
      });
      const addCartData = await addCartRes.json();
      assert.strictEqual(addCartData.success, true, `Add item failed: ${JSON.stringify(addCartData)}`);
      assert.ok(addCartData.data.items.length > 0, "Cart items should not be empty");
      logResult("Add Item to Cart", true);
    } catch (e: any) {
      logResult("Add Item to Cart", false, e.message);
    }

    try {
      const getCartRes = await fetch(`${API_URL}/cart/get-cart`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const getCartData = await getCartRes.json();
      assert.strictEqual(getCartData.success, true, "Get cart should succeed");
      assert.ok(getCartData.data.items[0].productId, "Product inside cart items should be populated");
      logResult("Get Cart (Populated)", true);
    } catch(e: any) {
      logResult("Get Cart (Populated)", false, e.message);
    }

    try {
      const setCodeRes = await fetch(`${API_URL}/cart/set-property-code`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ propertyCode })
      });
      const setCodeData = await setCodeRes.json();
      assert.strictEqual(setCodeData.success, true, `Set property code failed: ${JSON.stringify(setCodeData)}`);
      assert.strictEqual(setCodeData.data.propertyCode, propertyCode, "Property code on cart should match");
      logResult("Set Property Code on Cart", true);
    } catch(e: any) {
      logResult("Set Property Code on Cart", false, e.message);
    }

    try {
      const clearCartRes = await fetch(`${API_URL}/cart/clear-cart`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const clearCartData = await clearCartRes.json();
      assert.strictEqual(clearCartData.success, true, "Clear cart should succeed");
      assert.strictEqual(clearCartData.data.items.length, 0, "Cart items should be empty after clearing");
      logResult("Clear Cart", true);
    } catch(e: any) {
      logResult("Clear Cart", false, e.message);
    }

    report.push("");
    report.push(`**Summary**: ${passed} Passed, ${failed} Failed`);

    const docsDir = path.join(process.cwd(), "docs");
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir);

    fs.writeFileSync(path.join(docsDir, "QA_Report_Part1.md"), report.join("\n"));
    console.log("Tests completed! Check docs/QA_Report_Part1.md");

  } catch(e) {
    console.error("Test execution failed:", e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
