/**
 * Supabase utility for Subscription Management Service
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import logger from './logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Create a Supabase client instance
 */
const createSupabaseClient = (): SupabaseClient | null => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase URL or key is missing in environment variables');
      return null;
    }
    
    return createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: true,
        },
      }
    );
  } catch (error) {
    logger.error('Error creating Supabase client:', error);
    return null;
  }
};

/**
 * Create a Supabase admin client with service role key
 */
const createSupabaseAdminClient = (): SupabaseClient | null => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('Supabase URL or service role key is missing in environment variables');
      return null;
    }
    
    return createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  } catch (error) {
    logger.error('Error creating Supabase admin client:', error);
    return null;
  }
};

// Initialize Supabase clients
const supabaseClient = createSupabaseClient();
const supabaseAdminClient = createSupabaseAdminClient();

/**
 * Check Supabase connection
 */
const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    if (!supabaseClient) {
      return false;
    }

    // Try to make a simple query to test the connection
    const { data, error } = await supabaseClient.from('dummy_check').select('*').limit(1);
    
    if (error) {
      // The table might not exist, but we received a response from Supabase
      if (error.code === '42P01') {
        logger.info('Supabase connection successful (table not found, but connection works)');
        return true;
      }
      
      logger.error('Supabase connection error:', error);
      return false;
    }
    
    logger.info('Supabase connection successful');
    return true;
  } catch (error) {
    logger.error('Supabase connection check failed:', error);
    return false;
  }
};

// Helper functions for common Supabase operations
const supabaseUtils = {
  /**
   * Fetch data from a table
   */
  async select(table: string, query: any = {}) {
    try {
      if (!supabaseClient) throw new Error('Supabase client not initialized');
      
      let queryBuilder = supabaseClient.from(table).select();
      
      // Apply filters if provided
      if (query.filters) {
        for (const [column, value] of Object.entries(query.filters)) {
          queryBuilder = queryBuilder.eq(column, value);
        }
      }
      
      // Apply limit if provided
      if (query.limit) {
        queryBuilder = queryBuilder.limit(query.limit);
      }
      
      // Apply order if provided
      if (query.order) {
        const { column, ascending = true } = query.order;
        queryBuilder = queryBuilder.order(column, { ascending });
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error(`Error selecting from ${table}:`, error);
      return { data: null, error };
    }
  },
  
  /**
   * Insert data into a table
   */
  async insert(table: string, data: any) {
    try {
      if (!supabaseClient) throw new Error('Supabase client not initialized');
      
      const { data: result, error } = await supabaseClient
        .from(table)
        .insert(data)
        .select();
      
      if (error) throw error;
      return { data: result, error: null };
    } catch (error) {
      logger.error(`Error inserting into ${table}:`, error);
      return { data: null, error };
    }
  },
  
  /**
   * Update data in a table
   */
  async update(table: string, data: any, match: any) {
    try {
      if (!supabaseClient) throw new Error('Supabase client not initialized');
      
      let queryBuilder = supabaseClient.from(table).update(data);
      
      // Apply match conditions
      for (const [column, value] of Object.entries(match)) {
        queryBuilder = queryBuilder.eq(column, value);
      }
      
      const { data: result, error } = await queryBuilder.select();
      
      if (error) throw error;
      return { data: result, error: null };
    } catch (error) {
      logger.error(`Error updating in ${table}:`, error);
      return { data: null, error };
    }
  },
  
  /**
   * Delete data from a table
   */
  async delete(table: string, match: any) {
    try {
      if (!supabaseClient) throw new Error('Supabase client not initialized');
      
      let queryBuilder = supabaseClient.from(table).delete();
      
      // Apply match conditions
      for (const [column, value] of Object.entries(match)) {
        queryBuilder = queryBuilder.eq(column, value);
      }
      
      const { data: result, error } = await queryBuilder.select();
      
      if (error) throw error;
      return { data: result, error: null };
    } catch (error) {
      logger.error(`Error deleting from ${table}:`, error);
      return { data: null, error };
    }
  },
  
  /**
   * Get subscriptions for a user
   */
  async getSubscriptionsForUser(userId: string) {
    try {
      if (!supabaseClient) throw new Error('Supabase client not initialized');
      
      const { data, error } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error(`Error getting subscriptions for user ${userId}:`, error);
      return { data: null, error };
    }
  },
  
  /**
   * Get active subscription for a user
   */
  async getActiveSubscription(userId: string) {
    try {
      if (!supabaseClient) throw new Error('Supabase client not initialized');
      
      const { data, error } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error(`Error getting active subscription for user ${userId}:`, error);
      return { data: null, error };
    }
  },
  
  /**
   * Close any open connections
   */
  async close(): Promise<void> {
    try {
      // No specific close method with current Supabase JS client
      logger.info('Supabase connections closed');
      return Promise.resolve();
    } catch (error) {
      logger.error('Error closing Supabase connections:', error);
    }
  }
};

// Export only once to avoid duplicate declarations
export { 
  supabaseClient, 
  supabaseAdminClient, 
  checkSupabaseConnection,
  supabaseUtils 
};

export default supabaseUtils;
