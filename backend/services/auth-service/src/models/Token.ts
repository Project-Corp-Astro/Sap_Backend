import mongoose, { Schema, Document } from 'mongoose';
import { TokenType } from '../interfaces/auth.interfaces';

/**
 * Token interface
 */
export interface IToken {
  userId: mongoose.Types.ObjectId;
  token: string;
  type: TokenType;
  expiresAt: Date;
  isRevoked: boolean;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Token document interface
 */
export interface TokenDocument extends IToken, Document {
  _id: string;
}

/**
 * Token schema
 */
const TokenSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true
    },
    type: {
      type: String,
      enum: Object.values(TokenType),
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Create indexes for common queries
TokenSchema.index({ userId: 1, type: 1 });
TokenSchema.index({ expiresAt: 1 });
TokenSchema.index({ isRevoked: 1 });

// Create a compound index for token lookup
TokenSchema.index({ token: 1, type: 1 });

/**
 * Static methods
 */

// Find valid (non-expired, non-revoked) tokens
TokenSchema.statics.findValid = function(
  query: Record<string, any> = {}
): Promise<TokenDocument[]> {
  return this.find({
    ...query,
    expiresAt: { $gt: new Date() },
    isRevoked: false
  });
};

// Find valid token by token string
TokenSchema.statics.findValidToken = function(
  token: string,
  type: TokenType
): Promise<TokenDocument | null> {
  return this.findOne({
    token,
    type,
    expiresAt: { $gt: new Date() },
    isRevoked: false
  });
};

// Revoke token
TokenSchema.statics.revokeToken = function(
  token: string,
  type: TokenType
): Promise<boolean> {
  return this.updateOne(
    { token, type },
    { isRevoked: true }
  ).then((result: { modifiedCount: number }) => result.modifiedCount > 0);
};

// Revoke all tokens for a user
TokenSchema.statics.revokeAllUserTokens = function(
  userId: mongoose.Types.ObjectId,
  type?: TokenType
): Promise<number> {
  const query: Record<string, any> = { userId };
  if (type) {
    query.type = type;
  }
  
  return this.updateMany(
    query,
    { isRevoked: true }
  ).then((result: { modifiedCount: number }) => result.modifiedCount);
};

// Clean up expired tokens
TokenSchema.statics.removeExpired = function(): Promise<number> {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  }).then((result: { deletedCount: number }) => result.deletedCount);
};

// Export the model
export default mongoose.model<TokenDocument>('Token', TokenSchema);
