"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ua_parser_js_1 = __importDefault(require("ua-parser-js"));
const logger_1 = require("../../../shared/utils/logger");
const UserDevice_1 = __importStar(require("../models/UserDevice"));
// Initialize logger
const logger = (0, logger_1.createServiceLogger)('device-middleware');
/**
 * Middleware to track user devices
 * This middleware identifies and tracks the devices used by users to access the application
 * It helps with security monitoring and multi-device management
 */
const deviceTrackingMiddleware = async (req, res, next) => {
    try {
        // Skip if no authenticated user
        if (!req.user || !req.user._id) {
            return next();
        }
        const userId = req.user._id;
        const userAgent = req.headers['user-agent'] || '';
        const ipAddress = req.ip || (req.connection?.remoteAddress) || '';
        // Parse user agent
        const parser = new ua_parser_js_1.default(userAgent);
        const result = parser.getResult();
        // Generate a unique device ID based on user agent and other factors
        // In a real-world scenario, you might use fingerprinting libraries or cookies
        const deviceId = Buffer.from(`${userId}-${result.browser.name}-${result.os.name}-${result.device.type || 'desktop'}`).toString('base64');
        // Check if device already exists
        let device = await UserDevice_1.default.findOne({
            user: userId,
            deviceId: deviceId
        });
        if (device) {
            // Update last used timestamp
            device.lastUsed = new Date();
            device.ipAddress = ipAddress;
            await device.save();
        }
        else {
            // Determine device type
            let deviceType = UserDevice_1.DeviceType.OTHER;
            if (result.device.type === 'mobile')
                deviceType = UserDevice_1.DeviceType.MOBILE;
            else if (result.device.type === 'tablet')
                deviceType = UserDevice_1.DeviceType.TABLET;
            else if (!result.device.type || result.device.type === 'desktop')
                deviceType = UserDevice_1.DeviceType.DESKTOP;
            // Create new device record
            device = new UserDevice_1.default({
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
    }
    catch (error) {
        logger.error('Error in device tracking middleware:', { error: error.message });
        // Continue even if device tracking fails
        next();
    }
};
exports.default = deviceTrackingMiddleware;
