import { Request, Response, NextFunction } from 'express';
import UAParser from 'ua-parser-js';
import UserDevice, { DeviceType } from '../models/UserDevice';
import { UserDocument } from '../interfaces/user.interfaces';

// Simple logger implementation
const logger = {
  info: (message: string, meta?: any) => {
    console.info(`[INFO] [device-middleware] ${message}`, meta || '');
  },
  error: (message: string, meta?: any) => {
    console.error(`[ERROR] [device-middleware] ${message}`, meta || '');
  }
};

// Extend Express Request interface to include user and device
declare module 'express' {
  interface Request {
    user?: UserDocument;
    device?: any;
  }
}

/**
 * Middleware to track user devices
 * This middleware identifies and tracks the devices used by users to access the application
 * It helps with security monitoring and multi-device management
 */
const deviceTrackingMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Skip if no authenticated user
    if (!req.user || !req.user._id) {
      return next();
    }

    const userId = req.user._id;
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || (req.connection?.remoteAddress) || '';
    
    // Parse user agent
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    // Generate a unique device ID based on user agent and other factors
    // In a real-world scenario, you might use fingerprinting libraries or cookies
    const deviceId = Buffer.from(`${userId}-${result.browser.name}-${result.os.name}-${result.device.type || 'desktop'}`).toString('base64');
    
    // Check if device already exists
    let device = await UserDevice.findOne({
      user: userId,
      deviceId: deviceId
    });
    
    if (device) {
      // Update last used timestamp
      device.lastUsed = new Date();
      device.ipAddress = ipAddress;
      await device.save();
    } else {
      // Determine device type
      let deviceType: DeviceType = DeviceType.OTHER;
      if (result.device.type === 'mobile') deviceType = DeviceType.MOBILE;
      else if (result.device.type === 'tablet') deviceType = DeviceType.TABLET;
      else if (!result.device.type || result.device.type === 'desktop') deviceType = DeviceType.DESKTOP;
      
      // Create new device record
      device = new UserDevice({
        user: userId,
        deviceId: deviceId,
        deviceName: `${result.browser.name} on ${result.os.name}`,
        deviceType: deviceType,
        browser: result.browser.name,
        operatingSystem: result.os.name,
        ipAddress: ipAddress,
        userAgent: userAgent,
        lastUsed: new Date()
      });
      
      await device.save();
      
      // Log new device
      logger.info(`New device detected for user ${userId}`, {
        userId,
        deviceId,
        deviceName: device.deviceName
      });
    }
    
    // Attach device to request for potential use in controllers
    req.device = device;
    
    next();
  } catch (error) {
    logger.error('Error in device tracking middleware:', { error: (error as Error).message });
    // Continue even if device tracking fails
    next();
  }
};

export default deviceTrackingMiddleware;
