import mongoose from 'mongoose';
import Token from '../../models/Token';
import { TokenType } from '../../interfaces/auth.interfaces';

describe('Token Model Tests', () => {
  const userId = new mongoose.Types.ObjectId();
  
  const tokenData = {
    userId,
    token: 'test-token-string',
    type: TokenType.REFRESH,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
    isRevoked: false
  };

  beforeEach(async () => {
    // Clear tokens collection before each test
    await Token.deleteMany({});
  });

  it('should create a new token successfully', async () => {
    const newToken = new Token(tokenData);
    const savedToken = await newToken.save();
    
    expect(savedToken._id).toBeDefined();
    expect(savedToken.userId.toString()).toBe(userId.toString());
    expect(savedToken.token).toBe(tokenData.token);
    expect(savedToken.type).toBe(tokenData.type);
    expect(savedToken.expiresAt).toBeInstanceOf(Date);
    expect(savedToken.isRevoked).toBe(false);
    expect(savedToken.createdAt).toBeDefined();
  });

  it('should fail to create a token without required fields', async () => {
    const invalidToken = new Token({
      // Missing required fields
      token: 'only-token-provided'
    });

    await expect(invalidToken.save()).rejects.toThrow();
  });

  it('should validate token type enum values', async () => {
    const tokenWithInvalidType = new Token({
      ...tokenData,
      type: 'invalid_type' // Not in TokenType enum
    });

    await expect(tokenWithInvalidType.save()).rejects.toThrow();
  });

  it('should find tokens by user ID', async () => {
    // Create multiple tokens for the same user
    const token1 = new Token(tokenData);
    const token2 = new Token({
      ...tokenData,
      token: 'another-token',
      type: TokenType.ACCESS
    });
    
    await token1.save();
    await token2.save();
    
    // Find tokens by user ID
    const foundTokens = await Token.find({ userId });
    
    expect(foundTokens).toHaveLength(2);
    expect(foundTokens[0].token).toBeDefined();
    expect(foundTokens[1].token).toBeDefined();
  });

  it('should find tokens by type', async () => {
    // Create tokens with different types
    const refreshToken = new Token(tokenData);
    const accessToken = new Token({
      ...tokenData,
      token: 'access-token',
      type: TokenType.ACCESS
    });
    
    await refreshToken.save();
    await accessToken.save();
    
    // Find tokens by type
    const foundRefreshTokens = await Token.find({ type: TokenType.REFRESH });
    const foundAccessTokens = await Token.find({ type: TokenType.ACCESS });
    
    expect(foundRefreshTokens).toHaveLength(1);
    expect(foundAccessTokens).toHaveLength(1);
    expect(foundRefreshTokens[0].type).toBe(TokenType.REFRESH);
    expect(foundAccessTokens[0].type).toBe(TokenType.ACCESS);
  });

  it('should find non-expired tokens', async () => {
    // Create an expired token
    const expiredToken = new Token({
      ...tokenData,
      token: 'expired-token',
      expiresAt: new Date(Date.now() - 1000) // Already expired
    });
    
    // Create a valid token
    const validToken = new Token(tokenData);
    
    await expiredToken.save();
    await validToken.save();
    
    // Find non-expired tokens
    const nonExpiredTokens = await Token.find({
      expiresAt: { $gt: new Date() }
    });
    
    expect(nonExpiredTokens).toHaveLength(1);
    expect(nonExpiredTokens[0].token).toBe(tokenData.token);
  });

  it('should revoke a token', async () => {
    const token = new Token(tokenData);
    await token.save();
    
    // Revoke the token
    token.isRevoked = true;
    await token.save();
    
    // Find the token
    const foundToken = await Token.findById(token._id);
    
    expect(foundToken).toBeDefined();
    expect(foundToken!.isRevoked).toBe(true);
  });
});
