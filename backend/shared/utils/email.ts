/**
 * Email Service Utility
 * Provides email sending functionality for the application
 */

import nodemailer from 'nodemailer';
import { createServiceLogger } from './logger.js';
import config from '../config/index.js';

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
  host: config.get('email.host', 'smtp.example.com'),
  port: config.get('email.port', 587),
  secure: config.get('email.secure', false),
  auth: {
    user: config.get('email.user', 'user@example.com'),
    pass: config.get('email.password', 'password')
  },
  from: config.get('email.from', 'SAP Corp Astro <noreply@example.com>')
};

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
    
    // Create transporter
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
   * Send password reset email
   * @param email - Recipient email
   * @param token - Reset token
   * @returns Information about the sent email
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<any> {
    const resetUrl = `${config.get('app.frontendUrl', 'http://localhost:3000')}/reset-password?token=${token}`;
    
    const subject = 'Password Reset Request';
    const text = `You requested a password reset. Please click the following link to reset your password: ${resetUrl}. This link will expire in 1 hour.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your SAP Corp Astro account.</p>
        <p>Please click the button below to reset your password. This link will expire in 1 hour.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        </div>
        <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
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
