/**
 * Authentication Utility
 * Provides enhanced authentication functionality including OAuth2 and MFA
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, VerifiedCallback } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import { createServiceLogger } from './logger';
import config from '../config';
import redisClient from './redis';
import { AppError, ErrorTypes } from './errorHandler';
import { Model } from 'mongoose';

// Initialize logger
const logger = createServiceLogger('auth-service');

// JWT configuration
interface JwtConfig {
  secret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  issuer: string;
  audience: string;
}

const jwtConfig: JwtConfig = {
  secret: config.get('jwt.secret', 'your-secret-key-change-in-production'),
  accessExpiresIn: config.get('jwt.accessExpiresIn', '15m'),
  refreshExpiresIn: config.get('jwt.refreshExpiresIn', '7d'),
  issuer: config.get('jwt.issuer', 'sap-api'),
  audience: config.get('jwt.audience', 'sap-client')
};

// OAuth configuration
interface OAuthConfig {
  google: {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  };
}

const oauthConfig: OAuthConfig = {
  google: {
    clientID: config.get('oauth.google.clientId', ''),
    clientSecret: config.get('oauth.google.clientSecret', ''),
    callbackURL: config.get('oauth.google.callbackUrl', 'http://localhost:5000/api/auth/google/callback')
  }
};

// Redis key prefixes
const TOKEN_BLACKLIST_PREFIX = 'auth:blacklist:';
const REFRESH_TOKEN_PREFIX = 'auth:refresh:';
const MFA_SECRET_PREFIX = 'auth:mfa:secret:';
const MFA_RECOVERY_PREFIX = 'auth:mfa:recovery:';

// User interface
interface UserDocument {
  _id: string;
  email: string;
  password: string;
  isActive: boolean;
  loginAttempts?: number;
  isLocked?: boolean;
  lockUntil?: Date;
  mfaEnabled?: boolean;
  mfaSecret?: string;
  mfaRecoveryCodes?: string[];
  googleId?: string;
  authProvider?: string;
  isVerified?: boolean;
  firstName?: string;
  lastName?: string;
  role?: string;
  save(): Promise<UserDocument>;
}

// Token interfaces
interface TokenPayload {
  sub: string;
  iat: number;
  exp: number;
  jti: string;
  iss: string;
  aud: string;
  email: string;
  role?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface MfaSetupResult {
  secret: string;
  otpauth_url: string;
  recoveryCodes: string[];
}

/**
 * Initialize authentication strategies
 * @param userModel - Mongoose user model
 */
