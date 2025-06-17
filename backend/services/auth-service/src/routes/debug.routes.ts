import { Router } from 'express';
import { redisClient, otpCache, redisUtils } from '../utils/redis';
import User from '../models/User';
import logger from '../../../../shared/utils/logger';

const router = Router();

/**
 * Test route to manually generate and store an OTP in Redis
 * GET /api/debug/test-otp?email=test@example.com
 */
router.get('/test-otp', async (req, res): Promise<any> => {
  try {
    const email = req.query.email as string;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email parameter is required'
      });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Generate an OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Store in Redis with multiple approaches to debug
    const results = {
      directClient: false,
      otpCache: false,
      redisUtils: false
    };
    
    // Method 1: Using direct Redis client
    try {
      const key1 = `auth:otp:direct:${user._id}`;
      await redisClient.set(key1, otp, 'EX', 300);
      results.directClient = true;
    } catch (error) {
      logger.error('Direct Redis client OTP storage failed:', error);
    }
    
    // Method 2: Using OTP Cache
    try {
      const key2 = `password_reset:${user._id}`;
      const success = await otpCache.set(key2, otp, 300);
      results.otpCache = !!success;
    } catch (error) {
      logger.error('OTP cache storage failed:', error);
    }
    
    // Method 3: Using Redis Utils
    try {
      const success = await redisUtils.setOTP(user._id.toString(), 'test', otp, 300);
      results.redisUtils = !!success;
    } catch (error) {
      logger.error('Redis utils OTP storage failed:', error);
    }
    
    // Get all keys in DB 1 for debugging
    await redisClient.select(1);
    const allKeys = await redisClient.keys('*');
    
    // Return results
    return res.status(200).json({
      success: true,
      message: 'OTP test completed',
      data: {
        userId: user._id.toString(),
        email: user.email,
        otp,
        results,
        redisDbChecked: 1,
        allKeysInDb1: allKeys,
        keysToCheck: [
          `auth:otp:direct:${user._id}`,
          `auth:otp:password_reset:${user._id}`,
          `auth:otp:otp:${user._id}:test`
        ]
      }
    });
  } catch (error) {
    logger.error('Error in test-otp route:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get Redis connection status
 * GET /api/debug/redis-status
 */
router.get('/redis-status', async (req, res): Promise<any> => {
  try {
    // Test Redis connection
    const pingResult = await redisUtils.pingRedis();
    
    // Test direct client connection
    let directPing = false;
    try {
      const response = await redisClient.ping();
      directPing = response === 'PONG';
    } catch (error) {
      logger.error('Direct Redis ping failed:', error);
    }
    
    // Get info about Redis server
    let info = null;
    try {
      info = await redisClient.info();
    } catch (error) {
      logger.error('Redis INFO command failed:', error);
    }
    
    return res.status(200).json({
      success: true,
      data: {
        redisConnected: pingResult,
        directClientConnected: directPing,
        redisInfo: info ? info.split('\r\n').filter(line => 
          line.includes('redis_version') || 
          line.includes('connected_clients') ||
          line.includes('used_memory') ||
          line.includes('db')
        ) : null
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking Redis status',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
