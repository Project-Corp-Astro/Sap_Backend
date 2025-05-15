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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapController = exports.userController = void 0;
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const userController = __importStar(require("../controllers/user.controller"));
exports.userController = userController;
const auth_middleware_1 = require("../middlewares/auth.middleware");
const user_interfaces_1 = require("../interfaces/user.interfaces");
const asRequestHandler = (handler) => handler;
// Wrapper function for controller functions to fix TypeScript compatibility issues
const wrapController = (controller) => {
    return (req, res, next) => {
        // @ts-ignore - Suppressing TypeScript errors for controller compatibility
        return controller(req, res, next);
    };
};
exports.wrapController = wrapController;
// This is a temporary solution until we can properly fix the middleware type compatibility
const router = express_1.default.Router();
/**
 * @route GET /api/users
 * @desc Get all users with pagination and filtering
 * @access Private (Admin, Content Manager)
 */
router.get('/', asRequestHandler(auth_middleware_1.authMiddleware), asRequestHandler((0, auth_middleware_1.roleAuthorization)([user_interfaces_1.UserRole.ADMIN, user_interfaces_1.UserRole.CONTENT_MANAGER])), (0, exports.wrapController)(userController.getUsers));
/**
 * @route POST /api/users
 * @desc Create a new user
 * @access Private (Admin only)
 */
router.post('/', asRequestHandler(auth_middleware_1.authMiddleware), asRequestHandler((0, auth_middleware_1.roleAuthorization)([user_interfaces_1.UserRole.ADMIN])), (0, exports.wrapController)(userController.createUser));
/**
 * @route GET /api/users/:userId
 * @desc Get user by ID
 * @access Private (Admin, Content Manager, or Self)
 */
router.get('/:userId', asRequestHandler(auth_middleware_1.authMiddleware), (0, exports.wrapController)(userController.getUserById));
/**
 * @route PUT /api/users/:userId
 * @desc Update user
 * @access Private (Admin or Self)
 */
router.put('/:userId', asRequestHandler(auth_middleware_1.authMiddleware), (0, exports.wrapController)(userController.updateUser));
/**
 * @route DELETE /api/users/:userId
 * @desc Delete user
 * @access Private (Admin only)
 */
router.delete('/:userId', asRequestHandler(auth_middleware_1.authMiddleware), asRequestHandler((0, auth_middleware_1.roleAuthorization)([user_interfaces_1.UserRole.ADMIN])), (0, exports.wrapController)(userController.deleteUser));
/**
 * @route PATCH /api/users/:userId/status
 * @desc Update user active status
 * @access Private (Admin only)
 */
router.patch('/:userId/status', asRequestHandler(auth_middleware_1.authMiddleware), asRequestHandler((0, auth_middleware_1.roleAuthorization)([user_interfaces_1.UserRole.ADMIN])), (0, exports.wrapController)(userController.updateUserStatus));
/**
 * @route PUT /api/users/profile
 * @desc Update authenticated user's profile
 * @access Private
 */
router.put('/profile', asRequestHandler(auth_middleware_1.authMiddleware), [
    (0, express_validator_1.check)('firstName', 'First name is required').optional().notEmpty(),
    (0, express_validator_1.check)('lastName', 'Last name is required').optional().notEmpty(),
    (0, express_validator_1.check)('phoneNumber', 'Phone number must be valid').optional().isMobilePhone('any')
], (0, exports.wrapController)(userController.updateProfile));
/**
 * @route PUT /api/users/password
 * @desc Change user password
 * @access Private
 */
router.put('/password', asRequestHandler(auth_middleware_1.authMiddleware), [
    (0, express_validator_1.check)('currentPassword', 'Current password is required').notEmpty(),
    (0, express_validator_1.check)('newPassword', 'Password must be at least 8 characters').isLength({ min: 8 })
], (0, exports.wrapController)(userController.changePassword));
/**
 * @route PUT /api/users/security-preferences
 * @desc Update user security preferences
 * @access Private
 */
router.put('/security-preferences', asRequestHandler(auth_middleware_1.authMiddleware), (0, exports.wrapController)(userController.updateSecurityPreferences));
/**
 * @route GET /api/users/:userId/activity
 * @desc Get user activity log
 * @access Private (Self or Admin)
 */
router.get('/:userId/activity', asRequestHandler(auth_middleware_1.authMiddleware), (0, exports.wrapController)(userController.getUserActivity));
/**
 * @route GET /api/users/devices
 * @desc Get user devices
 * @access Private
 */
router.get('/devices', asRequestHandler(auth_middleware_1.authMiddleware), (0, exports.wrapController)(userController.getUserDevices));
/**
 * @route DELETE /api/users/devices/:deviceId
 * @desc Remove user device
 * @access Private
 */
router.delete('/devices/:deviceId', asRequestHandler(auth_middleware_1.authMiddleware), (0, exports.wrapController)(userController.removeUserDevice));
exports.default = router;
