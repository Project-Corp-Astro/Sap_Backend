/**
 * Validation Utility
 * Provides comprehensive request validation and sanitization
 */

import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from './logger';
import { AppError } from './errorHandler';

// Initialize logger
const logger = createServiceLogger('validation');

// Type definitions
type ValidationLocation = 'body' | 'query' | 'param';
type ValidationRule = (field: string, ...args: any[]) => ValidationChain;
type ValidationFunction = (validator: FieldValidator) => ValidationChain;
type ValidationRuleArgs = any[] | any;

interface ValidationRules {
  [ruleName: string]: ValidationRuleArgs;
}

interface ValidationSchema {
  [field: string]: ValidationFunction | ValidationRules | ValidationFunction[];
}

interface ValidationError {
  field: string;
  message: string;
  value: any;
}

/**
 * Common validation rules
 */
const rules = {
  // String validations
  string: {
    notEmpty: (): ValidationChain => body().notEmpty().withMessage('Value is required'),
    isLength: (min: number, max: number): ValidationChain => body().isLength({ min, max }).withMessage(`Must be between ${min} and ${max} characters`),
    isEmail: (): ValidationChain => body().isEmail().withMessage('Must be a valid email address'),
    isAlpha: (): ValidationChain => body().isAlpha().withMessage('Must contain only letters'),
    isAlphanumeric: (): ValidationChain => body().isAlphanumeric().withMessage('Must contain only letters and numbers'),
    matches: (pattern: RegExp, message?: string): ValidationChain => body().matches(pattern).withMessage(message || 'Invalid format')
  },
  
  // Number validations
  number: {
    isNumeric: (): ValidationChain => body().isNumeric().withMessage('Must be a number'),
    isInt: (): ValidationChain => body().isInt().withMessage('Must be an integer'),
    isFloat: (): ValidationChain => body().isFloat().withMessage('Must be a decimal number'),
    min: (min: number): ValidationChain => body().isFloat({ min }).withMessage(`Must be at least ${min}`),
    max: (max: number): ValidationChain => body().isFloat({ max }).withMessage(`Must be at most ${max}`)
  },
  
  // Date validations
  date: {
    isDate: (): ValidationChain => body().isISO8601().withMessage('Must be a valid date'),
    isAfter: (date: string): ValidationChain => body().isAfter(date).withMessage(`Must be after ${date}`),
    isBefore: (date: string): ValidationChain => body().isBefore(date).withMessage(`Must be before ${date}`)
  },
  
  // Boolean validations
  boolean: {
    isBoolean: (): ValidationChain => body().isBoolean().withMessage('Must be a boolean')
  },
  
  // Array validations
  array: {
    isArray: (): ValidationChain => body().isArray().withMessage('Must be an array'),
    notEmpty: (): ValidationChain => body().isArray({ min: 1 }).withMessage('Array cannot be empty'),
    maxLength: (max: number): ValidationChain => body().isArray({ max }).withMessage(`Array cannot have more than ${max} items`)
  },
  
  // Object validations
  object: {
    isObject: (): ValidationChain => body().isObject().withMessage('Must be an object'),
    hasKeys: (keys: string[]): ValidationChain => body().custom(value => {
      if (typeof value !== 'object' || value === null) return false;
      return keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
    }).withMessage(`Must contain keys: ${keys.join(', ')}`)
  },
  
  // Custom validations
  custom: {
    isMongoId: (): ValidationChain => body().isMongoId().withMessage('Must be a valid ID'),
    isSlug: (): ValidationChain => body().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage('Must be a valid slug'),
    isStrongPassword: (): ValidationChain => body().isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    }).withMessage('Password must contain at least 8 characters, including uppercase, lowercase, number, and special character')
  }
};

/**
 * Sanitization rules
 */
const sanitizers = {
  trim: (): ValidationChain => body().trim(),
  toLowerCase: (): ValidationChain => body().toLowerCase(),
  toUpperCase: (): ValidationChain => body().toUpperCase(),
  toInt: (): ValidationChain => body().toInt(),
  toFloat: (): ValidationChain => body().toFloat(),
  toBoolean: (): ValidationChain => body().toBoolean(),
  toDate: (): ValidationChain => body().toDate(),
  escape: (): ValidationChain => body().escape(),
  normalizeEmail: (): ValidationChain => body().normalizeEmail()
};

