import { Document } from 'mongoose';
import { AstrologyUserProfile, BusinessProfile, AstrologyPreferences, AstrologySubscription } from './astrology.interfaces';

/**
 * Auth provider enum
 */
export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  GITHUB = 'github',
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  APPLE = 'apple'
}

/**
 * MFA type enum
 */
export enum MFAType {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email'
}

/**
 * Token type enum
 */
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
  RESET_PASSWORD = 'reset_password',
  EMAIL_VERIFICATION = 'email_verification'
}

/**
 * User roles enum
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  CONTENT_MANAGER = 'content_manager',
  SUPPORT = 'support',
  ANALYTICS = 'analytics',
  ASTROLOGER = 'astrologer',
  BUSINESS_USER = 'business_user',
  USER = 'user'
}

/**
 * Theme preference enum
 */
export enum ThemePreference {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: ThemePreference;
  notifications: NotificationPreferences;
  language?: string;
  timezone?: string;
}

/**
 * Security preferences
 */
export interface SecurityPreferences {
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  activityAlerts: boolean;
  trustedDevicesOnly?: boolean;
  passwordExpiryDays?: number;
}

/**
 * User address interface
 */
export interface UserAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * OAuth profile interface
 */
export interface OAuthProfile {
  provider: AuthProvider;
  id: string;
  username?: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  profileUrl?: string;
  photoUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

/**
 * MFA settings interface
 */
export interface MFASettings {
  enabled: boolean;
  type: MFAType;
  secret?: string;
  backupCodes?: string[];
  verified: boolean;
  lastVerified?: Date;
}

/**
 * Password reset interface
 */
export interface PasswordReset {
  token: string;
  expiresAt: Date;
}

/**
 * Email verification interface
 */
export interface EmailVerification {
  token: string;
  expiresAt: Date;
}

/**
 * Login attempt interface
 */
export interface LoginAttempt {
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  successful: boolean;
}

/**
 * User interface
 */
export interface IUser {
  username: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  permissions?: string[];
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin?: Date;
  avatar?: string;
  address?: UserAddress;
  metadata?: Record<string, any>;
  preferences: UserPreferences;
  securityPreferences?: SecurityPreferences;
  mfa?: MFASettings;
  oauthProfiles?: OAuthProfile[];
  passwordReset?: PasswordReset;
  emailVerification?: EmailVerification;
  loginAttempts?: LoginAttempt[];
  accountLocked: boolean;
  accountLockedUntil?: Date;
  passwordLastChanged?: Date;
  
  // Astrology-specific properties
  astrologyProfile?: AstrologyUserProfile;
  businessProfiles?: BusinessProfile[];
  astrologyPreferences?: AstrologyPreferences;
  astrologySubscription?: AstrologySubscription;
  
  // Standard properties
  subscriptionId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User document interface
 */
export interface UserDocument extends Document {
  _id: string;
  username: string;
  mfaSecret?: string;
  mfaEnabled?: boolean;
  mfaRecoveryCodes?: string[];
  failedLoginAttempts?: number;
  lockUntil?: Date;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  permissions?: string[];
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin?: Date;
  avatar?: string;
  address?: UserAddress;
  metadata?: Record<string, any>;
  preferences: UserPreferences;
  securityPreferences?: SecurityPreferences;
  mfa?: MFASettings;
  oauthProfiles?: OAuthProfile[];
  passwordReset?: PasswordReset;
  emailVerification?: EmailVerification;
  loginAttempts?: LoginAttempt[];
  accountLocked: boolean;
  accountLockedUntil?: Date;
  passwordLastChanged?: Date;
  passwordChangedAt?: Date;
  _encrypted?: {
    password?: string;
  };
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  isAccountLocked(): boolean;
  shouldChangePassword(): boolean;
}

/**
 * Auth token interface
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * JWT payload interface
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  mfaVerified?: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Registration request interface
 */
export interface RegistrationRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

/**
 * Login request interface
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * MFA verification request interface
 */
export interface MFAVerificationRequest {
  userId: string;
  code: string;
  rememberDevice?: boolean;
}

/**
 * Password reset request interface
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation request interface
 */
export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

/**
 * Email verification request interface
 */
export interface EmailVerificationRequest {
  token: string;
}

/**
 * OAuth login request interface
 */
export interface OAuthLoginRequest {
  provider: AuthProvider;
  code: string;
  redirectUri: string;
}

/**
 * MFA setup request interface
 */
export interface MFASetupRequest {
  type: MFAType;
  phoneNumber?: string;
}

/**
 * MFA setup verification request interface
 */
export interface MFASetupVerificationRequest {
  code: string;
}

/**
 * Change password request interface
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Refresh token request interface
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Logout request interface
 */
export interface LogoutRequest {
  refreshToken: string;
}

/**
 * Auth response interface
 */
export interface AuthResponse {
  user: Omit<IUser, 'password'>;
  tokens: AuthTokens;
  mfaRequired?: boolean;
}

/**
 * MFA setup response interface
 */
export interface MFASetupResponse {
  secret?: string;
  qrCodeUrl?: string;
  backupCodes?: string[];
}

/**
 * Auth service interface
 */
export interface IAuthService {
  register(userData: RegistrationRequest): Promise<UserDocument>;
  login(loginData: LoginRequest): Promise<AuthResponse>;
  verifyMFA(verificationData: MFAVerificationRequest): Promise<AuthResponse>;
  refreshToken(refreshToken: string): Promise<AuthTokens>;
  logout(refreshToken: string): Promise<boolean>;
  resetPassword(email: string): Promise<boolean>;
  confirmResetPassword(token: string, newPassword: string): Promise<boolean>;
  verifyEmail(token: string): Promise<boolean>;
  setupMFA(userId: string, type: MFAType, phoneNumber?: string): Promise<MFASetupResponse>;
  verifyMFASetup(userId: string, code: string): Promise<boolean>;
  disableMFA(userId: string, password: string): Promise<boolean>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean>;
  oauthLogin(provider: AuthProvider, code: string, redirectUri: string): Promise<AuthResponse>;
}
