/**
 * Encryption Utility
 * Provides field-level encryption for sensitive data
 */

import crypto from 'crypto';
import { Schema, Document, HydratedDocument, Query, Types } from 'mongoose';
import { createServiceLogger } from './logger';
import config from '../config';
import { AppError, ErrorTypes } from './errorHandler';

// Initialize logger
const logger = createServiceLogger('encryption');

// Define interfaces
interface EncryptionOptions {
  key: string;
  iv: string;
  algorithm: string;
}

interface EncryptedData {
  iv: string;
  data: string;
  tag: string;
}

interface PluginOptions {
  fields: string[];
  defaultOptions?: EncryptionOptions;
}

// Define encrypted document type
interface EncryptedDocument extends Document {
  _encrypted?: Record<string, string>;
}

interface HashOptions {
  algorithm?: string;
  encoding?: crypto.BinaryToTextEncoding;
}

// Default encryption configuration
const defaultConfig: EncryptionOptions = {
  key: process.env.ENCRYPTION_KEY || 'your-secret-key',
  iv: process.env.ENCRYPTION_IV || 'your-initialization-vector',
  algorithm: 'aes-256-gcm'
};

/**
 * Get encryption options with defaults
 */
const getEncryptionOptions = (options?: Partial<EncryptionOptions>): EncryptionOptions => {
  if (!options) {
    return defaultConfig;
  }
  return {
    key: options.key || defaultConfig.key,
    iv: options.iv || defaultConfig.iv,
    algorithm: options.algorithm || defaultConfig.algorithm
  };
};

/**
 * Encrypt data
 * @param data - Data to encrypt
 * @param options - Encryption options
 * @returns Encrypted data
 */
export const encrypt = (data: any, options: Partial<EncryptionOptions> = {}): string => {
  try {
    // Get encryption options with defaults
    const { key, iv, algorithm } = getEncryptionOptions(options);
    
    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), Buffer.from(iv));

    // Encrypt data
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return encrypted data with IV
    return `${iv}:${encrypted}`;
  } catch (error) {
    throw new AppError(ErrorTypes.INTERNAL_ERROR, 'Failed to encrypt data');
  }
};

/**
 * Decrypt data
 * @param encryptedData - Encrypted data
 * @param options - Decryption options
 * @returns Decrypted data
 */
export const decrypt = (encryptedData: string, options: Partial<EncryptionOptions> = {}): any => {
  try {
    // Get encryption options with defaults
    const { key, algorithm } = getEncryptionOptions(options);
    const [iv, encryptedDataHex] = encryptedData.split(':');
    if (!iv || !encryptedDataHex) {
      throw new AppError(ErrorTypes.INTERNAL_ERROR, 'Invalid encrypted data format');
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), Buffer.from(iv));

    // Decrypt data
    let decryptedData = decipher.update(encryptedDataHex, 'hex', 'utf8');
    decryptedData += decipher.final('utf8');

    // Parse decrypted data
    return JSON.parse(decryptedData);
  } catch (error) {
    throw new AppError(ErrorTypes.INTERNAL_ERROR, 'Failed to decrypt data');
  }
};

/**
 * Create Mongoose encryption plugin
 * @param options - Plugin options
 * @returns Mongoose plugin
 */
export const createMongooseEncryptionPlugin = (options: PluginOptions): (schema: Schema) => void => {
  const { fields, defaultOptions = {} } = options;
  const config = getEncryptionOptions(defaultOptions);

  return function encryptionPlugin(schema: Schema): void {
    // Add encrypted document type to schema
    schema.add({
      _encrypted: {
        type: Map,
        of: String
      }
    });
    // Define encrypted document type within plugin scope
    interface EncryptedDocument extends Document {
      _encrypted?: Record<string, string>;
    }

    // Add encryption methods to schema
    schema.statics.encrypt = (data: any, options: Partial<EncryptionOptions> = {}): string => {
      return encrypt(data, options);
    };

    schema.statics.decrypt = (encryptedData: string, options: Partial<EncryptionOptions> = {}): any => {
      return decrypt(encryptedData, options);
    };

    // Add encryption methods to document
    schema.methods.encryptField = function(this: EncryptedDocument, field: string, value: any): EncryptedDocument & Record<string, any> {
      if (!fields.includes(field)) {
        throw new Error(`Field ${field} is not configured for encryption`);
      }
      
      if (!this._encrypted) {
        this._encrypted = {};
      }
      
      this._encrypted[field] = encrypt(value, getEncryptionOptions(defaultOptions));
      this[field] = undefined;
      
      return this;
    };
    
    schema.methods.decryptField = function(this: EncryptedDocument, field: string): any {
      if (!fields.includes(field) || !this._encrypted || !this._encrypted[field]) {
        return null;
      }
      
      return decrypt(this._encrypted[field], getEncryptionOptions(defaultOptions));
    };

    // Add encryption middleware
    schema.pre('save', async function(this: EncryptedDocument, next) {
      try {
        const doc = this;
        const modifiedPaths = doc.modifiedPaths();

        for (const path of modifiedPaths) {
          if (fields.includes(path)) {
            const value = doc.get(path);
            if (value !== undefined) {
              const encrypted = await encrypt(value, getEncryptionOptions(defaultOptions));
              doc.set(path, undefined);
              if (!doc._encrypted) {
                doc._encrypted = {};
              }
              doc._encrypted[path] = encrypted;
            }
          }
        }

        next();
      } catch (error) {
        next(error as Error);
      }
    });

    schema.pre('findOneAndUpdate', async function(this: Query<any, any>, next) {
      try {
        const update = this.getUpdate();
        const options = this.getOptions();

        if (typeof update === 'object' && update !== null && '$set' in update) {
          const setOperations = update.$set as Record<string, any>;
          for (const [key, value] of Object.entries(setOperations)) {
            if (fields.includes(key)) {
              const encrypted = await encrypt(value, getEncryptionOptions(defaultOptions));
              setOperations[key] = encrypted;
            }
          }
        }

        next();
      } catch (error) {
        next(error as Error);
      }
    });

    // Add decryption middleware
    schema.post('find', async function(this: Query<any, any>, docs: HydratedDocument<any>[]) {
      try {
        for (const doc of docs) {
          if (doc._encrypted) {
            for (const field of fields) {
              if (doc._encrypted[field]) {
                const decrypted = await decrypt(doc._encrypted[field], getEncryptionOptions(defaultOptions));
                doc.set(field, decrypted);
              }
            }
          }
        }
      } catch (error) {
        throw new AppError(ErrorTypes.INTERNAL_ERROR, 'Failed to decrypt data');
      }
    });

    schema.post('findOne', async function(this: Query<any, any>, doc: HydratedDocument<any> | null) {
      try {
        if (doc && doc._encrypted) {
          for (const field of fields) {
            if (doc._encrypted[field]) {
              const decrypted = await decrypt(doc._encrypted[field], getEncryptionOptions(defaultOptions));
              doc.set(field, decrypted);
            }
          }
        }
      } catch (error) {
        throw new AppError(ErrorTypes.INTERNAL_ERROR, 'Failed to decrypt data');
      }
    });
  };
};

// Export the plugin as a named export for compatibility with require syntax
export const encryptionPlugin = createMongooseEncryptionPlugin({
  fields: [],
  defaultOptions: defaultConfig
});

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
