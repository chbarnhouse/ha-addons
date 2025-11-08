/**
 * Tests for file storage (storage.js)
 */

import fs from "fs";
import path from "path";
import {
  initializeStorage,
  saveScreenshot,
  getScreenshot,
  deleteScreenshot,
  listScreenshots,
  getStorageStats,
  cleanupOldScreenshots,
} from "../src/storage.js";

const TEST_STORAGE_DIR = "./test_screenshots";

describe("Storage (storage.js)", () => {
  beforeEach(() => {
    // Clean up test directory before each test
    if (fs.existsSync(TEST_STORAGE_DIR)) {
      fs.rmSync(TEST_STORAGE_DIR, { recursive: true });
    }
    // Create fresh test directory for each test
    fs.mkdirSync(TEST_STORAGE_DIR, { recursive: true });
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(TEST_STORAGE_DIR)) {
      fs.rmSync(TEST_STORAGE_DIR, { recursive: true });
    }
  });

  describe("initializeStorage", () => {
    test("should create storage directory if it does not exist", () => {
      const result = initializeStorage();
      expect(result).toBe(true);
      expect(fs.existsSync(TEST_STORAGE_DIR)).toBe(true);
    });

    test("should return true if directory already exists", () => {
      initializeStorage();
      const result = initializeStorage();
      expect(result).toBe(true);
    });
  });

  describe("saveScreenshot", () => {
    beforeEach(() => {
      initializeStorage();
    });

    test("should save screenshot to disk", async () => {
      const deviceId = "test_device_1";
      const imageBuffer = Buffer.from("mock_image_data");

      const result = await saveScreenshot(deviceId, imageBuffer);

      expect(result).toHaveProperty("path");
      expect(result).toHaveProperty("size");
      expect(result).toHaveProperty("filename");
      expect(result.size).toBe(imageBuffer.length);
      expect(result.filename).toBe("test_device_1.png");
    });

    test("should write correct data to file", async () => {
      const deviceId = "test_device_2";
      const imageBuffer = Buffer.from("test_image_content");

      await saveScreenshot(deviceId, imageBuffer);

      const filename = `${deviceId}.png`;
      const filepath = path.join(TEST_STORAGE_DIR, filename);
      const saved = fs.readFileSync(filepath);

      expect(saved).toEqual(imageBuffer);
    });

    test("should reject invalid deviceId", async () => {
      const imageBuffer = Buffer.from("test");

      await expect(saveScreenshot(null, imageBuffer)).rejects.toThrow();
      await expect(saveScreenshot("", imageBuffer)).rejects.toThrow();
    });

    test("should reject invalid image buffer", async () => {
      await expect(saveScreenshot("device_1", null)).rejects.toThrow();
      await expect(saveScreenshot("device_1", "not a buffer")).rejects.toThrow();
    });

    test("should overwrite existing screenshot", async () => {
      const deviceId = "test_device_3";
      const image1 = Buffer.from("image_v1");
      const image2 = Buffer.from("image_v2_longer");

      await saveScreenshot(deviceId, image1);
      const result = await saveScreenshot(deviceId, image2);

      expect(result.size).toBe(image2.length);
      const saved = await getScreenshot(deviceId);
      expect(saved).toEqual(image2);
    });
  });

  describe("getScreenshot", () => {
    beforeEach(async () => {
      initializeStorage();
      const deviceId = "test_device_1";
      const imageBuffer = Buffer.from("saved_image_data");
      await saveScreenshot(deviceId, imageBuffer);
    });

    test("should retrieve saved screenshot", async () => {
      const data = await getScreenshot("test_device_1");
      expect(data).toEqual(Buffer.from("saved_image_data"));
    });

    test("should return null for non-existent screenshot", async () => {
      const data = await getScreenshot("nonexistent_device");
      expect(data).toBeNull();
    });

    test("should reject invalid deviceId", async () => {
      await expect(getScreenshot(null)).rejects.toThrow();
      await expect(getScreenshot("")).rejects.toThrow();
    });
  });

  describe("deleteScreenshot", () => {
    beforeEach(async () => {
      initializeStorage();
      await saveScreenshot("test_device_1", Buffer.from("image_data"));
    });

    test("should delete existing screenshot", async () => {
      const result = await deleteScreenshot("test_device_1");
      expect(result).toBe(true);

      const data = await getScreenshot("test_device_1");
      expect(data).toBeNull();
    });

    test("should return false for non-existent screenshot", async () => {
      const result = await deleteScreenshot("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("listScreenshots", () => {
    beforeEach(async () => {
      initializeStorage();
      await saveScreenshot("device_1", Buffer.from("image_1"));
      await saveScreenshot("device_2", Buffer.from("image_2_larger"));
    });

    test("should list all screenshots", async () => {
      const list = await listScreenshots();

      expect(list.length).toBe(2);
      expect(list.some((s) => s.device_id === "device_1")).toBe(true);
      expect(list.some((s) => s.device_id === "device_2")).toBe(true);
    });

    test("should include size and timestamp", async () => {
      const list = await listScreenshots();

      const device1 = list.find((s) => s.device_id === "device_1");
      expect(device1).toHaveProperty("size");
      expect(device1).toHaveProperty("timestamp");
      expect(device1.size).toBe(7); // "image_1"
    });

    test("should return empty array for empty storage", async () => {
      // Create fresh storage
      if (fs.existsSync(TEST_STORAGE_DIR)) {
        fs.rmSync(TEST_STORAGE_DIR, { recursive: true });
      }
      initializeStorage();

      const list = await listScreenshots();
      expect(list).toEqual([]);
    });
  });

  describe("getStorageStats", () => {
    beforeEach(async () => {
      initializeStorage();
      await saveScreenshot("device_1", Buffer.from("12345"));
      await saveScreenshot("device_2", Buffer.from("1234567890"));
    });

    test("should calculate storage statistics", async () => {
      const stats = await getStorageStats();

      expect(stats.count).toBe(2);
      expect(stats.total_size).toBe(15); // 5 + 10
      expect(stats.average_size).toBe(7); // Math.round(15/2)
    });

    test("should include screenshot list", async () => {
      const stats = await getStorageStats();

      expect(Array.isArray(stats.screenshots)).toBe(true);
      expect(stats.screenshots.length).toBe(2);
    });

    test("should handle empty storage", async () => {
      if (fs.existsSync(TEST_STORAGE_DIR)) {
        fs.rmSync(TEST_STORAGE_DIR, { recursive: true });
      }
      initializeStorage();

      const stats = await getStorageStats();
      expect(stats.count).toBe(0);
      expect(stats.total_size).toBe(0);
      expect(stats.average_size).toBe(0);
    });
  });

  describe("cleanupOldScreenshots", () => {
    beforeEach(async () => {
      initializeStorage();
      // Create test files with modified times
      const now = Date.now();
      const device1Path = path.join(TEST_STORAGE_DIR, "device_old.png");
      const device2Path = path.join(TEST_STORAGE_DIR, "device_new.png");

      fs.writeFileSync(device1Path, Buffer.from("old_image"));
      fs.writeFileSync(device2Path, Buffer.from("new_image"));

      // Set old file to 25 hours ago
      fs.utimesSync(device1Path, now / 1000, (now - 25 * 60 * 60 * 1000) / 1000);
    });

    test("should delete old screenshots", async () => {
      const deleted = await cleanupOldScreenshots(24);

      expect(deleted).toBe(1);

      const list = await listScreenshots();
      expect(list.length).toBe(1);
      expect(list[0].device_id).toBe("device_new");
    });

    test("should not delete recent screenshots", async () => {
      const deleted = await cleanupOldScreenshots(48);

      expect(deleted).toBe(0);

      const list = await listScreenshots();
      expect(list.length).toBe(2);
    });

    test("should handle empty storage", async () => {
      if (fs.existsSync(TEST_STORAGE_DIR)) {
        fs.rmSync(TEST_STORAGE_DIR, { recursive: true });
      }
      initializeStorage();

      const deleted = await cleanupOldScreenshots(24);
      expect(deleted).toBe(0);
    });
  });
});
