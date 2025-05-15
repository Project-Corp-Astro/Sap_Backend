/**
 * UserSession Repository
 * Handles data access for UserSession entities in PostgreSQL
 */

import { LessThan } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { UserSession } from '../entities/UserSession.entity';
import { createServiceLogger } from '../../shared/utils/logger';
import redisClient from '../../shared/utils/redis';

const logger = createServiceLogger('user-session-repository');

export class UserSessionRepository extends BaseRepository<UserSession> {
  constructor() {
    super(UserSession);
  }

  /**
   * Find session by token
   * @param token - Session token
   * @returns Session or null if not found
   */
  async findByToken(token: string): Promise<UserSession | null> {
    try {
      // Try to get from cache first
      const cacheKey = `session:token:${token}`;
      const cachedSession = await redisClient.get(cacheKey);
      
      if (cachedSession) {
        logger.debug(`Session with token ${token} found in cache`);
        return cachedSession as UserSession;
      }
      
      // If not in cache, get from database
      const session = await this.repository.findOne({
        where: { token, isRevoked: false },
        relations: ['user', 'user.role', 'user.role.permissions']
      });
      
      // Store in cache if found
      if (session) {
        // Only cache for 15 minutes for security
        await redisClient.set(cacheKey, session, 900);
      }
      
      return session;
    } catch (error) {
      logger.error(`Error finding session by token`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Find active sessions for user
   * @param userId - User ID
   * @returns Array of sessions
   */
  async findActiveSessionsForUser(userId: string): Promise<UserSession[]> {
    try {
      return await this.repository.find({
        where: {
          userId,
          isRevoked: false,
          expiresAt: LessThan(new Date())
        },
        order: {
          lastUsedAt: 'DESC'
        }
      });
    } catch (error) {
      logger.error(`Error finding active sessions for user: ${userId}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Revoke session
   * @param token - Session token
   * @returns True if session was revoked
   */
  async revokeSession(token: string): Promise<boolean> {
    try {
      const session = await this.repository.findOneBy({ token });
      
      if (!session) {
        return false;
      }
      
      session.isRevoked = true;
      await this.repository.save(session);
      
      // Invalidate cache
      await redisClient.del(`session:token:${token}`);
      
      return true;
    } catch (error) {
      logger.error(`Error revoking session with token: ${token}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Revoke all sessions for user
   * @param userId - User ID
   * @returns Number of sessions revoked
   */
  async revokeAllSessionsForUser(userId: string): Promise<number> {
    try {
      const sessions = await this.repository.find({
        where: {
          userId,
          isRevoked: false
        }
      });
      
      if (sessions.length === 0) {
        return 0;
      }
      
      for (const session of sessions) {
        session.isRevoked = true;
        
        // Invalidate cache for each session
        await redisClient.del(`session:token:${session.token}`);
      }
      
      await this.repository.save(sessions);
      
      return sessions.length;
    } catch (error) {
      logger.error(`Error revoking all sessions for user: ${userId}`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Clean expired sessions
   * @returns Number of sessions cleaned
   */
  async cleanExpiredSessions(): Promise<number> {
    try {
      const now = new Date();
      
      const sessions = await this.repository.find({
        where: {
          expiresAt: LessThan(now)
        }
      });
      
      if (sessions.length === 0) {
        return 0;
      }
      
      await this.repository.remove(sessions);
      
      // Invalidate cache for each session
      for (const session of sessions) {
        await redisClient.del(`session:token:${session.token}`);
      }
      
      logger.info(`Cleaned ${sessions.length} expired sessions`);
      
      return sessions.length;
    } catch (error) {
      logger.error('Error cleaning expired sessions', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Update session last used time
   * @param token - Session token
   * @returns Updated session
   */
  async updateLastUsedTime(token: string): Promise<UserSession | null> {
    try {
      const session = await this.repository.findOneBy({ token });
      
      if (!session) {
        return null;
      }
      
      session.lastUsedAt = new Date();
      await this.repository.save(session);
      
      // Update cache
      const cacheKey = `session:token:${token}`;
      await redisClient.set(cacheKey, session, 900);
      
      return session;
    } catch (error) {
      logger.error(`Error updating last used time for session: ${token}`, { error: (error as Error).message });
      throw error;
    }
  }
}
