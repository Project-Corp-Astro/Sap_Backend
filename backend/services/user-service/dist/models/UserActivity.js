"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityType = void 0;
const mongoose_1 = require("mongoose");
/**
 * Activity type enum
 */
var ActivityType;
(function (ActivityType) {
    ActivityType["LOGIN"] = "login";
    ActivityType["LOGOUT"] = "logout";
    ActivityType["PASSWORD_CHANGE"] = "password_change";
    ActivityType["PROFILE_UPDATE"] = "profile_update";
    ActivityType["SECURITY_UPDATE"] = "security_update";
    ActivityType["MFA_ENABLED"] = "mfa_enabled";
    ActivityType["MFA_DISABLED"] = "mfa_disabled";
    ActivityType["DEVICE_ADDED"] = "device_added";
    ActivityType["DEVICE_REMOVED"] = "device_removed";
    ActivityType["FAILED_LOGIN"] = "failed_login";
    ActivityType["PASSWORD_RESET"] = "password_reset";
    ActivityType["EMAIL_CHANGE"] = "email_change";
    ActivityType["ACCOUNT_LOCKED"] = "account_locked";
    ActivityType["ACCOUNT_UNLOCKED"] = "account_unlocked";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
/**
 * User activity schema
 * Tracks user actions and events for security and audit purposes
 */
const userActivitySchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: Object.values(ActivityType)
    },
    description: {
        type: String,
        required: true
    },
    metadata: {
        type: Object,
        default: {}
    },
    ipAddress: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    },
    successful: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});
// Index for faster queries
userActivitySchema.index({ user: 1, createdAt: -1 });
userActivitySchema.index({ type: 1 });
const UserActivity = (0, mongoose_1.model)('UserActivity', userActivitySchema);
exports.default = UserActivity;