const initializeAuth = (userModel: Model<UserDocument>): void => {
  // JWT Strategy
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtConfig.secret,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience
  }, async (payload: TokenPayload, done: VerifiedCallback) => {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await isTokenBlacklisted(payload.jti);
      if (isBlacklisted) {
        return done(null, false, { message: 'Token has been revoked' });
      }

      // Find user by ID
      const user = await userModel.findById(payload.sub);
      if (!user) {
        return done(null, false, { message: 'User not found' });
      }

      // Check if user is active
      if (!user.isActive) {
        return done(null, false, { message: 'User account is disabled' });
      }

      return done(null, user);
    } catch (err) {
      logger.error('JWT authentication error', { error: (err as Error).message });
      return done(err as Error);
    }
  }));

  // Local Strategy
  // Using type assertion to work around strict TypeScript definitions
  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    } as any,
    async (email: string, password: string, done: any) => {
    try {
      // Find user by email
      const user = await userModel.findOne({ email });
      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      // Check if user is active
      if (!user.isActive) {
        return done(null, false, { message: 'User account is disabled' });
      }

      // Validate password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        // Update failed login attempts
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        
        // Lock account after too many failed attempts
        if (user.loginAttempts >= 5) {
          user.isLocked = true;
          user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
          logger.warn('User account locked due to too many failed login attempts', { userId: user._id });
        }
        
        await user.save();
        return done(null, false, { message: 'Invalid email or password' });
      }

      // Check if account is locked
      if (user.isLocked) {
        if (user.lockUntil && user.lockUntil > new Date()) {
          return done(null, false, { message: 'Account is locked. Try again later.' });
        }
        
        // Unlock account if lock period has expired
        user.isLocked = false;
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();
      }

      // Check if MFA is enabled
      if (user.mfaEnabled) {
        return done(null, user, { mfaRequired: true });
      }

      // Reset login attempts on successful login
      if (user.loginAttempts) {
        user.loginAttempts = 0;
        await user.save();
      }

      return done(null, user);
    } catch (err) {
      logger.error('Local authentication error', { error: (err as Error).message });
      return done(err as Error);
    }
  }));

  // Google OAuth Strategy
  if (oauthConfig.google.clientID && oauthConfig.google.clientSecret) {
    // Using type assertion to work around strict TypeScript definitions
    passport.use(new GoogleStrategy(
      {
        clientID: oauthConfig.google.clientID,
        clientSecret: oauthConfig.google.clientSecret,
        callbackURL: oauthConfig.google.callbackURL,
        scope: ['profile', 'email']
      } as any,
      async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        // Check if user exists
        const email = profile.emails[0].value;
        let user = await userModel.findOne({ email });

        if (!user) {
          // Create new user
          user = await userModel.create({
            email,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            googleId: profile.id,
            isActive: true,
            isVerified: true,
            authProvider: 'google'
          });
          logger.info('New user created via Google OAuth', { userId: user._id });
        } else {
          // Update Google ID if not set
          if (!user.googleId) {
            user.googleId = profile.id;
            user.authProvider = 'google';
            await user.save();
          }
        }

        return done(null, user);
      } catch (err) {
        logger.error('Google authentication error', { error: (err as Error).message });
        return done(err as Error);
      }
    }));
  }
};

/**
 * Generate JWT tokens (access and refresh)
 * @param user - User object
 * @returns Access and refresh tokens
 */
const generateTokens = (user: UserDocument): TokenPair => {
  try {
    // Generate unique token IDs
    const accessTokenId = crypto.randomBytes(16).toString('hex');
    const refreshTokenId = crypto.randomBytes(16).toString('hex');

    // Create token payload
    const payload = {
      email: user.email,
      role: user.role
    };

    // Generate access token
    // Convert string time values to appropriate type for JWT
    const accessTokenOptions: SignOptions = {
      expiresIn: jwtConfig.accessExpiresIn as any, // Type casting to avoid TS errors with string format
      subject: user._id.toString(),
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      jwtid: accessTokenId
    };
    
    const accessToken = jwt.sign(
      { ...payload },
      jwtConfig.secret,
      accessTokenOptions
    );

    // Generate refresh token
    const refreshTokenOptions: SignOptions = {
      expiresIn: jwtConfig.refreshExpiresIn as any, // Type casting to avoid TS errors with string format
      subject: user._id.toString(),
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      jwtid: refreshTokenId
    };
    
    const refreshToken = jwt.sign(
      { ...payload },
      jwtConfig.secret,
      refreshTokenOptions
    );

    // Store refresh token in Redis
    const refreshTokenExpiry = jwt.decode(refreshToken) as TokenPayload;
    const ttl = refreshTokenExpiry.exp - Math.floor(Date.now() / 1000);
    
    redisClient.set(
      `${REFRESH_TOKEN_PREFIX}${refreshTokenId}`,
      user._id.toString(),
      ttl
    ).catch(err => {
      logger.error('Error storing refresh token', { error: err.message });
    });

    return { accessToken, refreshToken };
  } catch (err) {
    logger.error('Error generating tokens', { error: (err as Error).message });
    throw new AppError(ErrorTypes.INTERNAL_ERROR, `Failed to generate authentication tokens: ${(err as Error).message}`);
  }
};

/**
 * Verify MFA recovery code
 * @param userId - User ID
 * @param recoveryCode - Recovery code
 * @param userModel - Mongoose user model
 * @returns True if valid
 */
