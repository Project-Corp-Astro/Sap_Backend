"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemePreference = exports.UserRole = void 0;
/**
 * User roles enum
 */
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["CONTENT_MANAGER"] = "content_manager";
    UserRole["SUPPORT"] = "support";
    UserRole["ANALYTICS"] = "analytics";
    UserRole["USER"] = "user";
})(UserRole || (exports.UserRole = UserRole = {}));
/**
 * Theme preference enum
 */
var ThemePreference;
(function (ThemePreference) {
    ThemePreference["LIGHT"] = "light";
    ThemePreference["DARK"] = "dark";
    ThemePreference["SYSTEM"] = "system";
})(ThemePreference || (exports.ThemePreference = ThemePreference = {}));
