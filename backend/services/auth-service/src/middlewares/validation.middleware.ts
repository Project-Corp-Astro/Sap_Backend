import { Request, Response, NextFunction } from 'express';

interface ValidationRule {
  field: string;
  validations: Array<{
    validator: (value: any) => boolean;
    message: string;
  }>;
}

/**
 * Custom validation middleware to replace express-validator
 * @param rules - Validation rules to apply
 * @returns Express middleware function
 */
export const validateRequest = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: { field: string; message: string }[] = [];

    // Apply each validation rule
    for (const rule of rules) {
      const value = req.body[rule.field];
      
      for (const validation of rule.validations) {
        if (!validation.validator(value)) {
          errors.push({
            field: rule.field,
            message: validation.message
          });
          break; // Stop on first error for this field
        }
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
      return;
    }

    // No errors, continue
    next();
  };
};

// Common validators
export const validators = {
  isEmail: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },
  
  isLength: (min: number, max?: number) => (value: string) => {
    if (!value) return false;
    if (min && value.length < min) return false;
    if (max && value.length > max) return false;
    return true;
  },
  
  notEmpty: (value: any) => {
    return value !== undefined && value !== null && value !== '';
  }
};