const verifyRecoveryCode = async (userId: string, recoveryCode: string, userModel: Model<UserDocument>): Promise<boolean> => {
  try {
    // Get user
    const user = await userModel.findById(userId);
    if (!user || !user.mfaEnabled || !user.mfaRecoveryCodes) {
      return false;
    }

    // Check if recovery code exists
    const index = user.mfaRecoveryCodes.indexOf(recoveryCode);
    if (index === -1) {
      return false;
    }

    // Remove used recovery code
    user.mfaRecoveryCodes.splice(index, 1);
    await user.save();

    return true;
  } catch (err) {
    logger.error('Error verifying recovery code', { error: (err as Error).message });
    return false;
  }
};

/**
 * Disable MFA for user
 * @param userId - User ID
 * @param userModel - Mongoose user model
 * @returns True if successful
 */
const disableMfa = async (userId: string, userModel: Model<UserDocument>): Promise<boolean> => {
  try {
    // Update user model
    const user = await userModel.findById(userId);
    if (!user) {
      throw new AppError(ErrorTypes.NOT_FOUND_ERROR, 'User not found');
    }

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaRecoveryCodes = undefined;
    await user.save();

    return true;
  } catch (err) {
    logger.error('Error disabling MFA', { error: (err as Error).message });
    throw err;
  }
};

/**
 * Refresh access token using refresh token
 * @param refreshToken - Refresh token
 * @returns New access token
 */
const refreshAccessToken = async (refreshToken: string): Promise<{ accessToken: string }> => {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, jwtConfig.secret) as TokenPayload;
    
    // Check if token is in Redis
    const userId = await redisClient.get(`${REFRESH_TOKEN_PREFIX}${decoded.jti}`);
    if (!userId) {
      throw new AppError(ErrorTypes.AUTHENTICATION_ERROR, 'Invalid refresh token: Token verification failed');
    }

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(decoded.jti);
    if (isBlacklisted) {
      throw new AppError(ErrorTypes.AUTHENTICATION_ERROR, 'Token has been revoked: Refresh token has been revoked');
    }

    // Generate new access token
    const accessTokenId = crypto.randomBytes(16).toString('hex');
    
    const newAccessTokenOptions: SignOptions = {
      expiresIn: jwtConfig.accessExpiresIn as any, // Type casting to avoid TS errors with string format
      subject: decoded.sub,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      jwtid: accessTokenId
    };
    
    const accessToken = jwt.sign(
      {
        email: decoded.email,
        role: decoded.role
      },
      jwtConfig.secret,
      newAccessTokenOptions
    );

    return { accessToken };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AppError(ErrorTypes.AUTHENTICATION_ERROR, 'Invalid token: Token verification failed');
    }
    
    logger.error('Error refreshing token', { error: (err as Error).message });
    throw new AppError(ErrorTypes.INTERNAL_ERROR, `Failed to refresh token: ${(err as Error).message}`);
  }
};

/**
 * Revoke tokens
 * @param token - JWT token to revoke
 * @param isRefreshToken - Whether the token is a refresh token
 * @returns True if successful
 */
const revokeToken = async (token: string, isRefreshToken = false): Promise<boolean> => {
  try {
    // Verify token
    const decoded = jwt.verify(token, jwtConfig.secret) as TokenPayload;
    
    // Add token to blacklist
    const expiryTime = decoded.exp - Math.floor(Date.now() / 1000);
    if (expiryTime > 0) {
      await redisClient.set(
        `${TOKEN_BLACKLIST_PREFIX}${decoded.jti}`,
        'revoked',
        expiryTime
      );
    }

    // Remove refresh token from Redis if applicable
    if (isRefreshToken) {
      await redisClient.del(`${REFRESH_TOKEN_PREFIX}${decoded.jti}`);
    }

    return true;
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      // Token is already invalid, no need to revoke
      return true;
    }
    
    logger.error('Error revoking token', { error: (err as Error).message });
    throw new AppError(ErrorTypes.INTERNAL_ERROR, `Failed to revoke token: ${(err as Error).message}`);
  }
};

/**
 * Check if token is blacklisted
 * @param tokenId - JWT token ID
 * @returns True if blacklisted
 */
