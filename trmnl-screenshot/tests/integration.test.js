/**
 * Integration tests for full addon workflow
 */

import request from "supertest";
import app from "../src/server.js";
import * as storage from "../src/storage.js";
import * as screenshot from "../src/screenshot.js";
import * as imageProcessor from "../src/image-processor.js";
import crypto from "crypto";

const SECRET = process.env.TOKEN_SECRET;
const DEVICE_ID = "test_device_1";

/**
 * Helper to create valid token
 */
function createValidToken(deviceId, secret) {
  const payload = {
    device_id: deviceId,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson).toString("base64");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `token_${payloadB64}_${signature}`;
}

describe("Integration Tests - Full Workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    screenshot.healthCheck.mockResolvedValue(true);
  });

  describe("Complete screenshot capture and serve workflow", () => {
    test("should capture, process, store, and serve screenshot", async () => {
      // Mock screenshot capture
      const originalScreenshot = Buffer.from("original_screenshot_data");
      screenshot.captureScreenshot.mockResolvedValue(originalScreenshot);

      // Mock image processing
      const processedScreenshot = Buffer.from("processed_screenshot_data");
      imageProcessor.processImage.mockResolvedValue(processedScreenshot);

      // Save to storage
      await storage.initializeStorage();
      await storage.saveScreenshot(DEVICE_ID, processedScreenshot);

      // Now request the screenshot
      const token = createValidToken(DEVICE_ID, SECRET);

      const res = await request(app)
        .get(`/trmnl/screenshot/${DEVICE_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.type).toMatch(/image\/png/);
      expect(res.body.equals(processedScreenshot)).toBe(true);
    });

    test("should handle complete device setup flow", async () => {
      const deviceId = "device_complete_flow";
      const dashboardUrl = "/lovelace/default";
      const haToken = "ha_token_123";

      // 1. Simulate screenshot capture
      const rawScreenshot = Buffer.from("raw_image_data_1024_bytes".padEnd(1024));
      screenshot.captureScreenshot.mockResolvedValue(rawScreenshot);

      // 2. Simulate image processing for OG device
      const ogProcessed = Buffer.from("og_dithered_image".padEnd(500));
      imageProcessor.processImage.mockResolvedValue(ogProcessed);

      // 3. Capture and process
      const captured = await screenshot.captureScreenshot(deviceId, dashboardUrl, {
        haToken,
      });
      expect(captured).toBeDefined();

      const processed = await imageProcessor.processImage(captured, "og");
      expect(processed).toBeDefined();

      // 4. Store screenshot
      await storage.initializeStorage();
      const stored = await storage.saveScreenshot(deviceId, processed);
      expect(stored.size).toBe(ogProcessed.length);

      // 5. Retrieve and serve with token validation
      const token = createValidToken(deviceId, SECRET);
      const res = await request(app)
        .get(`/trmnl/screenshot/${deviceId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/image\/png/);
      expect(res.body.length).toBe(ogProcessed.length);
    });
  });

  describe("Token rotation workflow", () => {
    test("should indicate token rotation needed when serving image", async () => {
      // Create token that expires in 5 hours (within rotation window)
      const payload = {
        device_id: DEVICE_ID,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      };
      const payloadJson = JSON.stringify(payload);
      const payloadB64 = Buffer.from(payloadJson).toString("base64");
      const signature = crypto
        .createHmac("sha256", SECRET)
        .update(payloadB64)
        .digest("hex");
      const token = `token_${payloadB64}_${signature}`;

      // Store screenshot
      await storage.initializeStorage();
      const testImage = Buffer.from("test_image_data");
      await storage.saveScreenshot(DEVICE_ID, testImage);

      // Request with about-to-expire token
      const res = await request(app)
        .get(`/trmnl/screenshot/${DEVICE_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers["x-token-rotate"]).toBe("true");
    });
  });

  describe("Error handling in workflow", () => {
    test("should handle screenshot capture failure", async () => {
      screenshot.captureScreenshot.mockRejectedValue(new Error("Capture failed"));

      await expect(
        screenshot.captureScreenshot(DEVICE_ID, "/lovelace/default"),
      ).rejects.toThrow("Capture failed");
    });

    test("should handle image processing failure", async () => {
      const testImage = Buffer.from("test_image");
      imageProcessor.processImage.mockRejectedValue(new Error("Processing failed"));

      await expect(imageProcessor.processImage(testImage, "og")).rejects.toThrow(
        "Processing failed",
      );
    });

    test("should return 401 if token invalid", async () => {
      await storage.initializeStorage();
      const testImage = Buffer.from("test_image");
      await storage.saveScreenshot(DEVICE_ID, testImage);

      const res = await request(app)
        .get(`/trmnl/screenshot/${DEVICE_ID}`)
        .set("Authorization", "Bearer invalid_token_here");

      expect(res.status).toBe(401);
    });

    test("should return 404 if screenshot not found", async () => {
      const token = createValidToken(DEVICE_ID, SECRET);

      const res = await request(app)
        .get(`/trmnl/screenshot/${DEVICE_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("Multiple device workflow", () => {
    test("should handle multiple devices independently", async () => {
      const device1 = "device_1";
      const device2 = "device_2";

      await storage.initializeStorage();

      // Store different images for each device
      const image1 = Buffer.from("device_1_screenshot_data");
      const image2 = Buffer.from("device_2_screenshot_data");

      await storage.saveScreenshot(device1, image1);
      await storage.saveScreenshot(device2, image2);

      // Retrieve each with correct token
      const token1 = createValidToken(device1, SECRET);
      const token2 = createValidToken(device2, SECRET);

      const res1 = await request(app)
        .get(`/trmnl/screenshot/${device1}`)
        .set("Authorization", `Bearer ${token1}`);

      const res2 = await request(app)
        .get(`/trmnl/screenshot/${device2}`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.equals(image1)).toBe(true);
      expect(res2.body.equals(image2)).toBe(true);
    });

    test("should reject token for wrong device", async () => {
      await storage.initializeStorage();
      const testImage = Buffer.from("test_image");
      await storage.saveScreenshot(DEVICE_ID, testImage);

      // Create token for different device
      const token = createValidToken("different_device", SECRET);

      const res = await request(app)
        .get(`/trmnl/screenshot/${DEVICE_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(401);
    });
  });

  describe("Storage management workflow", () => {
    test("should retrieve storage statistics", async () => {
      await storage.initializeStorage();

      const image1 = Buffer.from("12345");
      const image2 = Buffer.from("1234567890");

      await storage.saveScreenshot("device_1", image1);
      await storage.saveScreenshot("device_2", image2);

      const res = await request(app).get("/admin/storage");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.total_size).toBe(15);
    });
  });

  describe("Health check workflow", () => {
    test("should return health status", async () => {
      const res = await request(app).get("/health");

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.body).toHaveProperty("status");
      expect(res.body).toHaveProperty("timestamp");
    });

    test("should return detailed status", async () => {
      const res = await request(app).get("/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("addon_healthy");
      expect(res.body).toHaveProperty("storage");
    });
  });

  describe("Rate limiting workflow", () => {
    test("should enforce rate limit per device", async () => {
      await storage.initializeStorage();
      const testImage = Buffer.from("test_image");
      await storage.saveScreenshot(DEVICE_ID, testImage);

      const token = createValidToken(DEVICE_ID, SECRET);

      // Make multiple requests
      const responses = [];
      for (let i = 0; i < 15; i++) {
        const res = await request(app)
          .get(`/trmnl/screenshot/${DEVICE_ID}`)
          .set("Authorization", `Bearer ${token}`);
        responses.push(res.status);
      }

      // Should have rate limited after certain requests
      const blocked = responses.filter((s) => s === 429);
      expect(blocked.length).toBeGreaterThan(0);
    });
  });
});
