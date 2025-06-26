export enum PromoCodeErrorCode {
  DUPLICATE_CODE = 'DUPLICATE_CODE',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  FETCH_ERROR = 'FETCH_ERROR',
  CACHE_INVALIDATION_ERROR = 'CACHE_INVALIDATION_ERROR',
  INVALID_PLANS = 'INVALID_PLANS',
  INVALID_USERS = 'INVALID_USERS',
}

export class PromoCodeError extends Error {
  constructor(
    public message: string,
    public code: PromoCodeErrorCode,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'PromoCodeError';
    Object.setPrototypeOf(this, PromoCodeError.prototype);
  }
}
