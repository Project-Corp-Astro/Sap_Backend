"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceType = void 0;
const mongoose_1 = require("mongoose");
/**
 * Device type enum
 */
var DeviceType;
(function (DeviceType) {
    DeviceType["MOBILE"] = "mobile";
    DeviceType["TABLET"] = "tablet";
    DeviceType["DESKTOP"] = "desktop";
    DeviceType["OTHER"] = "other";
})(DeviceType || (exports.DeviceType = DeviceType = {}));
/**
 * User device schema
 * Tracks devices used to access the application for security purposes
 */
const userDeviceSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    deviceId: {
        type: String,
        required: true
    },
    deviceName: {
        type: String,
        required: true
    },
    deviceType: {
        type: String,
        enum: Object.values(DeviceType),
        default: DeviceType.OTHER
    },
    browser: {
        type: String,
        default: ''
    },
    operatingSystem: {
        type: String,
        default: ''
    },
    ipAddress: {
        type: String,
        default: ''
    },
    lastUsed: {
        type: Date,
        default: Date.now
    },
    isTrusted: {
        type: Boolean,
        default: false
    },
    userAgent: {
        type: String,
        default: ''
    },
    location: {
        type: {
            country: String,
            city: String,
            latitude: Number,
            longitude: Number
        },
        default: null
    }
}, {
    timestamps: true
});
// Compound index for uniqueness per user
userDeviceSchema.index({ user: 1, deviceId: 1 }, { unique: true });
userDeviceSchema.index({ user: 1, lastUsed: -1 });
const UserDevice = (0, mongoose_1.model)('UserDevice', userDeviceSchema);
exports.default = UserDevice;
