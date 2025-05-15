"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Mock bcrypt module for testing
 */
exports.default = {
    hash: jest.fn().mockResolvedValue('hashed_password'),
    compare: jest.fn().mockResolvedValue(true),
    genSalt: jest.fn().mockResolvedValue('salt')
};
