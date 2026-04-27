import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dispatchOutput } from "./dispatch-output";

// Mock nodemailer
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "test-id" }),
    })),
  },
}));

describe("dispatchOutput", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("OK"),
      json: () => Promise.resolve({ id: "file123", name: "test.txt" }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws on unsupported type", async () => {
    await expect(dispatchOutput("unknown", {}, "hello")).rejects.toThrow(
      "Unsupported output type: unknown"
    );
  });

  it("dispatches webhook successfully", async () => {
    const result = await dispatchOutput("webhook", { url: "https://example.com/hook" }, "hello");
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws webhook when URL is missing", async () => {
    await expect(dispatchOutput("webhook", {}, "hello")).rejects.toThrow("Missing URL");
  });

  it("dispatches telegram successfully", async () => {
    const result = await dispatchOutput(
      "telegram",
      { botToken: "bot123", chatId: "456" },
      "hello"
    );
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/botbot123/sendMessage",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws telegram when token or chatId missing", async () => {
    await expect(dispatchOutput("telegram", {}, "hello")).rejects.toThrow(
      "Missing botToken or chatId"
    );
  });

  it("dispatches slack successfully", async () => {
    const result = await dispatchOutput(
      "slack",
      { webhookUrl: "https://hooks.slack.com/test" },
      "hello"
    );
    expect(result.ok).toBe(true);
  });

  it("dispatches discord successfully", async () => {
    const result = await dispatchOutput(
      "discord",
      { webhookUrl: "https://discord.com/api/webhooks/test" },
      "hello"
    );
    expect(result.ok).toBe(true);
  });

  it("dispatches email successfully", async () => {
    const result = await dispatchOutput("email", {
      smtpHost: "smtp.example.com",
      smtpPort: "587",
      smtpUser: "user@example.com",
      smtpPass: "secret",
      emailTo: "to@example.com",
      emailSubject: "Test",
    }, "hello");
    expect(result.ok).toBe(true);
  });

  it("throws email when SMTP config missing", async () => {
    await expect(dispatchOutput("email", {}, "hello")).rejects.toThrow(
      "Missing SMTP configuration"
    );
  });

  it("dispatches google-drive successfully", async () => {
    const result = await dispatchOutput(
      "google-drive",
      { accessToken: "token123", folderId: "folder1", fileName: "report.txt" },
      "file content"
    );
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token123",
        }),
      })
    );
  });

  it("throws google-drive when access token missing", async () => {
    await expect(dispatchOutput("google-drive", {}, "hello")).rejects.toThrow(
      "Missing Google Drive access token"
    );
  });
});
