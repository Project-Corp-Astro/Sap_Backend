export interface User {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    password: string;
    permissions: string[]; // Store Permission.id
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

export const VALID_PERMISSIONS: Permission[] = [
    { id: 'system.view', name: 'View System', description: 'View system dashboard and metrics', resource: 'system', action: 'read' },
    { id: 'system.configure', name: 'Configure System', description: 'Configure system-wide settings', resource: 'system', action: 'manage' },
    { id: 'system.manage_roles', name: 'Manage Roles', description: 'Create, edit, and delete user roles', resource: 'system', action: 'manage' },
    { id: 'system.view_logs', name: 'View Logs', description: 'Access and view system logs', resource: 'system', action: 'read' },
    { id: 'users.view', name: 'View Users', description: 'View all user accounts', resource: 'users', action: 'read' },
    { id: 'users.create', name: 'Create Users', description: 'Create new user accounts', resource: 'users', action: 'create' },
    { id: 'users.edit', name: 'Edit Users', description: 'Edit existing user accounts', resource: 'users', action: 'update' },
    { id: 'users.delete', name: 'Delete Users', description: 'Delete user accounts', resource: 'users', action: 'delete' },
    { id: 'users.impersonate', name: 'Impersonate Users', description: 'Log in as another user', resource: 'users', action: 'manage' },
    { id: 'content.view', name: 'View Content', description: 'View all content', resource: 'content', action: 'read' },
    { id: 'content.create', name: 'Create Content', description: 'Create new content', resource: 'content', action: 'create' },
    { id: 'content.edit', name: 'Edit Content', description: 'Edit existing content', resource: 'content', action: 'update' },
    { id: 'content.delete', name: 'Delete Content', description: 'Delete content', resource: 'content', action: 'delete' },
    { id: 'content.publish', name: 'Publish Content', description: 'Publish or unpublish content', resource: 'content', action: 'manage' },
    { id: 'content.approve', name: 'Approve Content', description: 'Approve content for publication', resource: 'content', action: 'manage' },
    { id: 'analytics.view', name: 'View Analytics', description: 'View analytics data', resource: 'analytics', action: 'read' },
    { id: 'analytics.export', name: 'Export Analytics', description: 'Export analytics data', resource: 'analytics', action: 'read' },
    { id: 'analytics.configure', name: 'Configure Analytics', description: 'Configure analytics settings', resource: 'analytics', action: 'manage' },
    { id: 'app.corpastra.manage', name: 'Manage CorpAstro', description: 'Manage CorpAstro application', resource: 'applications', action: 'manage' },
    { id: 'app.grahvani.manage', name: 'Manage Grahvani', description: 'Manage Grahvani application', resource: 'applications', action: 'manage' },
    { id: 'app.tellmystars.manage', name: 'Manage TellMyStars', description: 'Manage TellMyStars application', resource: 'applications', action: 'manage' }
];

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