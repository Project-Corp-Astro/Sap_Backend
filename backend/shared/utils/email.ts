/**
 * Email Service Utility
 * Provides email sending functionality for the application
 */

// Add this at the beginning of email.ts
console.log('Email Configuration:', {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE,
  user: process.env.EMAIL_USER,
  from: process.env.EMAIL_FROM
});

import nodemailer from 'nodemailer';
import { createServiceLogger } from './logger';
import config from '../config/index';

// Initialize logger
const logger = createServiceLogger('email-service');

// Email configuration
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

// Email options
interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

// Default email configuration
const defaultConfig: EmailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || 'noreply@example.com',
    pass: process.env.EMAIL_PASS || 'your-password'
  },
  from: process.env.EMAIL_FROM || 'noreply@example.com'
};

// Add validation for required environment variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  throw new Error('Email configuration is missing required environment variables');
}

/**
 * Email service class
 */
class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  /**
   * Initialize email service
   * @param options - Email configuration options
   */
  constructor(options: Partial<EmailConfig> = {}) {
    this.config = { ...defaultConfig, ...options };
    
    // Always use real email transport
    logger.info('Creating email transporter with standard SMTP settings');
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.auth.user,
        pass: this.config.auth.pass
      }
    });

    // Verify connection
    if (process.env.NODE_ENV !== 'test') {
      this.verifyConnection();
    }
  }

  /**
   * Verify SMTP connection
   */
  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection established successfully');
    } catch (error) {
      logger.error('SMTP connection failed', { error: (error as Error).message });
    }
  }

  /**
   * Send email
   * @param options - Email options
   * @returns Information about the sent email
   */
  async sendEmail(options: EmailOptions): Promise<any> {
    try {
      const mailOptions = {
        from: this.config.from,
        ...options
      };
      
      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: options.to
      });
      
      return info;
    } catch (error) {
      logger.error('Failed to send email', {
        error: (error as Error).message,
        to: options.to,
        subject: options.subject
      });
      
      throw error;
    }
  }

  /**
   * Send password reset OTP email
   * @param email - Recipient email
   * @param otp - One-time password
   * @returns Information about the sent email
   */
  async sendPasswordResetOTP(email: string, otp: string): Promise<void> {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset OTP',
        text: `You have requested a password reset. Here is your one-time password (OTP):\n${otp}\n\nPlease use this OTP to reset your password within 5 minutes.\n\nIf you did not request this, please ignore this email.\n\nThis OTP will expire in 5 minutes.`,
        html: `<p>You have requested a password reset.</p><p>Here is your one-time password (OTP): <strong>${otp}</strong></p><p>Please use this OTP to reset your password within 5 minutes.</p><p>If you did not request this, please ignore this email.</p><p>This OTP will expire in 5 minutes.</p>`
      };

      await transporter.sendMail(mailOptions);
    } catch (error) {
      logger.error('Error sending password reset OTP:', error);
      throw error;
    }
    
    // Define variables for sendEmail call
    const subject = 'Password Reset OTP';
    const text = `You have requested a password reset. Here is your one-time password (OTP): ${otp}\n\nPlease use this OTP to reset your password within 5 minutes.\n\nIf you did not request this, please ignore this email.\n\nThis OTP will expire in 5 minutes.`;
    const html = `<p>You have requested a password reset.</p><p>Here is your one-time password (OTP): <strong>${otp}</strong></p><p>Please use this OTP to reset your password within 5 minutes.</p><p>If you did not request this, please ignore this email.</p><p>This OTP will expire in 5 minutes.</p>`;
    
    return this.sendEmail({
      to: email,
      subject,
      text,
      html
    });
  }

  /**
   * Send welcome email
   * @param email - Recipient email
   * @param name - Recipient name
   * @returns Information about the sent email
   */
  async sendWelcomeEmail(email: string, name: string): Promise<any> {
    const loginUrl = config.get('app.frontendUrl', 'http://localhost:3000');
    
    const subject = 'Welcome to SAP Corp Astro';
    const text = `Welcome to SAP Corp Astro, ${name}! Your account has been created successfully. You can now log in at ${loginUrl}.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to SAP Corp Astro!</h2>
        <p>Hello ${name},</p>
        <p>Your account has been created successfully. We're excited to have you on board!</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Log In</a>
        </div>
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>The SAP Corp Astro Team</p>
      </div>
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      text,
      html
    });
  }

  /**
   * Send MFA setup email
   * @param email - Recipient email
   * @param qrCodeUrl - QR code URL for MFA setup
   * @param recoveryCodes - Recovery codes
   * @returns Information about the sent email
   */
  async sendMFASetupEmail(email: string, qrCodeUrl: string, recoveryCodes: string[]): Promise<any> {
    const subject = 'Multi-Factor Authentication Setup';
    const text = `Your MFA has been set up successfully. Please save your recovery codes: ${recoveryCodes.join(', ')}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Multi-Factor Authentication Setup</h2>
        <p>Your MFA has been set up successfully.</p>
        <p>You can use the QR code below with your authenticator app:</p>
        <div style="text-align: center; margin: 20px 0;">
          <img src="${qrCodeUrl}" alt="MFA QR Code" style="max-width: 200px;">
        </div>
        <p>Please save these recovery codes in a safe place. You will need them if you lose access to your authenticator app:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; font-family: monospace;">
          ${recoveryCodes.map(code => `<div>${code}</div>`).join('')}
        </div>
        <p>Best regards,<br>The SAP Corp Astro Team</p>
      </div>
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      text,
      html
    });
  }
}

// Create and export singleton instance
const emailService = new EmailService();
export default emailService;
