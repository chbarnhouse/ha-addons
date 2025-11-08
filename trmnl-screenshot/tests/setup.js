/**
 * Jest setup file
 * Common test setup and teardown
 */

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.PORT = "3000";
process.env.HOST = "127.0.0.1";
process.env.HA_URL = "http://test.local:8123";
process.env.HA_TOKEN = "test_token_123";
process.env.TOKEN_SECRET = "test_secret_key_minimum_32_chars_1234567890";
process.env.DATA_PATH = "./test_data";
process.env.LOG_LEVEL = "error"; // Suppress logs during tests
process.env.SCREENSHOT_TIMEOUT = "10000";
process.env.SCREENSHOT_QUALITY = "90";

// Increase timeout for async operations
// Note: jest is injected by Jest but may not be available in ESM setup files
if (typeof jest !== "undefined") {
  jest.setTimeout(30000);
}

// Global test utilities
global.testUtils = {
  /**
   * Create a mock device ID
   */
  createDeviceId: (suffix = "1") => `device_${suffix}`,

  /**
   * Create a mock token
   */
  createMockToken: (deviceId, secret) => {
    const crypto = require("crypto");
    const payload = {
      device_id: deviceId,
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const payloadJson = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadJson).toString("base64");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payloadB64)
      .digest("hex");
    return `token_${payloadB64}_${signature}`;
  },

  /**
   * Create mock screenshot buffer
   */
  createMockScreenshot: (size = 1024) => {
    // Create a simple valid PNG buffer
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const data = Buffer.alloc(size);
    pngSignature.copy(data);
    return data;
  },
};
