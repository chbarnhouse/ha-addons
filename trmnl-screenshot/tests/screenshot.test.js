/**
 * Tests for screenshot capture (screenshot.js)
 */

import puppeteer from "puppeteer";
import {
  initializeBrowser,
  closeBrowser,
  captureScreenshot,
  getBrowserStatus,
  healthCheck,
} from "../src/screenshot.js";

describe("Screenshot Capture (screenshot.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset global browser state
    global.browser = null;
  });

  afterEach(async () => {
    await closeBrowser();
  });

  describe("initializeBrowser", () => {
    test("should launch browser with correct options", async () => {
      const mockBrowser = {
        newPage: jest.fn(),
        close: jest.fn(),
        version: jest.fn().mockResolvedValue("1.0.0"),
        pages: jest.fn().mockResolvedValue([]),
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);

      const browser = await initializeBrowser();

      expect(puppeteer.launch).toHaveBeenCalled();
      expect(browser).toBe(mockBrowser);
    });

    test("should return same instance on second call", async () => {
      const mockBrowser = {
        version: jest.fn().mockResolvedValue("1.0.0"),
        pages: jest.fn().mockResolvedValue([]),
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);

      const browser1 = await initializeBrowser();
      const browser2 = await initializeBrowser();

      expect(browser1).toBe(browser2);
      expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    });

    test("should handle launch errors", async () => {
      puppeteer.launch.mockRejectedValue(new Error("Browser launch failed"));

      await expect(initializeBrowser()).rejects.toThrow("Browser launch failed");
    });
  });

  describe("captureScreenshot", () => {
    let mockBrowser;
    let mockPage;

    beforeEach(() => {
      mockPage = {
        setViewport: jest.fn().mockResolvedValue(undefined),
        setExtraHTTPHeaders: jest.fn().mockResolvedValue(undefined),
        goto: jest.fn().mockResolvedValue(undefined),
        waitForSelector: jest.fn().mockResolvedValue(undefined),
        waitForTimeout: jest.fn().mockResolvedValue(undefined),
        screenshot: jest.fn().mockResolvedValue(Buffer.from("screenshot_data")),
        close: jest.fn().mockResolvedValue(undefined),
      };

      mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        version: jest.fn().mockResolvedValue("1.0.0"),
        pages: jest.fn().mockResolvedValue([]),
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);
    });

    test("should capture screenshot successfully", async () => {
      await initializeBrowser();

      const screenshot = await captureScreenshot("device_1", "/lovelace/default");

      expect(screenshot).toBeDefined();
      expect(Buffer.isBuffer(screenshot)).toBe(true);
      expect(mockPage.setViewport).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalled();
      expect(mockPage.screenshot).toHaveBeenCalled();
    });

    test("should set correct viewport", async () => {
      await initializeBrowser();

      await captureScreenshot("device_1", "/lovelace/default", {
        width: 1024,
        height: 768,
      });

      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1024,
        height: 768,
      });
    });

    test("should include authorization header if token provided", async () => {
      await initializeBrowser();

      await captureScreenshot("device_1", "/lovelace/default", {
        haToken: "test_token_123",
      });

      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        Authorization: "Bearer test_token_123",
      });
    });

    test("should navigate to correct URL", async () => {
      await initializeBrowser();

      await captureScreenshot("device_1", "/lovelace/default", {
        haUrl: "http://homeassistant.local:8123",
      });

      expect(mockPage.goto).toHaveBeenCalled();
      const callArgs = mockPage.goto.mock.calls[0][0];
      expect(callArgs).toContain("homeassistant.local");
      expect(callArgs).toContain("/lovelace/default");
    });

    test("should close page after capture", async () => {
      await initializeBrowser();

      await captureScreenshot("device_1", "/lovelace/default");

      expect(mockPage.close).toHaveBeenCalled();
    });

    test("should retry navigation on failure", async () => {
      mockPage.goto
        .mockRejectedValueOnce(new Error("Navigation timeout"))
        .mockRejectedValueOnce(new Error("Navigation timeout"))
        .mockResolvedValueOnce(undefined);

      await initializeBrowser();

      const screenshot = await captureScreenshot("device_1", "/lovelace/default");

      expect(screenshot).toBeDefined();
      expect(mockPage.goto).toHaveBeenCalledTimes(3);
    });

    test("should fail after max retries", async () => {
      mockPage.goto.mockRejectedValue(new Error("Navigation timeout"));

      await initializeBrowser();

      await expect(captureScreenshot("device_1", "/lovelace/default")).rejects.toThrow();
    });

    test("should handle missing device ID", async () => {
      await initializeBrowser();

      await expect(captureScreenshot(null, "/lovelace/default")).rejects.toThrow();
    });
  });

  describe("closeBrowser", () => {
    test("should close browser if open", async () => {
      const mockBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        version: jest.fn().mockResolvedValue("1.0.0"),
        pages: jest.fn().mockResolvedValue([]),
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);

      await initializeBrowser();
      await closeBrowser();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test("should handle close errors gracefully", async () => {
      const mockBrowser = {
        close: jest.fn().mockRejectedValue(new Error("Close failed")),
        version: jest.fn().mockResolvedValue("1.0.0"),
        pages: jest.fn().mockResolvedValue([]),
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);

      await initializeBrowser();
      // Should not throw
      await expect(closeBrowser()).resolves.not.toThrow();
    });

    test("should handle closing when browser not initialized", async () => {
      // Should not throw
      await expect(closeBrowser()).resolves.not.toThrow();
    });
  });

  describe("getBrowserStatus", () => {
    test("should return disconnected status if browser not initialized", async () => {
      const status = await getBrowserStatus();

      expect(status.connected).toBe(false);
      expect(status.pages).toBe(0);
    });

    test("should return connected status if browser initialized", async () => {
      const mockBrowser = {
        pages: jest.fn().mockResolvedValue([{}, {}]), // 2 pages
        version: jest.fn().mockResolvedValue("1.0.0"),
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);

      await initializeBrowser();
      const status = await getBrowserStatus();

      expect(status.connected).toBe(true);
      expect(status.pages).toBe(2);
    });

    test("should include queue information", async () => {
      const mockBrowser = {
        pages: jest.fn().mockResolvedValue([]),
        version: jest.fn().mockResolvedValue("1.0.0"),
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);

      await initializeBrowser();
      const status = await getBrowserStatus();

      expect(status).toHaveProperty("active_captures");
      expect(status).toHaveProperty("queued_captures");
    });
  });

  describe("healthCheck", () => {
    test("should return true if browser is healthy", async () => {
      const mockBrowser = {
        version: jest.fn().mockResolvedValue("121.0.6167.0"),
        pages: jest.fn().mockResolvedValue([]),
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);

      await initializeBrowser();
      const healthy = await healthCheck();

      expect(healthy).toBe(true);
    });

    test("should return false if browser not initialized", async () => {
      const healthy = await healthCheck();

      expect(healthy).toBe(false);
    });

    test("should return false on version check error", async () => {
      const mockBrowser = {
        version: jest.fn().mockRejectedValue(new Error("Version check failed")),
        pages: jest.fn().mockResolvedValue([]),
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);

      await initializeBrowser();
      const healthy = await healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe("Concurrent capture limiting", () => {
    test("should limit concurrent captures", async () => {
      const mockBrowser = {
        newPage: jest
          .fn()
          .mockResolvedValue({
            setViewport: jest.fn().mockResolvedValue(undefined),
            goto: jest.fn().mockResolvedValue(undefined),
            waitForSelector: jest.fn().mockRejectedValue(new Error("Not found")),
            waitForTimeout: jest.fn().mockResolvedValue(undefined),
            screenshot: jest.fn().mockResolvedValue(Buffer.from("data")),
            close: jest.fn().mockResolvedValue(undefined),
          }),
        version: jest.fn().mockResolvedValue("1.0.0"),
        pages: jest.fn().mockResolvedValue([]),
      };

      puppeteer.launch.mockResolvedValue(mockBrowser);

      await initializeBrowser();

      // Start multiple captures (should be queued)
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(captureScreenshot(`device_${i}`, "/lovelace"));
      }

      await expect(Promise.all(promises)).resolves.toBeDefined();

      // All should complete despite concurrent limit
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(5);
    });
  });
});
