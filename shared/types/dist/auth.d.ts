/**
 * Authentication related type definitions
 */
export interface LoginRequest {
    email: string;
    password: string;
    mfaCode?: string;
}
export interface RegisterRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
}
export interface AuthResponse {
    user: UserBasic;
    token: string;
    refreshToken: string;
    requiresMfa?: boolean;
}
export interface RefreshTokenRequest {
    refreshToken: string;
}
export interface MfaSetupResponse {
    secret: string;
    qrCodeUrl: string;
}
export interface MfaVerifyRequest {
    code: string;
    secret: string;
}
export interface PasswordResetRequest {
    email: string;
}
export interface PasswordResetConfirmRequest {
    token: string;
    password: string;
}
export interface UserBasic {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    lastLogin?: Date;
}
