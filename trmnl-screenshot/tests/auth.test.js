/**
 * Tests for token validation (auth.js)
 */

import crypto from "crypto";
import {
  validateToken,
  shouldRotateToken,
  getTokenInfo,
  TokenRateLimiter,
} from "../src/auth.js";

const SECRET = process.env.TOKEN_SECRET;
const DEVICE_ID = "test_device_1";

/**
 * Helper to create valid token
 */
function createValidToken(deviceId, secret, expiresInHours = 24) {
  const payload = {
    device_id: deviceId,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString(),
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson).toString("base64");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `token_${payloadB64}_${signature}`;
}

/**
 * Helper to create expired token
 */
function createExpiredToken(deviceId, secret) {
  return createValidToken(deviceId, secret, -1); // Expired 1 hour ago
}

describe("Token Validation (auth.js)", () => {
  describe("validateToken", () => {
    test("should validate a valid token", () => {
      const token = createValidToken(DEVICE_ID, SECRET);
      const result = validateToken(token, DEVICE_ID, SECRET);

      expect(result).not.toBeNull();
      expect(result.device_id).toBe(DEVICE_ID);
      expect(result.issued_at).toBeDefined();
      expect(result.expires_at).toBeDefined();
    });

    test("should reject token with mismatched device_id", () => {
      const token = createValidToken(DEVICE_ID, SECRET);
      const result = validateToken(token, "different_device", SECRET);

      expect(result).toBeNull();
    });

    test("should reject expired token", () => {
      const token = createExpiredToken(DEVICE_ID, SECRET);
      const result = validateToken(token, DEVICE_ID, SECRET);

      expect(result).toBeNull();
    });

    test("should reject token with invalid signature", () => {
      const token = createValidToken(DEVICE_ID, SECRET);
      const [prefix, payload] = token.split("_");
      const invalidToken = `${prefix}_${payload}_invalidsignature`;

      const result = validateToken(invalidToken, DEVICE_ID, SECRET);
      expect(result).toBeNull();
    });

    test("should reject malformed token", () => {
      const result = validateToken("invalid_token", DEVICE_ID, SECRET);
      expect(result).toBeNull();
    });

    test("should reject null/undefined token", () => {
      expect(validateToken(null, DEVICE_ID, SECRET)).toBeNull();
      expect(validateToken(undefined, DEVICE_ID, SECRET)).toBeNull();
    });

    test("should reject token with wrong secret", () => {
      const token = createValidToken(DEVICE_ID, SECRET);
      const result = validateToken(token, DEVICE_ID, "wrong_secret_key_1234567890123456789");

      expect(result).toBeNull();
    });

    test("should return age_seconds in token info", () => {
      const token = createValidToken(DEVICE_ID, SECRET);
      const result = validateToken(token, DEVICE_ID, SECRET);

      expect(result.age_seconds).toBeDefined();
      expect(result.age_seconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe("shouldRotateToken", () => {
    test("should return true for null token info", () => {
      expect(shouldRotateToken(null)).toBe(true);
    });

    test("should return false for fresh token", () => {
      const token = createValidToken(DEVICE_ID, SECRET);
      const tokenInfo = validateToken(token, DEVICE_ID, SECRET);

      expect(shouldRotateToken(tokenInfo)).toBe(false);
    });

    test("should return true for token within rotation window", () => {
      // Create token that expires in 5 hours (within 6h window)
      const payload = {
        device_id: DEVICE_ID,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      };
      const payloadJson = JSON.stringify(payload);
      const payloadB64 = Buffer.from(payloadJson).toString("base64");
      const signature = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("hex");
      const token = `token_${payloadB64}_${signature}`;

      const tokenInfo = validateToken(token, DEVICE_ID, SECRET);
      expect(shouldRotateToken(tokenInfo)).toBe(true);
    });
  });

  describe("getTokenInfo", () => {
    test("should extract token info without validation", () => {
      const token = createValidToken(DEVICE_ID, SECRET);
      const info = getTokenInfo(token);

      expect(info).not.toBeNull();
      expect(info.device_id).toBe(DEVICE_ID);
      expect(info.issued_at).toBeDefined();
      expect(info.expires_at).toBeDefined();
    });

    test("should return null for malformed token", () => {
      expect(getTokenInfo("invalid")).toBeNull();
      expect(getTokenInfo(null)).toBeNull();
    });
  });

  describe("TokenRateLimiter", () => {
    let limiter;

    beforeEach(() => {
      limiter = new TokenRateLimiter(5, 1000); // 5 attempts per 1 second
    });

    test("should allow requests within limit", () => {
      for (let i = 0; i < 5; i++) {
        expect(limiter.isAllowed(DEVICE_ID)).toBe(true);
      }
    });

    test("should block requests exceeding limit", () => {
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed(DEVICE_ID);
      }
      expect(limiter.isAllowed(DEVICE_ID)).toBe(false);
    });

    test("should track remaining attempts", () => {
      limiter.isAllowed(DEVICE_ID);
      limiter.isAllowed(DEVICE_ID);
      expect(limiter.getRemainingAttempts(DEVICE_ID)).toBe(3);
    });

    test("should reset after time window expires", (done) => {
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed(DEVICE_ID);
      }
      expect(limiter.isAllowed(DEVICE_ID)).toBe(false);

      setTimeout(() => {
        expect(limiter.isAllowed(DEVICE_ID)).toBe(true);
        done();
      }, 1100);
    });

    test("should allow reset for specific device", () => {
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed(DEVICE_ID);
      }
      expect(limiter.isAllowed(DEVICE_ID)).toBe(false);

      limiter.reset(DEVICE_ID);
      expect(limiter.isAllowed(DEVICE_ID)).toBe(true);
    });

    test("should track separate limits for different devices", () => {
      const device1 = "device_1";
      const device2 = "device_2";

      for (let i = 0; i < 5; i++) {
        limiter.isAllowed(device1);
      }

      expect(limiter.isAllowed(device1)).toBe(false);
      expect(limiter.isAllowed(device2)).toBe(true);
    });
  });
});
