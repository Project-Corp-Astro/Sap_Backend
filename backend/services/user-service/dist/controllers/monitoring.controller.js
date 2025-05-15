"use strict";
/**
 * Monitoring Controller
 * Provides endpoints for monitoring service health and performance
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetMetrics = exports.getSystemInfo = exports.getMetrics = exports.getHealth = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const os_1 = __importDefault(require("os"));
const performance_1 = __importDefault(require("../utils/performance"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Get service health status
 * @param req - Express request
 * @param res - Express response
 */
const getHealth = (req, res) => {
    const dbStatus = mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({
        status: 'ok',
        service: 'user-service',
        timestamp: new Date().toISOString(),
        database: {
            status: dbStatus,
            name: mongoose_1.default.connection.name,
            host: mongoose_1.default.connection.host,
            port: mongoose_1.default.connection.port,
        },
        uptime: process.uptime(),
    });
};
exports.getHealth = getHealth;
/**
 * Get detailed performance metrics
 * @param req - Express request
 * @param res - Express response
 */
const getMetrics = (req, res) => {
    try {
        const metrics = performance_1.default.getMetrics();
        res.status(200).json({
            success: true,
            metrics
        });
    }
    catch (error) {
        logger_1.default.error('Error retrieving metrics', { error });
        res.status(500).json({
            success: false,
            message: 'Error retrieving metrics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getMetrics = getMetrics;
/**
 * Get system information
 * @param req - Express request
 * @param res - Express response
 */
const getSystemInfo = (req, res) => {
    try {
        const systemInfo = {
            hostname: os_1.default.hostname(),
            platform: os_1.default.platform(),
            arch: os_1.default.arch(),
            release: os_1.default.release(),
            cpus: os_1.default.cpus().length,
            totalMemory: os_1.default.totalmem(),
            freeMemory: os_1.default.freemem(),
            loadAvg: os_1.default.loadavg(),
            uptime: os_1.default.uptime(),
            processUptime: process.uptime(),
            nodeVersion: process.version,
            pid: process.pid,
        };
        res.status(200).json({
            success: true,
            systemInfo
        });
    }
    catch (error) {
        logger_1.default.error('Error retrieving system info', { error });
        res.status(500).json({
            success: false,
            message: 'Error retrieving system info',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.getSystemInfo = getSystemInfo;
/**
 * Reset performance metrics
 * @param req - Express request
 * @param res - Express response
 */
const resetMetrics = (req, res) => {
    try {
        // Only allow in development or with admin authorization
        if (process.env.NODE_ENV !== 'development') {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                });
            }
            // In production, would verify admin token here
        }
        // Reset metrics
        performance_1.default.resetMetrics();
        res.status(200).json({
            success: true,
            message: 'Performance metrics reset successfully'
        });
    }
    catch (error) {
        logger_1.default.error('Error resetting metrics', { error });
        res.status(500).json({
            success: false,
            message: 'Error resetting metrics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.resetMetrics = resetMetrics;
