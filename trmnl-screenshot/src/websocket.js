/**
 * WebSocket communication with HA Integration
 * Receives screenshot requests and sends results back
 */

import WebSocket from "ws";
import logger from "./logger.js";
import { captureScreenshot, initializeBrowser, closeBrowser } from "./screenshot.js";
import { processImage } from "./image-processor.js";
import { saveScreenshot } from "./storage.js";

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 5000;

/**
 * Connect to HA Integration WebSocket
 * @param {string} haUrl - Home Assistant URL
 * @param {string} token - HA access token
 * @returns {Promise<WebSocket>} WebSocket connection
 */
export async function connectWebSocket(haUrl, token) {
  return new Promise((resolve, reject) => {
    try {
      logger.info("Connecting to HA Integration WebSocket", { url: haUrl });

      // Build WebSocket URL
      const wsUrl = new URL(haUrl);
      wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
      wsUrl.pathname = "/api/websocket";

      ws = new WebSocket(wsUrl.toString());

      ws.on("open", () => {
        logger.info("WebSocket connected");
        reconnectAttempts = 0;

        // Send authentication
        ws.send(
          JSON.stringify({
            type: "auth",
            access_token: token,
          }),
        );
      });

      ws.on("message", (data) => {
        handleWebSocketMessage(JSON.parse(data));
      });

      ws.on("error", (error) => {
        logger.error("WebSocket error", { error: error.message });
        reject(error);
      });

      ws.on("close", () => {
        logger.warn("WebSocket disconnected");
        ws = null;
        attemptReconnect(haUrl, token);
      });

      // Give some time for auth response
      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          resolve(ws);
        }
      }, 1000);
    } catch (error) {
      logger.error("Failed to connect to WebSocket", { error: error.message });
      reject(error);
    }
  });
}

/**
 * Handle incoming WebSocket messages
 * @param {object} message - Parsed message from HA
 */
async function handleWebSocketMessage(message) {
  try {
    // Handle authentication result
    if (message.type === "auth_required") {
      logger.debug("Auth required");
      return;
    }

    if (message.type === "auth_ok") {
      logger.info("WebSocket authenticated");
      // Subscribe to addon commands
      sendWebSocketMessage({
        id: 1,
        type: "subscribe_events",
        event_type: "trmnl_addon_command",
      });
      return;
    }

    if (message.type === "auth_invalid") {
      logger.error("WebSocket authentication failed");
      return;
    }

    // Handle addon commands
    if (message.event_type === "trmnl_addon_command") {
      const command = message.data;
      handleAddonCommand(command);
      return;
    }

    // Handle WebSocket command responses
    if (message.id && message.type === "result") {
      logger.debug("WebSocket result", { id: message.id, success: message.success });
      return;
    }
  } catch (error) {
    logger.error("Failed to handle WebSocket message", { error: error.message });
  }
}

/**
 * Handle addon commands from Integration
 * @param {object} command - Command object
 */
async function handleAddonCommand(command) {
  try {
    const { id, type, device_id, dashboard_url, device_type, ha_token, ha_url } = command;

    logger.info(`Handling addon command: ${type} for device ${device_id}`);

    if (type === "trmnl/capture_screenshot") {
      await handleCaptureScreenshot(id, device_id, dashboard_url, device_type, ha_token, ha_url);
    } else if (type === "trmnl/health_check") {
      await handleHealthCheck(id);
    } else {
      logger.warn(`Unknown command type: ${type}`);
      sendWebSocketMessage({
        id,
        type: "result",
        success: false,
        error: `Unknown command: ${type}`,
      });
    }
  } catch (error) {
    logger.error("Error handling addon command", { error: error.message });
  }
}

/**
 * Handle screenshot capture command
 * @param {number} id - Command ID
 * @param {string} deviceId - Device ID
 * @param {string} dashboardUrl - HA dashboard URL
 * @param {string} deviceType - Device type (og or x)
 * @param {string} haToken - HA access token
 * @param {string} haUrl - HA URL
 */
async function handleCaptureScreenshot(id, deviceId, dashboardUrl, deviceType, haToken, haUrl) {
  try {
    if (!deviceId || !dashboardUrl) {
      throw new Error("Missing required parameters: device_id, dashboard_url");
    }

    // Initialize browser if needed
    if (!global.browser) {
      await initializeBrowser();
    }

    // Capture screenshot
    logger.info(`Capturing screenshot for device ${deviceId}`);
    const screenshot = await captureScreenshot(deviceId, dashboardUrl, {
      haToken,
      haUrl,
      width: 800, // Will be adjusted per device type
      height: 480,
    });

    // Process image for device
    logger.info(`Processing image for device type ${deviceType}`);
    const processed = await processImage(screenshot, deviceType);

    // Save to storage
    logger.info(`Saving processed image for device ${deviceId}`);
    const result = await saveScreenshot(deviceId, processed);

    // Send success response
    sendWebSocketMessage({
      id,
      type: "result",
      success: true,
      data: {
        device_id: deviceId,
        size: result.size,
        filename: result.filename,
        timestamp: new Date().toISOString(),
      },
    });

    logger.info(`Screenshot processing complete for device ${deviceId}`);
  } catch (error) {
    logger.error(`Screenshot capture failed for device ${deviceId}`, { error: error.message });
    sendWebSocketMessage({
      id,
      type: "result",
      success: false,
      error: error.message,
    });
  }
}

/**
 * Handle health check command
 * @param {number} id - Command ID
 */
async function handleHealthCheck(id) {
  try {
    const status = {
      addon_healthy: true,
      timestamp: new Date().toISOString(),
    };

    sendWebSocketMessage({
      id,
      type: "result",
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error("Health check failed", { error: error.message });
    sendWebSocketMessage({
      id,
      type: "result",
      success: false,
      error: error.message,
    });
  }
}

/**
 * Send message via WebSocket
 * @param {object} message - Message to send
 */
export function sendWebSocketMessage(message) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.warn("WebSocket not connected, cannot send message");
      return false;
    }

    ws.send(JSON.stringify(message));
    return true;
  } catch (error) {
    logger.error("Failed to send WebSocket message", { error: error.message });
    return false;
  }
}

/**
 * Attempt to reconnect to WebSocket
 * @param {string} haUrl - Home Assistant URL
 * @param {string} token - HA access token
 */
function attemptReconnect(haUrl, token) {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error("Max WebSocket reconnection attempts reached");
    return;
  }

  reconnectAttempts += 1;
  const delay = RECONNECT_DELAY_MS * reconnectAttempts;

  logger.info(`Attempting to reconnect to WebSocket (attempt ${reconnectAttempts})`, {
    delay_ms: delay,
  });

  setTimeout(() => {
    connectWebSocket(haUrl, token).catch((error) => {
      logger.error("Reconnection failed", { error: error.message });
    });
  }, delay);
}

/**
 * Disconnect WebSocket
 */
export async function disconnectWebSocket() {
  try {
    if (ws) {
      ws.close();
      ws = null;
      logger.info("WebSocket disconnected");
    }

    // Clean up resources
    await closeBrowser();
  } catch (error) {
    logger.error("Failed to disconnect WebSocket", { error: error.message });
  }
}

/**
 * Get WebSocket status
 * @returns {object} Connection status
 */
export function getWebSocketStatus() {
  return {
    connected: ws && ws.readyState === WebSocket.OPEN,
    ready_state: ws?.readyState || -1,
    reconnect_attempts: reconnectAttempts,
  };
}
