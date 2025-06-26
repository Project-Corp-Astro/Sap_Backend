"use strict";
/**
 * Authentication Utility
 * Provides enhanced authentication functionality including OAuth2 and MFA
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disableMfa = exports.verifyRecoveryCode = exports.activateMfa = exports.verifyMfaToken = exports.generateMfaSecret = exports.isTokenBlacklisted = exports.revokeToken = exports.refreshAccessToken = exports.generateTokens = exports.initializeAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const passport_1 = __importDefault(require("passport"));
const passport_jwt_1 = require("passport-jwt");
const passport_local_1 = require("passport-local");
const passport_google_oauth20_1 = require("passport-google-oauth20");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const logger_1 = require("./logger");
const config_1 = __importDefault(require("../config"));
const redis_1 = __importDefault(require("./redis"));
const errorHandler_1 = require("./errorHandler");
// Initialize logger
const logger = (0, logger_1.createServiceLogger)('auth-service');
const jwtConfig = {
    secret: config_1.default.get('jwt.secret', 'your-secret-key-change-in-production'),
    accessExpiresIn: config_1.default.get('jwt.accessExpiresIn', '15m'),
    refreshExpiresIn: config_1.default.get('jwt.refreshExpiresIn', '7d'),
    issuer: config_1.default.get('jwt.issuer', 'sap-api'),
    audience: config_1.default.get('jwt.audience', 'sap-client')
};
const oauthConfig = {
    google: {
        clientID: config_1.default.get('oauth.google.clientId', ''),
        clientSecret: config_1.default.get('oauth.google.clientSecret', ''),
        callbackURL: config_1.default.get('oauth.google.callbackUrl', 'http://localhost:5000/api/auth/google/callback')
    }
};
// Redis key prefixes
const TOKEN_BLACKLIST_PREFIX = 'auth:blacklist:';
const REFRESH_TOKEN_PREFIX = 'auth:refresh:';
const MFA_SECRET_PREFIX = 'auth:mfa:secret:';
const MFA_RECOVERY_PREFIX = 'auth:mfa:recovery:';
/**
 * Initialize authentication strategies
 * @param userModel - Mongoose user model
 */
const initializeAuth = (userModel) => {
    // JWT Strategy
    passport_1.default.use(new passport_jwt_1.Strategy({
        jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: jwtConfig.secret,
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience
    }, (payload, done) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // Check if token is blacklisted
            const isBlacklisted = yield isTokenBlacklisted(payload.jti);
            if (isBlacklisted) {
                return done(null, false, { message: 'Token has been revoked' });
            }
            // Find user by ID
            const user = yield userModel.findById(payload.sub);
            if (!user) {
                return done(null, false, { message: 'User not found' });
            }
            // Check if user is active
            if (!user.isActive) {
                return done(null, false, { message: 'User account is disabled' });
            }
            return done(null, user);
        }
        catch (err) {
            logger.error('JWT authentication error', { error: err.message });
            return done(err);
        }
    })));
    // Local Strategy
    // Using type assertion to work around strict TypeScript definitions
    passport_1.default.use(new passport_local_1.Strategy({
        usernameField: 'email',
        passwordField: 'password'
    }, (email, password, done) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // Find user by email
            const user = yield userModel.findOne({ email });
            if (!user) {
                return done(null, false, { message: 'Invalid email or password' });
            }
            // Check if user is active
            if (!user.isActive) {
                return done(null, false, { message: 'User account is disabled' });
            }
            // Validate password
            const isMatch = yield bcryptjs_1.default.compare(password, user.password);
            if (!isMatch) {
                // Update failed login attempts
                user.loginAttempts = (user.loginAttempts || 0) + 1;
                // Lock account after too many failed attempts
                if (user.loginAttempts >= 5) {
                    user.isLocked = true;
                    user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
                    logger.warn('User account locked due to too many failed login attempts', { userId: user._id });
                }
                yield user.save();
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
                yield user.save();
            }
            // Check if MFA is enabled
            if (user.mfaEnabled) {
                return done(null, user, { mfaRequired: true });
            }
            // Reset login attempts on successful login
            if (user.loginAttempts) {
                user.loginAttempts = 0;
                yield user.save();
            }
            return done(null, user);
        }
        catch (err) {
            logger.error('Local authentication error', { error: err.message });
            return done(err);
        }
    })));
    // Google OAuth Strategy
    if (oauthConfig.google.clientID && oauthConfig.google.clientSecret) {
        // Using type assertion to work around strict TypeScript definitions
        passport_1.default.use(new passport_google_oauth20_1.Strategy({
            clientID: oauthConfig.google.clientID,
            clientSecret: oauthConfig.google.clientSecret,
            callbackURL: oauthConfig.google.callbackURL,
            scope: ['profile', 'email']
        }, (accessToken, refreshToken, profile, done) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                // Check if user exists
                const email = profile.emails[0].value;
                let user = yield userModel.findOne({ email });
                if (!user) {
                    // Create new user
                    user = yield userModel.create({
                        email,
                        firstName: profile.name.givenName,
                        lastName: profile.name.familyName,
                        googleId: profile.id,
                        isActive: true,
                        isVerified: true,
                        authProvider: 'google'
                    });
                    logger.info('New user created via Google OAuth', { userId: user._id });
                }
                else {
                    // Update Google ID if not set
                    if (!user.googleId) {
                        user.googleId = profile.id;
                        user.authProvider = 'google';
                        yield user.save();
                    }
                }
                return done(null, user);
            }
            catch (err) {
                logger.error('Google authentication error', { error: err.message });
                return done(err);
            }
        })));
    }
};
exports.initializeAuth = initializeAuth;
/**
 * Generate JWT tokens (access and refresh)
 * @param user - User object
 * @returns Access and refresh tokens
 */