const isTokenBlacklisted = async (tokenId: string): Promise<boolean> => {
  try {
    const result = await redisClient.get(`${TOKEN_BLACKLIST_PREFIX}${tokenId}`);
    return !!result;
  } catch (err) {
    logger.error('Error checking token blacklist', { error: (err as Error).message });
    // Default to not blacklisted in case of error
    return false;
  }
};

/**
 * Generate MFA secret for user
 * @param userId - User ID
 * @param email - User email
 * @returns MFA secret and QR code URL
 */
const generateMfaSecret = async (userId: string, email: string): Promise<MfaSetupResult> => {
  // Generate secret
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `SAP:${email}`
  });

  // Store secret in Redis temporarily (for setup)
  await redisClient.set(
    `${MFA_SECRET_PREFIX}${userId}`,
    secret.base32,
    600 // 10 minutes
  );

  // Generate recovery codes
  const recoveryCodes: string[] = [];
  for (let i = 0; i < 10; i++) {
    recoveryCodes.push(crypto.randomBytes(10).toString('hex'));
  }

  // Store recovery codes in Redis
  await redisClient.set(
    `${MFA_RECOVERY_PREFIX}${userId}`,
    JSON.stringify(recoveryCodes),
    600 // 10 minutes
  );

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url || '',
    recoveryCodes
  };
};

/**
 * Verify MFA token
 * @param userId - User ID
 * @param token - MFA token
 * @param isSetup - Whether this is during setup
 * @returns True if valid
 */
const verifyMfaToken = async (userId: string, token: string, isSetup = false): Promise<boolean> => {
  try {
    // Get secret from Redis if setup, otherwise from user model
    const secretKey = isSetup
      ? `${MFA_SECRET_PREFIX}${userId}`
      : `user:${userId}:mfa:secret`;

    const secret = await redisClient.get(secretKey);
    if (!secret) {
      throw new AppError(ErrorTypes.NOT_FOUND_ERROR, 'MFA secret not found for user');
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1 // Allow 30 seconds before/after
    });

    return verified;
  } catch (err) {
    logger.error('Error verifying MFA token', { error: (err as Error).message });
    return false;
  }
};

/**
 * Activate MFA for user
 * @param userId - User ID
 * @param userModel - Mongoose user model
 * @returns True if successful
 */
const activateMfa = async (userId: string, userModel: Model<UserDocument>): Promise<boolean> => {
  try {
    // Get secret from Redis
    const secret = await redisClient.get(`${MFA_SECRET_PREFIX}${userId}`);
    if (!secret) {
      throw new AppError(ErrorTypes.NOT_FOUND_ERROR, 'MFA secret not found for user');
    }

    // Get recovery codes from Redis
    const recoveryCodes = await redisClient.get(`${MFA_RECOVERY_PREFIX}${userId}`);
    if (!recoveryCodes) {
      throw new AppError(ErrorTypes.NOT_FOUND_ERROR, 'MFA recovery codes not found for user');
    }

    // Update user model
    const user = await userModel.findById(userId);
    if (!user) {
      throw new AppError(ErrorTypes.NOT_FOUND_ERROR, 'User not found');
    }

    user.mfaEnabled = true;
    user.mfaSecret = secret;
    user.mfaRecoveryCodes = JSON.parse(recoveryCodes);
    await user.save();

    // Remove temporary Redis keys
    await redisClient.del(`${MFA_SECRET_PREFIX}${userId}`);
    await redisClient.del(`${MFA_RECOVERY_PREFIX}${userId}`);

    return true;
  } catch (err) {
    logger.error('Error activating MFA', { error: (err as Error).message });
    throw err;
  }
};

export {
  initializeAuth,
  generateTokens,
  refreshAccessToken,
  revokeToken,
  isTokenBlacklisted,
  generateMfaSecret,
  verifyMfaToken,
  activateMfa,
  verifyRecoveryCode,
  disableMfa,
  UserDocument,
  TokenPair,
  MfaSetupResult
};
