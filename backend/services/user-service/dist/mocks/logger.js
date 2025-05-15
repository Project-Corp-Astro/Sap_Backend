"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceLogger = void 0;
/**
 * Mock logger for testing
 */
exports.createServiceLogger = jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn()
}));
exports.default = {
    createServiceLogger: exports.createServiceLogger
};
