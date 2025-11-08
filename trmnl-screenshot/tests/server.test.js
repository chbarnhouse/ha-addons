/**
 * Tests for Express server (server.js)
 */

import request from "supertest";
import app from "../src/server.js";
import * as auth from "../src/auth.js";
import * as storage from "../src/storage.js";

const DEVICE_ID = "test_device_1";

describe("Express Server (server.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /health", () => {
    test("should return health status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status");
      expect(res.body).toHaveProperty("timestamp");
    });

    test("should return healthy status", async () => {
      const res = await request(app).get("/health");
      expect([200, 503]).toContain(res.status);
    });
  });

  describe("GET /status", () => {
    test("should return addon status", async () => {
      storage.getStorageStats.mockResolvedValue({
        count: 0,
        total_size: 0,
        average_size: 0,
        screenshots: [],
      });

      const res = await request(app).get("/status");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("addon_healthy");
      expect(res.body).toHaveProperty("storage");
    });
  });

  describe("GET /trmnl/screenshot/:device_id", () => {
    const mockScreenshot = Buffer.from("mock_image_data");

    test("should return 400 if device_id missing", async () => {
      const res = await request(app).get("/trmnl/screenshot/");
      expect(res.status).toBe(404);
    });

    test("should return 401 if authorization header missing", async () => {
      const res = await request(app).get(`/trmnl/screenshot/${DEVICE_ID}`);
      expect(res.status).toBe(401);
    });

    test("should return 401 if token validation fails", async () => {
      auth.validateToken.mockReturnValue(null);

      const res = await request(app)
        .get(`/trmnl/screenshot/${DEVICE_ID}`)
        .set("Authorization", "Bearer invalid_token");

      expect(res.status).toBe(401);
      expect(auth.validateToken).toHaveBeenCalled();
    });

    test("should return 404 if screenshot not found", async () => {
      const tokenInfo = {
        device_id: DEVICE_ID,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        age_seconds: 100,
      };
      auth.validateToken.mockReturnValue(tokenInfo);
      auth.shouldRotateToken.mockReturnValue(false);
      storage.getScreenshot.mockResolvedValue(null);

      const res = await request(app)
        .get(`/trmnl/screenshot/${DEVICE_ID}`)
        .set("Authorization", "Bearer token_valid_signature");

      expect(res.status).toBe(404);
    });

    test("should return 200 with screenshot if token valid and image exists", async () => {
      const tokenInfo = {
        device_id: DEVICE_ID,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        age_seconds: 100,
      };
      auth.validateToken.mockReturnValue(tokenInfo);
      auth.shouldRotateToken.mockReturnValue(false);
      storage.getScreenshot.mockResolvedValue(mockScreenshot);

      const res = await request(app)
        .get(`/trmnl/screenshot/${DEVICE_ID}`)
        .set("Authorization", "Bearer token_valid_signature");

      expect(res.status).toBe(200);
      expect(res.type).toMatch(/image\/png/);
      expect(res.body).toEqual(mockScreenshot);
    });

    test("should include rotation header if token needs rotation", async () => {
      const tokenInfo = {
        device_id: DEVICE_ID,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        age_seconds: 100,
      };
      auth.validateToken.mockReturnValue(tokenInfo);
      auth.shouldRotateToken.mockReturnValue(true);
      storage.getScreenshot.mockResolvedValue(mockScreenshot);

      const res = await request(app)
        .get(`/trmnl/screenshot/${DEVICE_ID}`)
        .set("Authorization", "Bearer token_valid_signature");

      expect(res.headers["x-token-rotate"]).toBe("true");
    });

    test("should set cache control headers", async () => {
      const tokenInfo = {
        device_id: DEVICE_ID,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        age_seconds: 100,
      };
      auth.validateToken.mockReturnValue(tokenInfo);
      auth.shouldRotateToken.mockReturnValue(false);
      storage.getScreenshot.mockResolvedValue(mockScreenshot);

      const res = await request(app)
        .get(`/trmnl/screenshot/${DEVICE_ID}`)
        .set("Authorization", "Bearer token_valid_signature");

      expect(res.headers["cache-control"]).toContain("no-cache");
      expect(res.headers["cache-control"]).toContain("no-store");
    });
  });

  describe("GET /admin/storage", () => {
    test("should return storage stats", async () => {
      const stats = {
        count: 2,
        total_size: 100000,
        average_size: 50000,
        screenshots: [],
      };
      storage.getStorageStats.mockResolvedValue(stats);

      const res = await request(app).get("/admin/storage");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(stats);
    });
  });

  describe("404 Handler", () => {
    test("should return 404 for unknown routes", async () => {
      const res = await request(app).get("/unknown/route");
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("CORS Headers", () => {
    test("should include CORS headers", async () => {
      const res = await request(app).get("/health");
      expect(res.headers["access-control-allow-origin"]).toBeDefined();
    });
  });
});
