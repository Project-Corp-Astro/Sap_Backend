/**
 * Mock Auth Service for testing
 */

export const register = jest.fn().mockImplementation((userData) => {
  return Promise.resolve({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        ...userData,
        password: undefined // Password should not be returned
      }
    }
  });
});

export const login = jest.fn().mockImplementation((email, password) => {
  return Promise.resolve({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        _id: 'mock-user-id',
        email,
        role: 'user'
      },
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600
      }
    }
  });
});

export const refreshToken = jest.fn().mockImplementation((token) => {
  return Promise.resolve({
    accessToken: 'new-mock-access-token',
    refreshToken: 'new-mock-refresh-token',
    expiresIn: 3600
  });
});

export const generateTokens = jest.fn().mockImplementation((user) => {
  return Promise.resolve({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600
  });
});

export const trackLoginAttempt = jest.fn().mockImplementation((userId, ip, successful) => {
  return Promise.resolve();
});

export const setupMFA = jest.fn().mockImplementation((userId) => {
  return Promise.resolve({
    secret: 'mock-mfa-secret',
    qrCodeUrl: 'mock-qr-code-url'
  });
});

export const verifyMFA = jest.fn().mockImplementation((userId, code) => {
  return Promise.resolve(true);
});

export const generateRecoveryCodes = jest.fn().mockImplementation((userId) => {
  return Promise.resolve(['code1', 'code2', 'code3', 'code4', 'code5']);
});

export const requestPasswordReset = jest.fn().mockImplementation((email) => {
  return Promise.resolve(true);
});

export const resetPassword = jest.fn().mockImplementation((token, newPassword) => {
  return Promise.resolve(true);
});
