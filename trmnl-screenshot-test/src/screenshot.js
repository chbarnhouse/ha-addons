/**
 * Screenshot capture module using Puppeteer
 * Captures Home Assistant dashboards for TRMNL devices
 */

import puppeteer from "puppeteer";
import logger from "./logger.js";

let browser = null;

const TIMEOUT_MS = parseInt(process.env.SCREENSHOT_TIMEOUT || "30000", 10);
const QUALITY = parseInt(process.env.SCREENSHOT_QUALITY || "90", 10);
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_CAPTURES || "3", 10);

// Queue for concurrent capture limiting
let activeCaptures = 0;
const captureQueue = [];

/**
 * Initialize Puppeteer browser
 * @returns {Promise<object>} Browser instance
 */
export async function initializeBrowser() {
  try {
    if (browser) {
      return browser;
    }

    logger.info("Initializing Puppeteer browser");

    const launchOptions = {
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
      ],
    };

    // Use system chromium if available (e.g., in Docker)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchOptions);

    logger.info("Puppeteer browser initialized successfully");
    return browser;
  } catch (error) {
    logger.error("Failed to initialize Puppeteer browser", { error: error.message });
    browser = null;
    throw error;
  }
}

/**
 * Close Puppeteer browser
 * @returns {Promise<void>}
 */
export async function closeBrowser() {
  try {
    if (browser) {
      await browser.close();
      browser = null;
      logger.info("Puppeteer browser closed");
    }
  } catch (error) {
    logger.error("Failed to close browser", { error: error.message });
  }
}

/**
 * Wait for queue slot to become available
 * @returns {Promise<void>}
 */
async function waitForQueueSlot() {
  return new Promise((resolve) => {
    if (activeCaptures < MAX_CONCURRENT) {
      activeCaptures += 1;
      resolve();
    } else {
      captureQueue.push(() => {
        resolve();
      });
    }
  });
}

/**
 * Process next item in queue
 */
function processQueue() {
  if (captureQueue.length > 0) {
    const callback = captureQueue.shift();
    activeCaptures += 1;
    callback();
  } else {
    activeCaptures -= 1;
  }
}

/**
 * Capture screenshot of Home Assistant dashboard
 * @param {string} deviceId - Device ID
 * @param {string} dashboardUrl - URL of HA dashboard (e.g., /lovelace/living-room)
 * @param {object} options - Screenshot options
 * @returns {Promise<Buffer>} PNG image data
 */
export async function captureScreenshot(deviceId, dashboardUrl, options = {}) {
  // Get queue slot
  await waitForQueueSlot();

  try {
    if (!browser) {
      await initializeBrowser();
    }

    const {
      width = 800,
      height = 480,
      haToken = "",
      haUrl = process.env.HA_URL || "http://homeassistant.local:8123",
    } = options;

    logger.info(`Starting screenshot capture for device ${deviceId}`, {
      dashboard: dashboardUrl,
      resolution: `${width}x${height}`,
    });

    const page = await browser.newPage();

    try {
      // Set viewport size
      await page.setViewport({ width, height });

      // Set authentication header if token provided
      if (haToken) {
        await page.setExtraHTTPHeaders({
          Authorization: `Bearer ${haToken}`,
        });
      }

      // Build full URL
      const fullUrl = new URL(dashboardUrl, haUrl).toString();

      logger.debug(`Navigating to ${fullUrl}`);

      // Navigate to dashboard with retry logic
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.goto(fullUrl, {
            waitUntil: "networkidle2",
            timeout: TIMEOUT_MS,
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          logger.warn(`Navigation attempt ${attempt} failed for ${deviceId}: ${error.message}`);
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      if (lastError) {
        throw new Error(`Failed to navigate after 3 attempts: ${lastError.message}`);
      }

      // Wait for HA to load (custom element)
      try {
        await page.waitForSelector("home-assistant", { timeout: 5000 });
      } catch (error) {
        logger.warn(`home-assistant element not found for ${deviceId}, proceeding anyway`);
      }

      // Wait for any loading to complete
      await page.waitForTimeout(1000);

      // Take screenshot
      logger.debug(`Capturing screenshot for ${deviceId}`);

      const screenshotBuffer = await page.screenshot({
        type: "png",
        quality: QUALITY,
      });

      logger.info(`Screenshot captured for device ${deviceId}`, {
        size: screenshotBuffer.length,
        resolution: `${width}x${height}`,
      });

      return screenshotBuffer;
    } finally {
      // Always close page
      try {
        await page.close();
      } catch (error) {
        logger.warn(`Failed to close page for ${deviceId}`, { error: error.message });
      }
    }
  } catch (error) {
    logger.error(`Screenshot capture failed for device ${deviceId}`, {
      error: error.message,
    });
    throw error;
  } finally {
    // Release queue slot
    processQueue();
  }
}

/**
 * Get browser status
 * @returns {object} Status info
 */
export async function getBrowserStatus() {
  try {
    if (!browser) {
      return {
        connected: false,
        pages: 0,
      };
    }

    const pages = await browser.pages();
    return {
      connected: true,
      pages: pages.length,
      active_captures: activeCaptures,
      queued_captures: captureQueue.length,
    };
  } catch (error) {
    logger.error("Failed to get browser status", { error: error.message });
    return {
      connected: false,
      error: error.message,
    };
  }
}

/**
 * Health check for screenshot system
 * @returns {Promise<boolean>} True if system is healthy
 */
export async function healthCheck() {
  try {
    if (!browser) {
      return false;
    }

    // Try to get browser version (lightweight operation)
    const version = await browser.version();
    return version && version.length > 0;
  } catch (error) {
    logger.warn("Screenshot health check failed", { error: error.message });
    return false;
  }
}
