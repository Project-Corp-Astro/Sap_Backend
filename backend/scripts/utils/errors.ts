// utils/errors.ts
export class AppError extends Error {
    constructor(
      public message: string,
      public statusCode: number = 500,
      public code?: string
    ) {
      super(message);
      this.name = this.constructor.name;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized') {
      super(message, 401, 'UNAUTHORIZED');
    }
  }
  
  export class ForbiddenError extends AppError {
    constructor(message: string = 'Forbidden') {
      super(message, 403, 'FORBIDDEN');
    }
  }