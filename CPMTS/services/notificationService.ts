
import { User } from "../types";

// No API credentials in the frontend — the server-side proxy injects them.
const PROXY_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

export interface DeliveryStatus {
  success: boolean;
  message: string;
  auditLog?: string;
}

class NotificationService {
  /**
   * Generates a secure 4-digit OTP
   */
  generateOTP(): string {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] % 9000 + 1000).toString();
  }

  /**
   * Normalise phone number to 2547XXXXXXXX format
   */
  private normalisePhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-\(\)]/g, "");
    if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
    if (cleaned.startsWith("0")) cleaned = "254" + cleaned.slice(1);
    if (cleaned.startsWith("7") || cleaned.startsWith("1")) cleaned = "254" + cleaned;
    return cleaned;
  }

  /**
   * Dispatches the OTP via the chosen channel
   */
  async sendOTP(user: User, method: 'email' | 'sms', code: string): Promise<DeliveryStatus> {
    if (method === 'email') {
      try {
        const response = await fetch(
          `/proxy/send-email`,
          {
            method: "POST",
            headers: PROXY_HEADERS,
            body: JSON.stringify({
              to: user.email,
              subject: `CPMTS Staff Login - Verification Code: ${code}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 16px;">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <h2 style="color: #1e293b; margin: 0;">Taita Taveta County</h2>
                    <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Project Tracking System</p>
                  </div>
                  <div style="background: white; padding: 32px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
                    <p style="color: #64748b; font-size: 14px; margin-bottom: 8px;">Hello <strong>${user.name}</strong>,</p>
                    <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">Your one-time verification code is:</p>
                    <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                      <span style="font-size: 36px; font-weight: 900; letter-spacing: 12px; color: #0f172a;">${code}</span>
                    </div>
                    <p style="color: #94a3b8; font-size: 12px;">This code expires in 10 minutes. Do not share it with anyone.</p>
                  </div>
                  <p style="color: #cbd5e1; font-size: 10px; text-align: center; margin-top: 16px;">
                    County ICT & Service Delivery Unit
                  </p>
                </div>
              `,
            }),
          }
        );

        if (response.ok) {
          return {
            success: true,
            message: `Secure code dispatched to ${user.email}`,
            auditLog: `OTP email sent to ${user.email.replace(/(.{2}).*(@.*)/, '$1***$2')} via SMTP.`,
          };
        } else {
          return {
            success: false,
            message: "Email gateway returned an error.",
            auditLog: "Email dispatch failed — gateway error.",
          };
        }
      } catch (err) {
        return {
          success: false,
          message: "Failed to connect to email gateway.",
          auditLog: "Email dispatch failed — network error.",
        };
      }
    } else {
      // SMS via TextSMS gateway (proxied through /proxy/send-sms to avoid CORS)
      try {
        if (!user.phone) {
          return {
            success: false,
            message: "No phone number on file. Please use email verification.",
            auditLog: "SMS failed — no phone number.",
          };
        }

        const mobile = this.normalisePhone(user.phone);
        const smsMessage = `CPMTS Staff Login: Your verification code is ${code}. Valid for 10 minutes. Do not share this code.`;

        const response = await fetch("/proxy/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobile, message: smsMessage }),
        });

        const result = await response.json();

        // TextSMS returns { "responses": [{ "response-code": 200, ... }] }
        const respCode = result?.responses?.[0]?.["response-code"];
        if (response.ok && (respCode === 200 || respCode === "200")) {
          const masked = mobile.slice(0, 6) + "***" + mobile.slice(-2);
          return {
            success: true,
            message: `Verification code sent to ${masked}`,
            auditLog: `OTP SMS sent to ${masked} via TextSMS gateway.`,
          };
        } else {
          return {
            success: false,
            message: result?.responses?.[0]?.["response-description"] || "SMS gateway returned an error.",
            auditLog: "SMS dispatch failed — gateway error.",
          };
        }
      } catch (err) {
        return {
          success: false,
          message: "Failed to connect to SMS gateway.",
          auditLog: "SMS dispatch failed — network error.",
        };
      }
    }
  }
}

export const notificationService = new NotificationService();
