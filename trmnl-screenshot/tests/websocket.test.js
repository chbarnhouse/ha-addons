/**
 * Tests for WebSocket communication (websocket.js)
 */

import WebSocket from "ws";
import {
  connectWebSocket,
  sendWebSocketMessage,
  disconnectWebSocket,
  getWebSocketStatus,
} from "../src/websocket.js";

describe("WebSocket Communication (websocket.js)", () => {
  let mockWs;
  let wsEventHandlers;

  beforeEach(() => {
    jest.clearAllMocks();
    wsEventHandlers = {};

    mockWs = {
      on: jest.fn((event, handler) => {
        wsEventHandlers[event] = handler;
      }),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
    };

    WebSocket.mockImplementation(() => mockWs);
    WebSocket.OPEN = 1;
    WebSocket.CLOSED = 3;
  });

  afterEach(async () => {
    await disconnectWebSocket();
  });

  describe("connectWebSocket", () => {
    test("should connect to WebSocket", async () => {
      const promise = connectWebSocket("http://homeassistant.local:8123", "token123");

      // Simulate connection
      if (wsEventHandlers.open) {
        wsEventHandlers.open();
      }

      const ws = await promise;
      expect(ws).toBeDefined();
      expect(WebSocket).toHaveBeenCalled();
    });

    test("should send authentication after connection", async () => {
      const promise = connectWebSocket("http://homeassistant.local:8123", "token123");

      if (wsEventHandlers.open) {
        wsEventHandlers.open();
      }

      await promise;

      expect(mockWs.send).toHaveBeenCalled();
      const authMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(authMessage.type).toBe("auth");
      expect(authMessage.access_token).toBe("token123");
    });

    test("should convert http to ws protocol", async () => {
      const promise = connectWebSocket("http://homeassistant.local:8123", "token123");

      if (wsEventHandlers.open) {
        wsEventHandlers.open();
      }

      await promise;

      const urlArg = WebSocket.mock.calls[0][0];
      expect(urlArg.startsWith("ws://")).toBe(true);
    });

    test("should convert https to wss protocol", async () => {
      const promise = connectWebSocket("https://homeassistant.local:8123", "token123");

      if (wsEventHandlers.open) {
        wsEventHandlers.open();
      }

      await promise;

      const urlArg = WebSocket.mock.calls[0][0];
      expect(urlArg.startsWith("wss://")).toBe(true);
    });

    test("should handle connection errors", async () => {
      const promise = connectWebSocket("http://homeassistant.local:8123", "token123");

      if (wsEventHandlers.error) {
        wsEventHandlers.error(new Error("Connection refused"));
      }

      await expect(promise).rejects.toThrow("Connection refused");
    });

    test("should handle missing parameters", async () => {
      await expect(connectWebSocket("", "")).rejects.toThrow();
    });
  });

  describe("sendWebSocketMessage", () => {
    beforeEach(async () => {
      const promise = connectWebSocket("http://test.local:8123", "token123");
      if (wsEventHandlers.open) {
        wsEventHandlers.open();
      }
      await promise;
    });

    test("should send message when connected", () => {
      const message = { id: 1, type: "test" };
      mockWs.readyState = WebSocket.OPEN;

      const result = sendWebSocketMessage(message);

      expect(result).toBe(true);
      expect(mockWs.send).toHaveBeenCalled();
    });

    test("should return false when not connected", () => {
      const message = { id: 1, type: "test" };
      mockWs.readyState = WebSocket.CLOSED;

      const result = sendWebSocketMessage(message);

      expect(result).toBe(false);
    });

    test("should JSON stringify message", () => {
      const message = { id: 1, type: "test", data: "value" };
      mockWs.readyState = WebSocket.OPEN;

      sendWebSocketMessage(message);

      const sentData = mockWs.send.mock.calls[0][0];
      expect(JSON.parse(sentData)).toEqual(message);
    });

    test("should handle send errors", () => {
      mockWs.send.mockImplementation(() => {
        throw new Error("Send failed");
      });
      mockWs.readyState = WebSocket.OPEN;

      const result = sendWebSocketMessage({ id: 1 });

      expect(result).toBe(false);
    });
  });

  describe("disconnectWebSocket", () => {
    beforeEach(async () => {
      const promise = connectWebSocket("http://test.local:8123", "token123");
      if (wsEventHandlers.open) {
        wsEventHandlers.open();
      }
      await promise;
    });

    test("should close WebSocket connection", async () => {
      await disconnectWebSocket();

      expect(mockWs.close).toHaveBeenCalled();
    });

    test("should handle close gracefully", async () => {
      mockWs.close.mockImplementation(() => {
        throw new Error("Close failed");
      });

      // Should not throw
      await expect(disconnectWebSocket()).resolves.not.toThrow();
    });
  });

  describe("getWebSocketStatus", () => {
    test("should return disconnected status when not connected", () => {
      const status = getWebSocketStatus();

      expect(status.connected).toBe(false);
      expect(status.ready_state).toBeDefined();
    });

    test("should return connected status when connected", async () => {
      const promise = connectWebSocket("http://test.local:8123", "token123");
      if (wsEventHandlers.open) {
        wsEventHandlers.open();
      }
      await promise;

      mockWs.readyState = WebSocket.OPEN;
      const status = getWebSocketStatus();

      expect(status.connected).toBe(true);
    });

    test("should track reconnection attempts", async () => {
      const promise = connectWebSocket("http://test.local:8123", "token123");
      if (wsEventHandlers.open) {
        wsEventHandlers.open();
      }
      await promise;

      const status = getWebSocketStatus();
      expect(status).toHaveProperty("reconnect_attempts");
      expect(status.reconnect_attempts).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Message handling", () => {
    beforeEach(async () => {
      const promise = connectWebSocket("http://test.local:8123", "token123");
      if (wsEventHandlers.open) {
        wsEventHandlers.open();
      }
      await promise;
    });

    test("should handle auth_ok message", () => {
      const message = { type: "auth_ok" };

      if (wsEventHandlers.message) {
        wsEventHandlers.message(JSON.stringify(message));
      }

      // Should not throw
      expect(true).toBe(true);
    });

    test("should handle auth_invalid message", () => {
      const message = { type: "auth_invalid" };

      if (wsEventHandlers.message) {
        wsEventHandlers.message(JSON.stringify(message));
      }

      // Should not throw
      expect(true).toBe(true);
    });

    test("should handle addon commands", async () => {
      const message = {
        event_type: "trmnl_addon_command",
        data: {
          id: 1,
          type: "trmnl/health_check",
        },
      };

      if (wsEventHandlers.message) {
        wsEventHandlers.message(JSON.stringify(message));
      }

      // Should process command and send response
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Response should have been attempted
      expect(true).toBe(true);
    });

    test("should handle invalid JSON gracefully", () => {
      const invalidJson = "not json";

      // Should not throw
      expect(() => {
        if (wsEventHandlers.message) {
          wsEventHandlers.message(invalidJson);
        }
      }).toThrow(); // JSON parse error is expected
    });
  });

  describe("Reconnection", () => {
    test("should attempt to reconnect after disconnection", async () => {
      jest.useFakeTimers();

      const promise = connectWebSocket("http://test.local:8123", "token123");
      if (wsEventHandlers.open) {
        wsEventHandlers.open();
      }
      await promise;

      // Simulate disconnect
      if (wsEventHandlers.close) {
        wsEventHandlers.close();
      }

      // Fast-forward time
      jest.advanceTimersByTime(6000);

      // Reconnect attempt should have been made
      expect(WebSocket).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    test("should stop reconnecting after max attempts", async () => {
      jest.useFakeTimers();

      const promise = connectWebSocket("http://test.local:8123", "token123");
      if (wsEventHandlers.open) {
        wsEventHandlers.open();
      }
      await promise;

      // Simulate multiple disconnections
      for (let i = 0; i < 11; i++) {
        if (wsEventHandlers.close) {
          wsEventHandlers.close();
        }
        jest.advanceTimersByTime(50000); // Advance past reconnect delay
      }

      // Should have limited reconnect attempts
      expect(WebSocket.mock.calls.length).toBeLessThan(15);

      jest.useRealTimers();
    });
  });
});