const generateTokens = (user) => {
    try {
        // Generate unique token IDs
        const accessTokenId = crypto_1.default.randomBytes(16).toString('hex');
        const refreshTokenId = crypto_1.default.randomBytes(16).toString('hex');
        // Create token payload
        const payload = {
            email: user.email,
            role: user.role
        };
        // Generate access token
        // Convert string time values to appropriate type for JWT
        const accessTokenOptions = {
            expiresIn: jwtConfig.accessExpiresIn, // Type casting to avoid TS errors with string format
            subject: user._id.toString(),
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
            jwtid: accessTokenId
        };
        const accessToken = jsonwebtoken_1.default.sign(Object.assign({}, payload), jwtConfig.secret, accessTokenOptions);
        // Generate refresh token
        const refreshTokenOptions = {
            expiresIn: jwtConfig.refreshExpiresIn, // Type casting to avoid TS errors with string format
            subject: user._id.toString(),
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
            jwtid: refreshTokenId
        };
        const refreshToken = jsonwebtoken_1.default.sign(Object.assign({}, payload), jwtConfig.secret, refreshTokenOptions);
        // Store refresh token in Redis
        const refreshTokenExpiry = jsonwebtoken_1.default.decode(refreshToken);
        const ttl = refreshTokenExpiry.exp - Math.floor(Date.now() / 1000);
        redis_1.default.set(`${REFRESH_TOKEN_PREFIX}${refreshTokenId}`, user._id.toString(), ttl).catch(err => {
            logger.error('Error storing refresh token', { error: err.message });
        });
        return { accessToken, refreshToken };
    }
    catch (err) {
        logger.error('Error generating tokens', { error: err.message });
        throw new errorHandler_1.AppError(errorHandler_1.ErrorTypes.INTERNAL_ERROR, `Failed to generate authentication tokens: ${err.message}`);
    }
};
exports.generateTokens = generateTokens;
/**
 * Verify MFA recovery code
 * @param userId - User ID
 * @param recoveryCode - Recovery code
 * @param userModel - Mongoose user model
 * @returns True if valid
 */
const verifyRecoveryCode = (userId, recoveryCode, userModel) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get user
        const user = yield userModel.findById(userId);
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
        yield user.save();
        return true;
    }
    catch (err) {
        logger.error('Error verifying recovery code', { error: err.message });
        return false;
    }
});
exports.verifyRecoveryCode = verifyRecoveryCode;
/**
 * Disable MFA for user
 * @param userId - User ID
 * @param userModel - Mongoose user model
 * @returns True if successful
 */
