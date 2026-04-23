import nodemailer from "nodemailer";

/**
 * Dispatch a message to an external output channel.
 * Supports: webhook, telegram, slack, discord, email, sms, api
 */
export async function dispatchOutput(
  type: string,
  config: Record<string, string>,
  message: string
): Promise<{ ok: boolean; detail?: string; error?: string }> {
  switch (type) {
    case "webhook":
    case "api": {
      const url = config.url || config.webhookUrl;
      if (!url) throw new Error("Missing URL");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.headers) {
        try {
          const parsed = JSON.parse(config.headers);
          Object.assign(headers, parsed);
        } catch {
          // ignore invalid headers JSON
        }
      }
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ message, timestamp: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return { ok: true, detail: `Webhook sent (${res.status})` };
    }

    case "telegram": {
      const botToken = config.botToken;
      const chatId = config.chatId;
      if (!botToken || !chatId) throw new Error("Missing botToken or chatId");
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
      if (!res.ok) throw new Error(`Telegram API error: ${await res.text()}`);
      return { ok: true, detail: "Message sent to Telegram" };
    }

    case "slack": {
      const webhookUrl = config.webhookUrl;
      if (!webhookUrl) throw new Error("Missing webhookUrl");
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (!res.ok) throw new Error(`Slack API error: ${await res.text()}`);
      return { ok: true, detail: "Message sent to Slack" };
    }

    case "discord": {
      const webhookUrl = config.webhookUrl;
      if (!webhookUrl) throw new Error("Missing webhookUrl");
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      if (!res.ok) throw new Error(`Discord API error: ${await res.text()}`);
      return { ok: true, detail: "Message sent to Discord" };
    }

    case "email": {
      const smtpHost = config.smtpHost;
      const smtpPort = config.smtpPort;
      const smtpUser = config.smtpUser;
      const smtpPass = config.smtpPass;
      const emailTo = config.emailTo;
      const emailSubject = config.emailSubject || "Agent Output";
      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !emailTo) {
        throw new Error("Missing SMTP configuration");
      }
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: smtpUser,
        to: emailTo,
        subject: emailSubject,
        text: message,
      });
      return { ok: true, detail: "Email sent successfully" };
    }

    case "sms": {
      const url = config.webhookUrl;
      if (!url) throw new Error("Missing webhookUrl for SMS gateway");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(`SMS gateway error: ${await res.text()}`);
      return { ok: true, detail: "SMS dispatched" };
    }

    default:
      throw new Error(`Unsupported output type: ${type}`);
  }
}
