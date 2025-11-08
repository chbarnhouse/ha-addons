/**
 * Tests for image processing (image-processor.js)
 */

import {
  validateImage,
  getDeviceSpec,
  getSupportedDeviceTypes,
} from "../src/image-processor.js";

describe("Image Processor (image-processor.js)", () => {
  describe("validateImage", () => {
    test("should validate valid PNG image", () => {
      const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const imageBuffer = Buffer.alloc(5000);
      pngSignature.copy(imageBuffer);

      const result = validateImage(imageBuffer);
      expect(result.valid).toBe(true);
    });

    test("should reject non-buffer input", () => {
      const result = validateImage("not a buffer");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Not a buffer");
    });

    test("should reject image that is too small", () => {
      const imageBuffer = Buffer.alloc(512);
      const result = validateImage(imageBuffer);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too small");
    });

    test("should reject image that is too large", () => {
      const imageBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB
      const result = validateImage(imageBuffer);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too large");
    });

    test("should warn about non-PNG/JPEG images", () => {
      const imageBuffer = Buffer.alloc(5000);
      imageBuffer[0] = 0xAA;
      imageBuffer[1] = 0xBB;

      const result = validateImage(imageBuffer);
      expect(result.valid).toBe(true); // Still valid, just warning
    });
  });

  describe("getDeviceSpec", () => {
    test("should return specs for OG device", () => {
      const spec = getDeviceSpec("og");
      expect(spec).not.toBeNull();
      expect(spec.width).toBe(800);
      expect(spec.height).toBe(480);
      expect(spec.colors).toBe(2);
    });

    test("should return specs for X device", () => {
      const spec = getDeviceSpec("x");
      expect(spec).not.toBeNull();
      expect(spec.width).toBe(1872);
      expect(spec.height).toBe(1404);
      expect(spec.colors).toBe(16);
    });

    test("should return null for unknown device", () => {
      const spec = getDeviceSpec("unknown");
      expect(spec).toBeNull();
    });

    test("should handle case insensitivity", () => {
      const spec1 = getDeviceSpec("OG");
      const spec2 = getDeviceSpec("og");
      expect(spec1).toEqual(spec2);
    });
  });

  describe("getSupportedDeviceTypes", () => {
    test("should return list of supported device types", () => {
      const types = getSupportedDeviceTypes();
      expect(types).toContain("og");
      expect(types).toContain("x");
    });

    test("should return array", () => {
      const types = getSupportedDeviceTypes();
      expect(Array.isArray(types)).toBe(true);
    });
  });

  describe("Device specifications", () => {
    test("OG device should be monochrome", () => {
      const spec = getDeviceSpec("og");
      expect(spec.colors).toBe(2); // Black and white
      expect(spec.method).toBe("floyd-steinberg");
    });

    test("X device should be grayscale", () => {
      const spec = getDeviceSpec("x");
      expect(spec.colors).toBe(16); // 16 gray levels
      expect(spec.method).toBe("kmeans");
    });

    test("OG max size should be reasonable", () => {
      const spec = getDeviceSpec("og");
      expect(spec.maxSize).toBeLessThan(200 * 1024); // Less than 200KB
    });

    test("X max size should be larger than OG", () => {
      const specOg = getDeviceSpec("og");
      const specX = getDeviceSpec("x");
      expect(specX.maxSize).toBeGreaterThan(specOg.maxSize);
    });
  });
});
