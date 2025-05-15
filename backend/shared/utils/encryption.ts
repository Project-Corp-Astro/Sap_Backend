/**
 * Encryption Utility
 * Provides field-level encryption for sensitive data
 */

import crypto from 'crypto';
import { Schema, Document, HydratedDocument, Query } from 'mongoose';
import { createServiceLogger } from './logger';
import config from '../config';
import { AppError, ErrorTypes } from './errorHandler';

// Initialize logger
const logger = createServiceLogger('encryption');

// Define interfaces
interface EncryptionConfig {
  algorithm: string;
  secretKey: string;
  ivLength: number;
  authTagLength: number;
}

interface EncryptionOptions {
  algorithm?: string;
  secretKey?: string;
}

interface EncryptedData {
  iv: string;
  data: string;
  tag: string;
}

interface PluginOptions {
  fields?: string[];
  defaultOptions?: EncryptionOptions;
}

interface HashOptions {
  algorithm?: string;
  encoding?: crypto.BinaryToTextEncoding;
}

// Default encryption configuration
const defaultConfig: EncryptionConfig = {
  algorithm: config.get('encryption.algorithm', 'aes-256-gcm'),
  secretKey: config.get('encryption.secretKey', 'your-secret-key-change-in-production'),
  ivLength: 16, // 16 bytes for AES
  authTagLength: 16 // 16 bytes for GCM mode
};

/**
 * Generate encryption key from secret
 * @param secret - Secret key
 * @returns Encryption key
 */
const generateKey = (secret: string): Buffer => {
  return crypto.scryptSync(secret, 'salt', 32); // 32 bytes (256 bits) key
};

/**
 * Encrypt data
 * @param data - Data to encrypt
 * @param options - Encryption options
 * @returns Encrypted data
 */
export const encrypt = (data: any, options: EncryptionOptions = {}): string => {
  try {
    const { algorithm, secretKey } = { ...defaultConfig, ...options };
    
    // Convert data to string if object
    const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
    
    // Generate initialization vector
    const iv = crypto.randomBytes(defaultConfig.ivLength);
    
    // Generate encryption key
    const key = generateKey(secretKey);
    
    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    // Encrypt data
    let encrypted = cipher.update(dataString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag (for GCM mode)
    // Use type assertion for GCM cipher which has getAuthTag method
    const authTag = (cipher as crypto.CipherGCM).getAuthTag();
    
    // Combine IV, encrypted data, and auth tag
    const result: EncryptedData = {
      iv: iv.toString('hex'),
      data: encrypted,
      tag: authTag.toString('hex')
    };
    
    // Return as base64 string
    return Buffer.from(JSON.stringify(result)).toString('base64');
  } catch (err) {
    logger.error('Encryption error', { error: (err as Error).message });
    throw new AppError(ErrorTypes.INTERNAL_ERROR, 'Failed to encrypt data');
  }
};

/**
 * Decrypt data
 * @param encryptedData - Encrypted data
 * @param options - Decryption options
 * @returns Decrypted data
 */
export const decrypt = (encryptedData: string, options: EncryptionOptions = {}): any => {
  try {
    const { algorithm, secretKey } = { ...defaultConfig, ...options };
    
    // Parse encrypted data
    const encryptedObj: EncryptedData = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
    const { iv, data, tag } = encryptedObj;
    
    // Generate decryption key
    const key = generateKey(secretKey);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(iv, 'hex')
    );
    
    // Set authentication tag (for GCM mode)
    // Use type assertion for GCM decipher which has setAuthTag method
    (decipher as crypto.DecipherGCM).setAuthTag(Buffer.from(tag, 'hex'));
    
    // Decrypt data
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Try to parse as JSON, return as string if not valid JSON
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return decrypted;
    }
  } catch (err) {
    logger.error('Decryption error', { error: (err as Error).message });
    throw new AppError(ErrorTypes.INTERNAL_ERROR, 'Failed to decrypt data');
  }
};

/**
 * Create Mongoose encryption plugin
 * @param options - Plugin options
 * @returns Mongoose plugin
 */
