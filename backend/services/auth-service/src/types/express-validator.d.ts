declare module 'express-validator' {
  import { Request, Response, NextFunction } from 'express';

  export interface ValidationChain {
    isEmail(): ValidationChain;
    isLength(options: { min?: number; max?: number }): ValidationChain;
    notEmpty(): ValidationChain;
    withMessage(message: string): ValidationChain;
  }

  export function body(field: string): ValidationChain;
  export function check(field: string): ValidationChain;
  export function param(field: string): ValidationChain;
  export function query(field: string): ValidationChain;
  export function validationResult(req: Request): { isEmpty(): boolean; array(): any[] };
}
