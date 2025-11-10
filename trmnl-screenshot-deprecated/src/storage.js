/**
 * File storage management for TRMNL screenshots
 * Handles writing, reading, and cleanup of screenshot files
 */

import fs from "fs";
import path from "path";
import { promisify } from "util";
import logger from "./logger.js";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

const SCREENSHOT_DIR = path.join(process.env.DATA_PATH || "/data", "screenshots");

/**
 * Initialize storage directories
 */
export function initializeStorage() {
  try {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      logger.info("Screenshot directory created", { path: SCREENSHOT_DIR });
    }
    return true;
  } catch (error) {
    logger.error("Failed to initialize storage", { error: error.message });
    return false;
  }
}

/**
 * Save screenshot to disk
 * @param {string} deviceId - Device ID
 * @param {Buffer} imageBuffer - PNG image data
 * @returns {Promise<object>} Result with path and size
 */
export async function saveScreenshot(deviceId, imageBuffer) {
  try {
    if (!deviceId || !imageBuffer) {
      throw new Error("Invalid parameters: deviceId and imageBuffer required");
    }

    const filename = `${deviceId}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    // Write file atomically (write to temp, then rename)
    const tempPath = `${filepath}.tmp`;
    await writeFile(tempPath, imageBuffer);
    await promisify(fs.rename)(tempPath, filepath);

    const fileSize = imageBuffer.length;
    logger.info(`Screenshot saved for device ${deviceId}`, {
      size: fileSize,
      path: filepath,
    });

    return {
      path: filepath,
      size: fileSize,
      filename,
    };
  } catch (error) {
    logger.error(`Failed to save screenshot for device ${deviceId}`, {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Read screenshot from disk
 * @param {string} deviceId - Device ID
 * @returns {Promise<Buffer|null>} Image data or null if not found
 */
export async function getScreenshot(deviceId) {
  try {
    if (!deviceId) {
      throw new Error("Invalid deviceId");
    }

    const filename = `${deviceId}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      logger.debug(`Screenshot not found for device ${deviceId}`);
      return null;
    }

    // Check file age (should be relatively recent)
    const stats = await stat(filepath);
    const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);

    if (ageMinutes > 60) {
      logger.warn(`Screenshot is stale for device ${deviceId}`, {
        age_minutes: Math.round(ageMinutes),
      });
    }

    const data = await readFile(filepath);
    logger.debug(`Screenshot retrieved for device ${deviceId}`, { size: data.length });
    return data;
  } catch (error) {
    logger.error(`Failed to read screenshot for device ${deviceId}`, {
      error: error.message,
    });
    return null;
  }
}

/**
 * Delete screenshot from disk
 * @param {string} deviceId - Device ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteScreenshot(deviceId) {
  try {
    if (!deviceId) {
      throw new Error("Invalid deviceId");
    }

    const filename = `${deviceId}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    if (!fs.existsSync(filepath)) {
      logger.debug(`Screenshot not found for deletion: ${deviceId}`);
      return false;
    }

    await unlink(filepath);
    logger.info(`Screenshot deleted for device ${deviceId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete screenshot for device ${deviceId}`, {
      error: error.message,
    });
    return false;
  }
}

/**
 * Get list of all stored screenshots
 * @returns {Promise<Array>} List of device IDs with screenshots
 */
export async function listScreenshots() {
  try {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      return [];
    }

    const files = fs.readdirSync(SCREENSHOT_DIR);
    const screenshots = files
      .filter((f) => f.endsWith(".png"))
      .map((f) => {
        const deviceId = f.replace(".png", "");
        const filepath = path.join(SCREENSHOT_DIR, f);
        const stats = fs.statSync(filepath);
        return {
          device_id: deviceId,
          filename: f,
          size: stats.size,
          timestamp: new Date(stats.mtimeMs).toISOString(),
        };
      });

    return screenshots;
  } catch (error) {
    logger.error("Failed to list screenshots", { error: error.message });
    return [];
  }
}

/**
 * Get storage statistics
 * @returns {Promise<object>} Storage usage info
 */
export async function getStorageStats() {
  try {
    const screenshots = await listScreenshots();
    const totalSize = screenshots.reduce((sum, s) => sum + s.size, 0);
    const totalCount = screenshots.length;

    return {
      count: totalCount,
      total_size: totalSize,
      average_size: totalCount > 0 ? Math.round(totalSize / totalCount) : 0,
      screenshots,
    };
  } catch (error) {
    logger.error("Failed to get storage stats", { error: error.message });
    return { count: 0, total_size: 0, average_size: 0, screenshots: [] };
  }
}

/**
 * Clean up old screenshots (older than maxAgeHours)
 * @param {number} maxAgeHours - Maximum age in hours
 * @returns {Promise<number>} Number of files deleted
 */
export async function cleanupOldScreenshots(maxAgeHours = 24) {
  try {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      return 0;
    }

    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    let deletedCount = 0;

    const files = fs.readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith(".png"));

    for (const file of files) {
      const filepath = path.join(SCREENSHOT_DIR, file);
      const stats = fs.statSync(filepath);
      const age = now - stats.mtimeMs;

      if (age > maxAgeMs) {
        await unlink(filepath);
        deletedCount += 1;
        logger.debug(`Cleaned up old screenshot: ${file}`);
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old screenshots`);
    }

    return deletedCount;
  } catch (error) {
    logger.error("Failed to cleanup old screenshots", { error: error.message });
    return 0;
  }
}
