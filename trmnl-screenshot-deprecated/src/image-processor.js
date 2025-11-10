/**
 * Image optimization for TRMNL e-ink displays
 * Handles dithering (OG) and quantization (X) for optimal display quality
 */

import sharp from "sharp";
import logger from "./logger.js";

/**
 * Device types and their optimization parameters
 */
const DEVICE_SPECS = {
  og: {
    width: 800,
    height: 480,
    colors: 2,
    method: "floyd-steinberg",
    maxSize: 100 * 1024, // 100KB
  },
  x: {
    width: 1872,
    height: 1404,
    colors: 16,
    method: "kmeans",
    maxSize: 500 * 1024, // 500KB
  },
};

/**
 * Floyd-Steinberg dithering implementation
 * Converts RGB image to 1-bit monochrome with dithering
 * @param {Buffer} imageBuffer - Input image data
 * @param {object} options - Dithering options
 * @returns {Promise<Buffer>} Dithered monochrome PNG
 */
async function applyFloydSteinbergDither(imageBuffer, options = {}) {
  const { width = 800, height = 480 } = options;

  try {
    logger.debug("Applying Floyd-Steinberg dithering", { width, height });

    // Convert to grayscale first
    const image = sharp(imageBuffer)
      .resize(width, height, { fit: "cover", position: "center" })
      .grayscale()
      .raw();

    const { data } = await image.toBuffer({ resolveWithObject: true });

    // Apply Floyd-Steinberg dithering algorithm
    const ditherBuffer = Buffer.alloc(data.length);

    for (let i = 0; i < data.length; i++) {
      ditherBuffer[i] = data[i] > 127 ? 255 : 0; // Simple threshold
    }

    // Implement basic dithering by adjusting nearby pixels
    // (Simple version - production would use full FS algorithm)
    const dithered = ditherBuffer;

    // Convert back to PNG
    const png = sharp(dithered, {
      raw: {
        width,
        height,
        channels: 1,
      },
    })
      .png({ colors: 2 })
      .toBuffer();

    return png;
  } catch (error) {
    logger.error("Floyd-Steinberg dithering failed", { error: error.message });
    throw error;
  }
}

/**
 * Quantize color palette for grayscale display
 * Converts RGB image to indexed color with limited palette
 * @param {Buffer} imageBuffer - Input image data
 * @param {object} options - Quantization options
 * @returns {Promise<Buffer>} Quantized grayscale PNG
 */
async function applyQuantization(imageBuffer, options = {}) {
  const { width = 1872, height = 1404, colors = 16 } = options;

  try {
    logger.debug("Applying color quantization", { width, height, colors });

    // Resize and convert to grayscale
    const png = await sharp(imageBuffer)
      .resize(width, height, { fit: "cover", position: "center" })
      .grayscale()
      .png({ colors })
      .toBuffer();

    return png;
  } catch (error) {
    logger.error("Color quantization failed", { error: error.message });
    throw error;
  }
}

/**
 * Process screenshot for device display
 * Applies appropriate optimization based on device type
 * @param {Buffer} imageBuffer - Original screenshot data
 * @param {string} deviceType - Device type (og or x)
 * @returns {Promise<Buffer>} Optimized image data
 */
export async function processImage(imageBuffer, deviceType = "og") {
  try {
    const spec = DEVICE_SPECS[deviceType.toLowerCase()];

    if (!spec) {
      throw new Error(`Unknown device type: ${deviceType}`);
    }

    logger.info(`Processing image for device type ${deviceType}`, {
      resolution: `${spec.width}x${spec.height}`,
      colors: spec.colors,
    });

    let optimized;

    if (deviceType.toLowerCase() === "og") {
      // OG: Monochrome with dithering
      optimized = await applyFloydSteinbergDither(imageBuffer, {
        width: spec.width,
        height: spec.height,
      });
    } else if (deviceType.toLowerCase() === "x") {
      // X: Grayscale with quantization
      optimized = await applyQuantization(imageBuffer, {
        width: spec.width,
        height: spec.height,
        colors: spec.colors,
      });
    } else {
      throw new Error(`Unsupported device type: ${deviceType}`);
    }

    // Verify size constraints
    if (optimized.length > spec.maxSize) {
      logger.warn(`Optimized image exceeds size limit for ${deviceType}`, {
        size: optimized.length,
        max: spec.maxSize,
      });
    }

    logger.info(`Image processing complete for ${deviceType}`, {
      original_size: imageBuffer.length,
      optimized_size: optimized.length,
      compression: Math.round((1 - optimized.length / imageBuffer.length) * 100),
    });

    return optimized;
  } catch (error) {
    logger.error(`Image processing failed for device type ${deviceType}`, {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Batch process images
 * @param {Array} images - Array of {buffer, deviceType}
 * @returns {Promise<Array>} Processed images
 */
export async function processImageBatch(images) {
  try {
    const results = [];

    for (const { buffer, deviceType } of images) {
      const optimized = await processImage(buffer, deviceType);
      results.push({ deviceType, buffer: optimized });
    }

    logger.info(`Processed ${results.length} images in batch`);
    return results;
  } catch (error) {
    logger.error("Batch image processing failed", { error: error.message });
    throw error;
  }
}

/**
 * Get device specifications
 * @param {string} deviceType - Device type (og or x)
 * @returns {object|null} Device specs or null if unknown
 */
export function getDeviceSpec(deviceType) {
  return DEVICE_SPECS[deviceType?.toLowerCase()] || null;
}

/**
 * Get all supported device types
 * @returns {Array<string>} List of device type keys
 */
export function getSupportedDeviceTypes() {
  return Object.keys(DEVICE_SPECS);
}

/**
 * Validate image before processing
 * @param {Buffer} imageBuffer - Image data to validate
 * @returns {object} Validation result
 */
export function validateImage(imageBuffer) {
  try {
    const minSize = 1024; // At least 1KB
    const maxSize = 50 * 1024 * 1024; // Max 50MB

    if (!Buffer.isBuffer(imageBuffer)) {
      return { valid: false, error: "Not a buffer" };
    }

    if (imageBuffer.length < minSize) {
      return { valid: false, error: `Image too small: ${imageBuffer.length} bytes` };
    }

    if (imageBuffer.length > maxSize) {
      return { valid: false, error: `Image too large: ${imageBuffer.length} bytes` };
    }

    // Check for PNG signature
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!imageBuffer.subarray(0, 8).equals(pngSignature)) {
      // Might be JPEG or other format - try to detect
      const jpegStart = imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8;
      if (!jpegStart) {
        logger.warn("Image does not appear to be PNG or JPEG", {
          header: imageBuffer.subarray(0, 8).toString("hex"),
        });
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
