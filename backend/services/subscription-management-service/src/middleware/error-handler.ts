import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/api-error';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ApiError) {
    logger.warn(`API Error: ${err.statusCode} - ${err.message}`);
    return res.status(err.statusCode).json({ message: err.message });
  }

  logger.error('Internal Server Error:', { error: err.message, stack: err.stack });
  res.status(500).json({ message: 'Something went wrong' });
};
