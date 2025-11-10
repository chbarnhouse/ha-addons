/**
 * Token validation for TRMNL Screenshot Addon
 * Validates HMAC-signed tokens from HA Integration
 * Token format: token_<base64_payload>_<hex_signature>
 */

import crypto from "crypto";
import logger from "./logger.js";

const TOKEN_PREFIX = "token";
const TOKEN_SEPARATOR = "_";
// Note: Token TTL is 24 hours (defined in payload when token is created)

/**
 * Validate an HMAC-signed token
 * @param {string} token - Token to validate
 * @param {string} deviceId - Expected device ID
 * @param {string} secret - Token secret (same as Integration)
 * @returns {object|null} Token info if valid, null if invalid
 */
export function validateToken(token, deviceId, secret) {
  try {
    if (!token || !deviceId || !secret) {
      logger.logToken(deviceId, "validate", false, "missing parameters");
      return null;
    }

    // Parse token format: token_<base64_payload>_<hex_signature>
    const parts = token.split(TOKEN_SEPARATOR);
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
      logger.logToken(deviceId, "validate", false, "invalid format");
      return null;
    }

    const [, payloadB64, signature] = parts;

    // Decode payload
    let payloadJson;
    try {
      const payloadBuffer = Buffer.from(payloadB64, "base64");
      payloadJson = JSON.parse(payloadBuffer.toString());
    } catch (error) {
      logger.logToken(deviceId, "validate", false, "payload decode failed");
      return null;
    }

    // Verify device ID matches
    if (payloadJson.device_id !== deviceId) {
      logger.logToken(deviceId, "validate", false, "device_id mismatch");
      return null;
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadB64)
      .digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      logger.logToken(deviceId, "validate", false, "signature invalid");
      return null;
    }

    // Check expiration
    const expiresAt = new Date(payloadJson.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      const ageMinutes = Math.round((now - expiresAt) / (1000 * 60));
      logger.logToken(deviceId, "validate", false, `expired ${ageMinutes}m ago`);
      return null;
    }

    const ageSeconds = Math.round((now - new Date(payloadJson.issued_at)) / 1000);
    logger.logToken(deviceId, "validate", true);

    return {
      device_id: payloadJson.device_id,
      issued_at: payloadJson.issued_at,
      expires_at: payloadJson.expires_at,
      age_seconds: ageSeconds,
    };
  } catch (error) {
    logger.error("Token validation error", { error: error.message, deviceId });
    return null;
  }
}

/**
 * Check if token should be rotated
 * @param {object} tokenInfo - Token info from validateToken()
 * @returns {boolean} True if token is within rotation window (6h before expiry)
 */
export function shouldRotateToken(tokenInfo) {
  if (!tokenInfo) return true;

  try {
    const expiresAt = new Date(tokenInfo.expires_at);
    const now = new Date();
    const timeUntilExpiry = expiresAt - now;

    // Rotate if within 6 hours of expiry
    const rotationThreshold = 6 * 60 * 60 * 1000; // 6 hours in ms
    return timeUntilExpiry < rotationThreshold;
  } catch (error) {
    logger.error("Rotation check error", { error: error.message });
    return true; // Rotate if we can't determine
  }
}

/**
 * Extract token info without validation (for debugging)
 * NOTE: Only use for logging, always validate before using token
 * @param {string} token - Token string
 * @returns {object|null} Parsed token info or null if unparseable
 */
export function getTokenInfo(token) {
  try {
    if (!token) return null;

    const parts = token.split(TOKEN_SEPARATOR);
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
      return null;
    }

    const [, payloadB64] = parts;
    const payloadBuffer = Buffer.from(payloadB64, "base64");
    const payloadJson = JSON.parse(payloadBuffer.toString());

    return {
      device_id: payloadJson.device_id,
      issued_at: payloadJson.issued_at,
      expires_at: payloadJson.expires_at,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Rate limit tracker for token validation attempts
 * Prevents brute force attacks on token validation
 */
export class TokenRateLimiter {
  constructor(maxAttempts = 10, windowMs = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = new Map();
  }

  /**
   * Check if device has exceeded rate limit
   * @param {string} deviceId - Device ID
   * @returns {boolean} True if within rate limit, false if exceeded
   */
  isAllowed(deviceId) {
    const now = Date.now();
    const attempt = this.attempts.get(deviceId);

    if (!attempt) {
      this.attempts.set(deviceId, { count: 1, firstTime: now });
      return true;
    }

    // Clean up old attempts
    if (now - attempt.firstTime > this.windowMs) {
      this.attempts.set(deviceId, { count: 1, firstTime: now });
      return true;
    }

    // Check if limit exceeded
    if (attempt.count >= this.maxAttempts) {
      logger.warn(`Rate limit exceeded for device ${deviceId}`);
      return false;
    }

    // Increment counter
    attempt.count += 1;
    return true;
  }

  /**
   * Get remaining attempts for a device
   * @param {string} deviceId - Device ID
   * @returns {number} Remaining attempts
   */
  getRemainingAttempts(deviceId) {
    const attempt = this.attempts.get(deviceId);
    if (!attempt) return this.maxAttempts;

    const now = Date.now();
    if (now - attempt.firstTime > this.windowMs) {
      return this.maxAttempts;
    }

    return Math.max(0, this.maxAttempts - attempt.count);
  }

  /**
   * Reset attempts for a device
   * @param {string} deviceId - Device ID
   */
  reset(deviceId) {
    this.attempts.delete(deviceId);
  }

  /**
   * Clean up old attempts (call periodically)
   */
  cleanup() {
    const now = Date.now();
    for (const [deviceId, attempt] of this.attempts.entries()) {
      if (now - attempt.firstTime > this.windowMs * 2) {
        this.attempts.delete(deviceId);
      }
    }
  }
}

// Export rate limiter instance
export const tokenRateLimiter = new TokenRateLimiter();

// Periodic cleanup
setInterval(() => {
  tokenRateLimiter.cleanup();
}, 5 * 60 * 1000); // Every 5 minutes