/**
 * Field validator class
 */
class FieldValidator {
  private chain: ValidationChain;
  private field: string;

  constructor(field: string, location: ValidationLocation = 'body') {
    this.field = field;
    
    switch (location) {
      case 'body':
        this.chain = body(field);
        break;
      case 'query':
        this.chain = query(field);
        break;
      case 'param':
        this.chain = param(field);
        break;
      default:
        this.chain = body(field);
    }
  }

  // String validations
  notEmpty(): FieldValidator {
    this.chain = this.chain.notEmpty().withMessage(`${this.field} is required`);
    return this;
  }
  
  isLength(min: number, max: number): FieldValidator {
    this.chain = this.chain.isLength({ min, max }).withMessage(`${this.field} must be between ${min} and ${max} characters`);
    return this;
  }
  
  isEmail(): FieldValidator {
    this.chain = this.chain.isEmail().withMessage(`${this.field} must be a valid email address`);
    return this;
  }
  
  isAlpha(): FieldValidator {
    this.chain = this.chain.isAlpha().withMessage(`${this.field} must contain only letters`);
    return this;
  }
  
  isAlphanumeric(): FieldValidator {
    this.chain = this.chain.isAlphanumeric().withMessage(`${this.field} must contain only letters and numbers`);
    return this;
  }
  
  matches(pattern: RegExp, message?: string): FieldValidator {
    this.chain = this.chain.matches(pattern).withMessage(message || `${this.field} has an invalid format`);
    return this;
  }
  
  // Number validations
  isNumeric(): FieldValidator {
    this.chain = this.chain.isNumeric().withMessage(`${this.field} must be a number`);
    return this;
  }
  
  isInt(): FieldValidator {
    this.chain = this.chain.isInt().withMessage(`${this.field} must be an integer`);
    return this;
  }
  
  isFloat(): FieldValidator {
    this.chain = this.chain.isFloat().withMessage(`${this.field} must be a decimal number`);
    return this;
  }
  
  min(min: number): FieldValidator {
    this.chain = this.chain.isFloat({ min }).withMessage(`${this.field} must be at least ${min}`);
    return this;
  }
  
  max(max: number): FieldValidator {
    this.chain = this.chain.isFloat({ max }).withMessage(`${this.field} must be at most ${max}`);
    return this;
  }
  
  // Date validations
  isDate(): FieldValidator {
    this.chain = this.chain.isISO8601().withMessage(`${this.field} must be a valid date`);
    return this;
  }
  
  isAfter(date: string): FieldValidator {
    this.chain = this.chain.isAfter(date).withMessage(`${this.field} must be after ${date}`);
    return this;
  }
  
  isBefore(date: string): FieldValidator {
    this.chain = this.chain.isBefore(date).withMessage(`${this.field} must be before ${date}`);
    return this;
  }
  
  // Boolean validations
  isBoolean(): FieldValidator {
    this.chain = this.chain.isBoolean().withMessage(`${this.field} must be a boolean`);
    return this;
  }
  
  // Array validations
  isArray(): FieldValidator {
    this.chain = this.chain.isArray().withMessage(`${this.field} must be an array`);
    return this;
  }
  
  arrayNotEmpty(): FieldValidator {
    this.chain = this.chain.isArray({ min: 1 }).withMessage(`${this.field} array cannot be empty`);
    return this;
  }
  
  arrayMaxLength(max: number): FieldValidator {
    this.chain = this.chain.isArray({ max }).withMessage(`${this.field} array cannot have more than ${max} items`);
    return this;
  }
  
  // Object validations
  isObject(): FieldValidator {
    this.chain = this.chain.isObject().withMessage(`${this.field} must be an object`);
    return this;
  }
  
  hasKeys(keys: string[]): FieldValidator {
    this.chain = this.chain.custom(value => {
      if (typeof value !== 'object' || value === null) return false;
      return keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
    }).withMessage(`${this.field} must contain keys: ${keys.join(', ')}`);
    return this;
  }
  
  // Custom validations
  isMongoId(): FieldValidator {
    this.chain = this.chain.isMongoId().withMessage(`${this.field} must be a valid ID`);
    return this;
  }
  
  isSlug(): FieldValidator {
    this.chain = this.chain.matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage(`${this.field} must be a valid slug`);
    return this;
  }
  
