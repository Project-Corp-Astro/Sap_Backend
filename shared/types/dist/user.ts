/**
 * User related type definitions
 */
export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    permissions: Permission[];
    department?: string;
    position?: string;
    isActive: boolean;
    isMfaEnabled: boolean;
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
    profileImage?: string;
    metadata?: Record<string, any>;
}
export interface AdminUser extends User {
    managedDepartments?: string[];
    securityLevel: number;
    canImpersonate: boolean;
}
export enum UserRole {
    SUPER_ADMIN = "super_admin",
    ADMIN = "admin",
    MANAGER = "manager",
    EDITOR = "editor",
    USER = "user",
    GUEST = "guest"
}
export interface Permission {
    id: string;
    name: string;
    description: string;
    resource: string;
    action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}
export interface UserProfile {
    userId: string;
    bio?: string;
    phoneNumber?: string;
    address?: Address;
    preferences: UserPreferences;
    socialLinks?: SocialLinks;
}
export interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
}
export interface UserPreferences {
    theme: 'light' | 'dark' | 'system';
    language: string;
    notifications: NotificationPreferences;
    accessibility?: AccessibilityPreferences;
}
export interface NotificationPreferences {
    email: boolean;
    push: boolean;
    sms: boolean;
    inApp: boolean;
}
export interface AccessibilityPreferences {
    highContrast: boolean;
    largeText: boolean;
    screenReader: boolean;
}
export interface SocialLinks {
    linkedin?: string;
    twitter?: string;
    github?: string;
    website?: string;
}
