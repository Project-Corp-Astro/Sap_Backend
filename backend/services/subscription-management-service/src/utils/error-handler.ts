/**
 * Error handling utilities for the subscription service
 */

/**
 * Extract a safe error message from any error type
 * @param error Any error object
 * @returns A safe string representation of the error
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  
  return 'An unknown error occurred';
};

/**
 * Format error for response
 * @param error Any error object
 * @returns Object with message and error details
 */
export const formatErrorResponse = (error: unknown, defaultMessage: string = 'An error occurred') => {
  if (error instanceof Error && 'message' in error && 'error' in error) {
    // Handle custom error format with both message and error fields
    return {
      message: error.message as string,
      error: error.error as string
    };
  }
  
  return {
    message: defaultMessage,
    error: getErrorMessage(error)
  };
};
