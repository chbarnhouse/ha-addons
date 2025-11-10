/**
 * Express HTTP server for TRMNL Screenshot Addon
 * Handles image serving, token validation, and health checks
 */

import express from "express";
import logger from "./logger.js";
import { validateToken, shouldRotateToken, tokenRateLimiter } from "./auth.js";
import { getScreenshot, getStorageStats } from "./storage.js";
import { healthCheck } from "./screenshot.js";

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "";

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// CORS headers (for HA Ingress)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

/**
 * Health check endpoint
 * GET /health
 */
app.get("/health", async (req, res) => {
  try {
    const isHealthy = await healthCheck();
    const status = isHealthy ? 200 : 503;

    res.status(status).json({
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Health check error", { error: error.message });
    res.status(503).json({ status: "error", error: error.message });
  }
});

/**
 * Detailed status endpoint
 * GET /status
 */
app.get("/status", async (req, res) => {
  try {
    const isHealthy = await healthCheck();
    const stats = await getStorageStats();

    res.json({
      addon_healthy: isHealthy,
      storage: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Status check error", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Image serving endpoint with token validation
 * GET /trmnl/screenshot/:device_id
 * Authorization: Bearer token_<base64_payload>_<hex_signature>
 */
app.get("/trmnl/screenshot/:device_id", async (req, res) => {
  try {
    const { device_id: deviceId } = req.params;
    const authHeader = req.headers.authorization || "";

    if (!deviceId) {
      return res.status(400).json({ error: "Missing device_id" });
    }

    // Rate limiting
    if (!tokenRateLimiter.isAllowed(deviceId)) {
      logger.warn(`Rate limit exceeded for device ${deviceId}`);
      return res.status(429).json({
        error: "Too many requests",
        retry_after: 60,
      });
    }

    // Extract token from Authorization header
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
    if (!tokenMatch) {
      logger.warn(`Missing or invalid authorization for device ${deviceId}`);
      return res.status(401).json({ error: "Missing or invalid authorization" });
    }

    const token = tokenMatch[1];

    // Validate token
    const tokenInfo = validateToken(token, deviceId, TOKEN_SECRET);
    if (!tokenInfo) {
      logger.warn(`Token validation failed for device ${deviceId}`);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Check if token needs rotation
    if (shouldRotateToken(tokenInfo)) {
      logger.info(`Token rotation recommended for device ${deviceId}`);
      res.set("X-Token-Rotate", "true");
    }

    // Get screenshot from storage
    const screenshot = await getScreenshot(deviceId);
    if (!screenshot) {
      logger.warn(`Screenshot not found for device ${deviceId}`);
      return res.status(404).json({ error: "Screenshot not found" });
    }

    // Serve image
    res.set("Content-Type", "image/png");
    res.set("Content-Length", screenshot.length);
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("X-Device-ID", deviceId);
    res.set("X-Served-At", new Date().toISOString());

    res.send(screenshot);
    logger.info(`Screenshot served for device ${deviceId}`, {
      size: screenshot.length,
      token_age_seconds: tokenInfo.age_seconds,
    });
  } catch (error) {
    logger.error(`Failed to serve screenshot for device ${req.params.device_id}`, {
      error: error.message,
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Storage management endpoint
 * GET /admin/storage
 * POST /admin/storage/cleanup
 */
app.get("/admin/storage", async (req, res) => {
  try {
    const stats = await getStorageStats();
    res.json(stats);
  } catch (error) {
    logger.error("Storage stats error", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Not found handler
 */
app.use((req, res) => {
  logger.debug(`Not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Not found" });
});

/**
 * Error handler
 */
app.use((error, req, res, _next) => {
  logger.error("Unhandled error", { error: error.message });
  res.status(500).json({ error: "Internal server error" });
});

/**
 * Start the server
 * @returns {Promise<http.Server>} Server instance
 */
export function startServer() {
  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(PORT, HOST, () => {
        logger.info("Server started", {
          host: HOST,
          port: PORT,
          url: `http://${HOST}:${PORT}`,
        });
        resolve(server);
      });

      server.on("error", (error) => {
        logger.error("Server error", { error: error.message });
        reject(error);
      });
    } catch (error) {
      logger.error("Failed to start server", { error: error.message });
      reject(error);
    }
  });
}

/**
 * Stop the server
 * @param {http.Server} server - Server instance
 * @returns {Promise<void>}
 */
export function stopServer(server) {
  return new Promise((resolve, reject) => {
    try {
      server.close(() => {
        logger.info("Server stopped");
        resolve();
      });
    } catch (error) {
      logger.error("Failed to stop server", { error: error.message });
      reject(error);
    }
  });
}

export default app;
