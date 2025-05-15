/**
 * Transaction Service
 * Provides functionality for handling transactions across multiple databases
 * in the hybrid database architecture
 */

import { createServiceLogger } from '../../shared/utils/logger';
import { getConnection, QueryRunner } from 'typeorm';
import mongoose from 'mongoose';
import redisClient from '../../shared/utils/redis';

const logger = createServiceLogger('transaction-service');

export class TransactionService {
  /**
   * Execute a function within a PostgreSQL transaction
   * @param callback - Function to execute within transaction
   * @returns Result of callback function
   */
  async withPgTransaction<T>(callback: (queryRunner: QueryRunner) => Promise<T>): Promise<T> {
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      const result = await callback(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      logger.error('Error in PostgreSQL transaction', { error: (error as Error).message });
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute a function within a MongoDB transaction
   * @param callback - Function to execute within transaction
   * @returns Result of callback function
   */
  async withMongoTransaction<T>(callback: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      logger.error('Error in MongoDB transaction', { error: (error as Error).message });
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Execute a function within a hybrid transaction (PostgreSQL + MongoDB)
   * This uses a two-phase approach to ensure consistency across databases
   * @param pgCallback - Function to execute within PostgreSQL transaction
   * @param mongoCallback - Function to execute within MongoDB transaction
   * @returns Combined result object
   */
  async withHybridTransaction<T, U>(
    pgCallback: (queryRunner: QueryRunner) => Promise<T>,
    mongoCallback: (session: mongoose.ClientSession) => Promise<U>
  ): Promise<{ pg: T, mongo: U }> {
    // Start PostgreSQL transaction
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    // Start MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Phase 1: Execute both transactions
      const pgResult = await pgCallback(queryRunner);
      const mongoResult = await mongoCallback(session);
      
      // Phase 2: Commit both transactions
      await queryRunner.commitTransaction();
      await session.commitTransaction();
      
      return { pg: pgResult, mongo: mongoResult };
    } catch (error) {
      logger.error('Error in hybrid transaction', { error: (error as Error).message });
      
      // Rollback both transactions
      try {
        await queryRunner.rollbackTransaction();
      } catch (rollbackError) {
        logger.error('Error rolling back PostgreSQL transaction', { error: (rollbackError as Error).message });
      }
      
      try {
        await session.abortTransaction();
      } catch (rollbackError) {
        logger.error('Error rolling back MongoDB transaction', { error: (rollbackError as Error).message });
      }
      
      throw error;
    } finally {
      await queryRunner.release();
      session.endSession();
    }
  }

  /**
   * Execute a function with Redis lock to ensure exclusive access
   * @param lockKey - Key to use for lock
   * @param callback - Function to execute with lock
   * @param timeout - Lock timeout in seconds (default: 10)
   * @param retryDelay - Retry delay in milliseconds (default: 100)
   * @param maxRetries - Maximum number of retries (default: 10)
   * @returns Result of callback function
   */
  async withRedisLock<T>(
    lockKey: string,
    callback: () => Promise<T>,
    timeout: number = 10,
    retryDelay: number = 100,
    maxRetries: number = 10
  ): Promise<T> {
    const lockValue = Date.now().toString();
    let acquired = false;
    let retries = 0;
    
    // Try to acquire lock
    while (!acquired && retries < maxRetries) {
      acquired = await redisClient.setnx(`lock:${lockKey}`, lockValue, timeout);
      
      if (!acquired) {
        retries++;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${lockKey}`);
    }
    
    try {
      // Execute callback with lock
      return await callback();
    } finally {
      // Release lock
      const currentValue = await redisClient.get(`lock:${lockKey}`);
      
      if (currentValue === lockValue) {
        await redisClient.del(`lock:${lockKey}`);
      }
    }
  }

  /**
   * Execute a distributed transaction with compensation
   * This is useful for operations that span multiple databases and need to be atomic
   * @param operations - Array of operations to execute
   * @param compensations - Array of compensation functions to execute if an operation fails
   * @returns Result of all operations
   */
  async withCompensatingTransaction<T>(
    operations: Array<() => Promise<any>>,
    compensations: Array<(result: any) => Promise<void>>
  ): Promise<T[]> {
    const results: any[] = [];
    let executedOps = 0;
    
    try {
      // Execute all operations
      for (const operation of operations) {
        const result = await operation();
        results.push(result);
        executedOps++;
      }
      
      return results as T[];
    } catch (error) {
      logger.error('Error in compensating transaction', { error: (error as Error).message, executedOps });
      
      // Execute compensations for completed operations in reverse order
      for (let i = executedOps - 1; i >= 0; i--) {
        try {
          await compensations[i](results[i]);
        } catch (compError) {
          logger.error('Error executing compensation', { 
            error: (compError as Error).message,
            operation: i,
            result: results[i]
          });
        }
      }
      
      throw error;
    }
  }
}

// Create and export a singleton instance
const transactionService = new TransactionService();
export default transactionService;
