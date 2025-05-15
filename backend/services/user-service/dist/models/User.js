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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const user_interfaces_1 = require("../interfaces/user.interfaces");
const userSchema = new mongoose_1.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: Object.values(user_interfaces_1.UserRole),
        default: user_interfaces_1.UserRole.USER
    },
    permissions: [{
            type: String
        }],
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    avatar: {
        type: String
    },
    metadata: {
        type: Map,
        of: mongoose_1.default.Schema.Types.Mixed
    },
    preferences: {
        theme: {
            type: String,
            enum: Object.values(user_interfaces_1.ThemePreference),
            default: user_interfaces_1.ThemePreference.SYSTEM
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            push: {
                type: Boolean,
                default: true
            }
        }
    },
    securityPreferences: {
        twoFactorEnabled: {
            type: Boolean,
            default: false
        },
        loginNotifications: {
            type: Boolean,
            default: true
        },
        activityAlerts: {
            type: Boolean,
            default: true
        }
    },
    devices: [{
            deviceId: String,
            deviceName: String,
            deviceType: String,
            browser: String,
            operatingSystem: String,
            lastUsed: Date,
            ipAddress: String,
            isTrusted: Boolean,
            userAgent: String,
            location: {
                country: String,
                city: String,
                latitude: Number,
                longitude: Number
            }
        }],
    subscriptionId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Subscription'
    }
}, {
    timestamps: true
});
// Create indexes for faster queries
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'devices.deviceId': 1 });
// Note: Password management is handled by auth-service, 
// this service only deals with user data
const User = (0, mongoose_1.model)('User', userSchema);
exports.default = User;