const disableMfa = (userId, userModel) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Update user model
        const user = yield userModel.findById(userId);
        if (!user) {
            throw new errorHandler_1.AppError(errorHandler_1.ErrorTypes.NOT_FOUND_ERROR, 'User not found');
        }
        user.mfaEnabled = false;
        user.mfaSecret = undefined;
        user.mfaRecoveryCodes = undefined;
        yield user.save();
        return true;
    }
    catch (err) {
        logger.error('Error disabling MFA', { error: err.message });
        throw err;
    }
});
exports.disableMfa = disableMfa;
/**
 * Refresh access token using refresh token
 * @param refreshToken - Refresh token
 * @returns New access token
 */
const refreshAccessToken = (refreshToken) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify refresh token
        const decoded = jsonwebtoken_1.default.verify(refreshToken, jwtConfig.secret);
        // Check if token is in Redis
        const userId = yield redis_1.default.get(`${REFRESH_TOKEN_PREFIX}${decoded.jti}`);
        if (!userId) {
            throw new errorHandler_1.AppError(errorHandler_1.ErrorTypes.AUTHENTICATION_ERROR, 'Invalid refresh token: Token verification failed');
        }
        // Check if token is blacklisted
        const isBlacklisted = yield isTokenBlacklisted(decoded.jti);
        if (isBlacklisted) {
            throw new errorHandler_1.AppError(errorHandler_1.ErrorTypes.AUTHENTICATION_ERROR, 'Token has been revoked: Refresh token has been revoked');
        }
        // Generate new access token
        const accessTokenId = crypto_1.default.randomBytes(16).toString('hex');
        const newAccessTokenOptions = {
            expiresIn: jwtConfig.accessExpiresIn, // Type casting to avoid TS errors with string format
            subject: decoded.sub,
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
            jwtid: accessTokenId
        };
        const accessToken = jsonwebtoken_1.default.sign({
            email: decoded.email,
            role: decoded.role
        }, jwtConfig.secret, newAccessTokenOptions);
        return { accessToken };
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError) {
            throw err;
        }
        if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            throw new errorHandler_1.AppError(errorHandler_1.ErrorTypes.AUTHENTICATION_ERROR, 'Invalid token: Token verification failed');
        }
        logger.error('Error refreshing token', { error: err.message });
        throw new errorHandler_1.AppError(errorHandler_1.ErrorTypes.INTERNAL_ERROR, `Failed to refresh token: ${err.message}`);
    }
});
exports.refreshAccessToken = refreshAccessToken;
/**
 * Revoke tokens
 * @param token - JWT token to revoke
 * @param isRefreshToken - Whether the token is a refresh token
 * @returns True if successful
 */
const revokeToken = (token_1, ...args_1) => __awaiter(void 0, [token_1, ...args_1], void 0, function* (token, isRefreshToken = false) {
    try {
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, jwtConfig.secret);
        // Add token to blacklist
        const expiryTime = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiryTime > 0) {
            yield redis_1.default.set(`${TOKEN_BLACKLIST_PREFIX}${decoded.jti}`, 'revoked', expiryTime);
        }
        // Remove refresh token from Redis if applicable
        if (isRefreshToken) {
            yield redis_1.default.del(`${REFRESH_TOKEN_PREFIX}${decoded.jti}`);
        }
        return true;
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            // Token is already invalid, no need to revoke
            return true;
        }
        logger.error('Error revoking token', { error: err.message });
        throw new errorHandler_1.AppError(errorHandler_1.ErrorTypes.INTERNAL_ERROR, `Failed to revoke token: ${err.message}`);
    }
});
exports.revokeToken = revokeToken;
/**
 * Check if token is blacklisted
 * @param tokenId - JWT token ID
 * @returns True if blacklisted
 */