export const createMongooseEncryptionPlugin = (options: PluginOptions = {}): ((schema: Schema) => void) => {
  const {
    fields = [],
    defaultOptions = {}
  } = options;
  
  return function(schema: Schema): void {
    // Add encrypted flag to schema
    schema.add({
      _encrypted: {
        type: Object,
        select: false
      }
    });
    
    // Pre-save hook to encrypt fields
    schema.pre('save', function(this: Document & { _encrypted?: Record<string, string> }, next) {
      try {
        // Skip if no fields to encrypt
        if (fields.length === 0) {
          return next();
        }
        
        // Initialize _encrypted object if not exists
        if (!this._encrypted) {
          this._encrypted = {};
        }
        
        // Encrypt fields
        fields.forEach(field => {
          if (this.isModified(field) && (this as any)[field] !== undefined) {
            this._encrypted![field] = encrypt((this as any)[field], defaultOptions);
            (this as any)[field] = undefined;
          }
        });
        
        next();
      } catch (err) {
        next(err as Error);
      }
    });
    
    // Post-find hook to decrypt fields
    // Use separate hooks for different query types
    schema.post('find', function(docs: any, next: (err?: Error) => void) {
      decryptDocuments(docs, next);
    });
    
    schema.post('findOne', function(doc: any, next: (err?: Error) => void) {
      if (doc) decryptDocument(doc);
      next();
    });
    
    // Using regex pattern to match findById and similar methods
    schema.post(/^findById/, function(doc: any, next: (err?: Error) => void) {
      if (doc) decryptDocument(doc);
      next();
    });
    
    // Helper function to handle multiple documents
    function decryptDocuments(docs: any, next: (err?: Error) => void) {
      try {
        // Skip if no documents or no fields to decrypt
        if (!docs || fields.length === 0) {
          return next();
        }
        
        // Handle array of documents
        if (Array.isArray(docs)) {
          docs.forEach((doc: any) => {
            if (doc) decryptDocument(doc);
          });
        }
        
        next();
      } catch (err) {
        next(err as Error);
      }
    }
    
    // Helper function to decrypt document fields
    function decryptDocument(doc: any): void {
      if (!doc || !doc._encrypted) {
        return;
      }
      
      fields.forEach(field => {
        if (doc._encrypted[field]) {
          try {
            doc[field] = decrypt(doc._encrypted[field], defaultOptions);
          } catch (err) {
            logger.error(`Error decrypting field ${field}`, { error: (err as Error).message });
          }
        }
      });
    }
    
    // Add instance method to encrypt field
    schema.methods.encryptField = function(field: string, value: any): Document & Record<string, any> {
      if (!fields.includes(field)) {
        throw new Error(`Field ${field} is not configured for encryption`);
      }
      
      if (!this._encrypted) {
        this._encrypted = {};
      }
      
      this._encrypted[field] = encrypt(value, defaultOptions);
      this[field] = undefined;
      
      return this as Document & Record<string, any>;
    };
    
    // Add instance method to decrypt field
    schema.methods.decryptField = function(field: string): any {
      if (!fields.includes(field) || !this._encrypted || !this._encrypted[field]) {
        return null;
      }
      
      return decrypt(this._encrypted[field], defaultOptions);
    };
  };
};

/**
 * Hash data (one-way encryption)
 * @param data - Data to hash
 * @param options - Hash options
 * @returns Hashed data
 */
export const hash = (data: any, options: HashOptions = {}): string => {
  try {
    const {
      algorithm = 'sha256',
      encoding = 'hex'
    } = options;
    
    const hashObj = crypto.createHash(algorithm);
    hashObj.update(String(data));
    return hashObj.digest(encoding);
  } catch (err) {
    logger.error('Hash error', { error: (err as Error).message });
    throw new AppError(ErrorTypes.INTERNAL_ERROR, 'Failed to hash data');
  }
};

/**
 * Generate random string
 * @param length - String length
 * @param encoding - Output encoding
 * @returns Random string
 */
export const generateRandomString = (length = 32, encoding: BufferEncoding = 'hex'): string => {
  try {
    return crypto.randomBytes(length / 2).toString(encoding);
  } catch (err) {
    logger.error('Random string generation error', { error: (err as Error).message });
    throw new AppError(ErrorTypes.INTERNAL_ERROR, 'Failed to generate random string');
  }
};

// Export the plugin as a named export for compatibility with require syntax
export const encryptionPlugin = createMongooseEncryptionPlugin();
