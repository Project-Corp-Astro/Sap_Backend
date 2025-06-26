export enum SubscriptionPlanError {
  INVALID_DATA = 'INVALID_DATA',
  PLAN_NOT_FOUND = 'PLAN_NOT_FOUND',
  FEATURE_NOT_FOUND = 'FEATURE_NOT_FOUND',
  DUPLICATE_PLAN = 'DUPLICATE_PLAN',
  DUPLICATE_FEATURE = 'DUPLICATE_FEATURE',
  INVALID_STATUS = 'INVALID_STATUS',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED'
}

export interface SubscriptionPlanErrorDetails {
  field?: string;
  value?: any;
  constraint?: string;
  [key: string]: any;
}

export class SubscriptionPlanServiceError extends Error {
  constructor(
    public readonly code: SubscriptionPlanError,
    message: string,
    public readonly details?: SubscriptionPlanErrorDetails
  ) {
    super(message);
    this.name = 'SubscriptionPlanServiceError';
  }
}
