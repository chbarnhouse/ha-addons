/**
 * TRMNL Screenshot Addon - Main Entry Point
 * Orchestrates screenshot capture, image optimization, and HTTP serving
 */

import "dotenv/config";
import logger from "./logger.js";
import { startServer } from "./server.js";
import { initializeStorage, cleanupOldScreenshots } from "./storage.js";
import { initializeBrowser, closeBrowser } from "./screenshot.js";
import { connectWebSocket, disconnectWebSocket, getWebSocketStatus } from "./websocket.js";

let server = null;
let cleanupInterval = null;

const HA_URL = process.env.HA_URL || "http://homeassistant.local:8123";
const HA_TOKEN = process.env.HA_TOKEN || "";
const CLEANUP_INTERVAL_HOURS = 24;

/**
 * Initialize and start the addon
 */
async function start() {
  try {
    logger.info("======================================");
    logger.info("TRMNL Screenshot Addon Starting");
    logger.info("======================================");

    // Validate environment
    if (!HA_TOKEN) {
      throw new Error("HA_TOKEN environment variable not set");
    }

    if (!process.env.TOKEN_SECRET || process.env.TOKEN_SECRET.length < 32) {
      throw new Error("TOKEN_SECRET must be set and at least 32 characters");
    }

    // Initialize storage
    logger.info("Initializing storage...");
    const storageOk = initializeStorage();
    if (!storageOk) {
      throw new Error("Failed to initialize storage");
    }

    // Start HTTP server
    logger.info("Starting HTTP server...");
    server = await startServer();

    // Initialize Puppeteer
    logger.info("Initializing Puppeteer...");
    await initializeBrowser();

    // Connect to HA WebSocket
    logger.info("Connecting to Home Assistant WebSocket...");
    try {
      await connectWebSocket(HA_URL, HA_TOKEN);
    } catch (error) {
      logger.warn("Initial WebSocket connection failed, will retry", {
        error: error.message,
      });
      // Continue anyway - reconnect will be attempted
    }

    // Setup periodic cleanup
    logger.info("Setting up periodic cleanup...");
    cleanupInterval = setInterval(async () => {
      try {
        const deleted = await cleanupOldScreenshots(24); // 24 hour retention
        if (deleted > 0) {
          logger.info(`Cleaned up ${deleted} old screenshots`);
        }
      } catch (error) {
        logger.error("Cleanup failed", { error: error.message });
      }
    }, CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);

    // Setup graceful shutdown
    setupGracefulShutdown();

    logger.info("======================================");
    logger.info("TRMNL Screenshot Addon Ready");
    logger.info("======================================");
  } catch (error) {
    logger.error("Failed to start addon", { error: error.message });
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);

    try {
      // Stop cleanup interval
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }

      // Disconnect WebSocket
      await disconnectWebSocket();

      // Stop HTTP server
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }

      // Close browser
      await closeBrowser();

      logger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", { error: error.message });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error: error.message, stack: error.stack });
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled promise rejection", {
      reason: String(reason),
      promise: promise.toString(),
    });
    process.exit(1);
  });
}

/**
 * Periodic status logging
 */
function startStatusLogging() {
  setInterval(() => {
    const wsStatus = getWebSocketStatus();
    logger.info("Addon status", {
      websocket_connected: wsStatus.connected,
      ready_state: wsStatus.ready_state,
      uptime_seconds: Math.floor(process.uptime()),
    });
  }, 5 * 60 * 1000); // Every 5 minutes
}

// Start the addon
start();
startStatusLogging();