const isTokenBlacklisted = (tokenId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield redis_1.default.get(`${TOKEN_BLACKLIST_PREFIX}${tokenId}`);
        return !!result;
    }
    catch (err) {
        logger.error('Error checking token blacklist', { error: err.message });
        // Default to not blacklisted in case of error
        return false;
    }
});
exports.isTokenBlacklisted = isTokenBlacklisted;
/**
 * Generate MFA secret for user
 * @param userId - User ID
 * @param email - User email
 * @returns MFA secret and QR code URL
 */
const generateMfaSecret = (userId, email) => __awaiter(void 0, void 0, void 0, function* () {
    // Generate secret
    const secret = speakeasy_1.default.generateSecret({
        length: 20,
        name: `SAP:${email}`
    });
    // Store secret in Redis temporarily (for setup)
    yield redis_1.default.set(`${MFA_SECRET_PREFIX}${userId}`, secret.base32, 600 // 10 minutes
    );
    // Generate recovery codes
    const recoveryCodes = [];
    for (let i = 0; i < 10; i++) {
        recoveryCodes.push(crypto_1.default.randomBytes(10).toString('hex'));
    }
    // Store recovery codes in Redis
    yield redis_1.default.set(`${MFA_RECOVERY_PREFIX}${userId}`, JSON.stringify(recoveryCodes), 600 // 10 minutes
    );
    return {
        secret: secret.base32,
        otpauth_url: secret.otpauth_url || '',
        recoveryCodes
    };
});
exports.generateMfaSecret = generateMfaSecret;
/**
 * Verify MFA token
 * @param userId - User ID
 * @param token - MFA token
 * @param isSetup - Whether this is during setup
 * @returns True if valid
 */
const verifyMfaToken = (userId_1, token_1, ...args_1) => __awaiter(void 0, [userId_1, token_1, ...args_1], void 0, function* (userId, token, isSetup = false) {
    try {
        // Get secret from Redis if setup, otherwise from user model
        const secretKey = isSetup
            ? `${MFA_SECRET_PREFIX}${userId}`
            : `user:${userId}:mfa:secret`;
        const secret = yield redis_1.default.get(secretKey);
        if (!secret) {
            throw new errorHandler_1.AppError(errorHandler_1.ErrorTypes.NOT_FOUND_ERROR, 'MFA secret not found for user');
        }
        // Verify token
        const verified = speakeasy_1.default.totp.verify({
            secret,
            encoding: 'base32',
            token,
            window: 1 // Allow 30 seconds before/after
        });
        return verified;
    }
    catch (err) {
        logger.error('Error verifying MFA token', { error: err.message });
        return false;
    }
});
exports.verifyMfaToken = verifyMfaToken;
/**
 * Activate MFA for user
 * @param userId - User ID
 * @param userModel - Mongoose user model
 * @returns True if successful
 */
const activateMfa = (userId, userModel) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get secret from Redis
        const secret = yield redis_1.default.get(`${MFA_SECRET_PREFIX}${userId}`);
        if (!secret) {
            throw new errorHandler_1.AppError(errorHandler_1.ErrorTypes.NOT_FOUND_ERROR, 'MFA secret not found for user');
        }
        // Get recovery codes from Redis
        const recoveryCodes = yield redis_1.default.get(`${MFA_RECOVERY_PREFIX}${userId}`);
        if (!recoveryCodes) {
            throw new errorHandler_1.AppError(errorHandler_1.ErrorTypes.NOT_FOUND_ERROR, 'MFA recovery codes not found for user');
        }
        // Update user model
        const user = yield userModel.findById(userId);
        if (!user) {
            throw new errorHandler_1.AppError(errorHandler_1.ErrorTypes.NOT_FOUND_ERROR, 'User not found');
        }
        user.mfaEnabled = true;
        user.mfaSecret = secret;
        user.mfaRecoveryCodes = JSON.parse(recoveryCodes);
        yield user.save();
        // Remove temporary Redis keys
        yield redis_1.default.del(`${MFA_SECRET_PREFIX}${userId}`);
        yield redis_1.default.del(`${MFA_RECOVERY_PREFIX}${userId}`);
        return true;
    }
    catch (err) {
        logger.error('Error activating MFA', { error: err.message });
        throw err;
    }
});
exports.activateMfa = activateMfa;
