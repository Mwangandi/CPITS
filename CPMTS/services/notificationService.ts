
import { GoogleGenAI } from "@google/genai";
import { User } from "../types";

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
   * Uses Gemini to generate a professional audit log for the security team
   */
  private async generateSecurityAudit(user: User, method: 'email' | 'sms'): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a brief, 1-sentence technical audit log entry for a secure login attempt at Taita Taveta County. 
        Staff: ${user.name} (Payroll: ${user.payrollNumber}). 
        Method: ${method.toUpperCase()}. 
        Context: Multi-factor authentication initiated from a browser in Kenya.`,
      });
      return response.text || "Security handshake completed successfully.";
    } catch (error) {
      return "Local security audit initiated (Offline fallback).";
    }
  }

  /**
   * Dispatches the OTP via the chosen channel
   */
  async sendOTP(user: User, method: 'email' | 'sms', code: string): Promise<DeliveryStatus> {
    // In a production environment, this is where you would call:
    // - Twilio API for SMS
    // - EmailJS / SendGrid for Email
    
    const audit = await this.generateSecurityAudit(user, method);

    // Simulating gateway latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (method === 'email') {
      console.log(`[STAGING] Sending Email to ${user.email}: Your Taita Taveta OTP is ${code}`);
      // Real implementation would look like: 
      // await emailjs.send("service_id", "template_id", { to_name: user.name, code, to_email: user.email });
      return { 
        success: true, 
        message: `Secure code dispatched to ${user.email}`,
        auditLog: audit
      };
    } else {
      console.log(`[STAGING] Sending SMS to ${user.phone}: Taita Taveta County Code: ${code}`);
      // Real implementation would look like:
      // await fetch('https://api.sms-gateway.com/send', { method: 'POST', body: JSON.stringify({ to: user.phone, msg: `Your code is ${code}` }) });
      return { 
        success: true, 
        message: `SMS alert routed to ${user.phone}`,
        auditLog: audit
      };
    }
  }
}

export const notificationService = new NotificationService();