  isStrongPassword(): FieldValidator {
    this.chain = this.chain.isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    }).withMessage(`${this.field} must contain at least 8 characters, including uppercase, lowercase, number, and special character`);
    return this;
  }
  
  // Custom validation
  custom(validationFn: (value: any) => boolean | Promise<boolean>, message?: string): FieldValidator {
    this.chain = this.chain.custom(validationFn).withMessage(message || `${this.field} is invalid`);
    return this;
  }
  
  // Optional field
  optional(options: { nullable?: boolean, checkFalsy?: boolean } = {}): FieldValidator {
    this.chain = this.chain.optional(options);
    return this;
  }
  
  // Sanitization
  trim(): FieldValidator {
    this.chain = this.chain.trim();
    return this;
  }
  
  toLowerCase(): FieldValidator {
    this.chain = this.chain.toLowerCase();
    return this;
  }
  
  toUpperCase(): FieldValidator {
    this.chain = this.chain.toUpperCase();
    return this;
  }
  
  toInt(): FieldValidator {
    this.chain = this.chain.toInt();
    return this;
  }
  
  toFloat(): FieldValidator {
    this.chain = this.chain.toFloat();
    return this;
  }
  
  toBoolean(): FieldValidator {
    this.chain = this.chain.toBoolean();
    return this;
  }
  
  toDate(): FieldValidator {
    this.chain = this.chain.toDate();
    return this;
  }
  
  escape(): FieldValidator {
    this.chain = this.chain.escape();
    return this;
  }
  
  normalizeEmail(): FieldValidator {
    this.chain = this.chain.normalizeEmail();
    return this;
  }
  
  // Get validation chain
  getChain(): ValidationChain {
    return this.chain;
  }
}

/**
 * Create validation chain for a field
 * @param field - Field to validate
 * @param location - Request location (body, query, param)
 * @returns Field validator
 */
const validateField = (field: string, location: ValidationLocation = 'body'): FieldValidator => {
  return new FieldValidator(field, location);
};

/**
 * Create validation schema
 * @param schema - Validation schema
 * @returns Validation chains
 */
const createValidationSchema = (schema: ValidationSchema): ValidationChain[] => {
  const validationChains: ValidationChain[] = [];
  
  Object.entries(schema).forEach(([field, rules]) => {
    if (typeof rules === 'function') {
      // If rules is a function, call it with validateField
      validationChains.push(rules(validateField(field)));
    } else if (Array.isArray(rules)) {
      // If rules is an array, apply each rule
      const fieldValidator = validateField(field);
      rules.forEach(rule => {
        if (typeof rule === 'function') {
          rule(fieldValidator);
        }
      });
      validationChains.push(fieldValidator.getChain());
    } else if (typeof rules === 'object') {
      // If rules is an object, apply each rule
      const fieldValidator = validateField(field);
      Object.entries(rules).forEach(([ruleName, ruleArgs]) => {
        if (typeof (fieldValidator as any)[ruleName] === 'function') {
          if (Array.isArray(ruleArgs)) {
            (fieldValidator as any)[ruleName](...ruleArgs);
          } else if (ruleArgs !== undefined) {
            (fieldValidator as any)[ruleName](ruleArgs);
          } else {
            (fieldValidator as any)[ruleName]();
          }
        }
      });
      validationChains.push(fieldValidator.getChain());
    }
  });
  
  return validationChains;
};

/**
 * Validate request middleware
 * @returns Express middleware
 */
const validate = (req: Request, res: Response, next: NextFunction): Response | void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors: ValidationError[] = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));
    
    logger.debug('Validation errors', { errors: formattedErrors });
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors
    });
  }
  
  next();
};

/**
 * Create validation middleware
 * @param schema - Validation schema or array of validation chains
 * @returns Express middleware
 */
const validateRequest = (schema: ValidationSchema | ValidationChain[]): Array<ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | void)> => {
  if (Array.isArray(schema)) {
    return [...schema, validate];
  }
  
  return [...createValidationSchema(schema), validate];
};

export {
  rules,
  sanitizers,
  validateField,
  createValidationSchema,
  validate,
  validateRequest,
  ValidationLocation,
  ValidationRule,
  ValidationFunction,
  ValidationRuleArgs,
  ValidationRules,
  ValidationSchema,
  ValidationError,
  FieldValidator
};
