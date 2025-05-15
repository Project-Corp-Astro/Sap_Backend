/**
 * Message Queue Utility
 * Provides a centralized message queue client for asynchronous processing
 * using RabbitMQ
 */

import amqp, { Connection, Channel, ConsumeMessage, Options } from 'amqplib';
import { createServiceLogger } from './logger';
import config from '../config';
import { AppError, ErrorTypes } from './errorHandler';

// Initialize logger
const logger = createServiceLogger('message-queue');

// Define interfaces
interface MessageQueueConfig {
  url: string;
  exchangeName: string;
  exchangeType: string;
  reconnectTimeout: number;
  maxReconnectAttempts: number;
}

interface PublishOptions {
  persistent?: boolean;
  expiration?: string | number;
  headers?: Record<string, any>;
  [key: string]: any;
}

interface ConsumerDetails {
  consumerTag: string;
  queueName: string;
  pattern: string;
}

interface ConnectionDetails {
  connection: Connection;
  channel: Channel;
}

type MessageHandler = (message: any, originalMessage: ConsumeMessage) => Promise<void> | void;

// Default RabbitMQ configuration
const defaultConfig: MessageQueueConfig = {
  url: config.get('rabbitmq.url', 'amqp://localhost:5672'),
  exchangeName: config.get('rabbitmq.exchange', 'sap_events'),
  exchangeType: config.get('rabbitmq.exchangeType', 'topic'),
  reconnectTimeout: config.get('rabbitmq.reconnectTimeout', 5000),
  maxReconnectAttempts: config.get('rabbitmq.maxReconnectAttempts', 10)
};

/**
 * Message Queue client singleton
 */
class MessageQueue {
  private connection: Connection | null;
  private channel: Channel | null;
  private reconnectAttempts: number;
  private consumers: Map<string, ConsumerDetails>;
  private isInitializing: boolean;
  private config: MessageQueueConfig;

  constructor() {
    this.connection = null;
    this.channel = null;
    this.reconnectAttempts = 0;
    this.consumers = new Map();
    this.isInitializing = false;
    this.config = { ...defaultConfig };
  }

  /**
   * Initialize connection to RabbitMQ
   * @param options - Connection options
   * @returns Connection and channel
   */
  async initialize(options: Partial<MessageQueueConfig> = {}): Promise<ConnectionDetails> {
    // Prevent multiple simultaneous initialization attempts
    if (this.isInitializing) {
      logger.debug('Message queue initialization already in progress');
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isInitializing && this.connection && this.channel) {
            clearInterval(checkInterval);
            resolve({ connection: this.connection, channel: this.channel });
          }
        }, 100);
      });
    }

    this.isInitializing = true;
    this.config = { ...this.config, ...options };

    try {
      // Close existing connection if any
      if (this.connection) {
        await this.close();
      }

      // Connect to RabbitMQ
      this.connection = await amqp.connect(this.config.url);
      logger.info('Connected to RabbitMQ');

      // Create channel
      this.channel = await this.connection.createChannel();
      logger.info('Created RabbitMQ channel');

      // Assert exchange
      await this.channel.assertExchange(
        this.config.exchangeName,
        this.config.exchangeType,
        { durable: true }
      );
      logger.info(`Asserted exchange: ${this.config.exchangeName}`);

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      // Handle connection close
      this.connection.on('close', async (err?: Error) => {
        logger.warn('RabbitMQ connection closed', err ? { error: err.message } : {});
        this.channel = null;
        this.connection = null;

        // Attempt to reconnect
        await this.handleReconnect();
      });

      // Handle connection error
      this.connection.on('error', async (err: Error) => {
        logger.error('RabbitMQ connection error', { error: err.message });
        
        if (this.connection) {
          try {
            await this.connection.close();
          } catch (closeErr) {
            logger.error('Error closing RabbitMQ connection', { error: (closeErr as Error).message });
          }
        }
        
        this.channel = null;
        this.connection = null;

        // Attempt to reconnect
        await this.handleReconnect();
      });

      this.isInitializing = false;
      return { connection: this.connection, channel: this.channel };
    } catch (err) {
      logger.error('Failed to initialize RabbitMQ connection', { error: (err as Error).message });
      this.isInitializing = false;
      
      // Attempt to reconnect
      await this.handleReconnect();
      
      throw new AppError(ErrorTypes.INTERNAL_ERROR, 'Failed to connect to message queue');
    }
  }

  /**
   * Handle reconnection to RabbitMQ
   */
  async handleReconnect(): Promise<void> {
    // Increment reconnect attempts
    this.reconnectAttempts++;

    // Check if max reconnect attempts reached
    if (this.reconnectAttempts > this.config.maxReconnectAttempts) {
      logger.error(`Max reconnect attempts (${this.config.maxReconnectAttempts}) reached`);
      return;
    }

    logger.info(`Attempting to reconnect to RabbitMQ (attempt ${this.reconnectAttempts})`);

    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, this.config.reconnectTimeout));

    try {
      // Attempt to reconnect
      await this.initialize();

      // Restore consumers
      if (this.connection && this.channel) {
        for (const [queueName, consumer] of this.consumers.entries()) {
          try {
            await this.subscribe(queueName, consumer.pattern, () => {});
            logger.info(`Restored consumer for queue ${queueName}`);
          } catch (err) {
            logger.error(`Failed to restore consumer for queue ${queueName}`, {
              error: (err as Error).message
            });
          }
        }
      }
    } catch (err) {
      logger.error('Reconnection attempt failed', { error: (err as Error).message });
    }
  }

  /**
   * Get connection and channel, initializing if necessary
   * @returns Connection and channel
   */
  async getConnection(): Promise<ConnectionDetails> {
    if (!this.connection || !this.channel) {
      return this.initialize();
    }
    return { connection: this.connection, channel: this.channel };
  }

  /**
   * Publish message to exchange
   * @param routingKey - Routing key
   * @param message - Message to publish
   * @param options - Publishing options
   * @returns True if successful
   */
  async publish(routingKey: string, message: any, options: PublishOptions = {}): Promise<boolean> {
    try {
      const { channel } = await this.getConnection();
      
      // Prepare message content
      const content = Buffer.from(JSON.stringify(message));
      
      // Default publish options
      const defaultOptions: Options.Publish = {
        persistent: true,
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        timestamp: Date.now()
      };
      
      // Merge options
      const publishOptions: Options.Publish = {
        ...defaultOptions,
        ...options
      };
      
      // Publish message
      const result = channel.publish(
        this.config.exchangeName,
        routingKey,
        content,
        publishOptions
      );
      
      if (result) {
        logger.debug('Published message', { routingKey, messageId: publishOptions.messageId });
      } else {
        logger.warn('Failed to publish message', { routingKey });
      }
      
      return result;
    } catch (err) {
      logger.error('Error publishing message', { 
        routingKey, 
        error: (err as Error).message 
      });
      throw err;
    }
  }

  /**
   * Subscribe to messages
   * @param queueName - Queue name
   * @param pattern - Routing pattern
   * @param callback - Message handler
   * @returns Queue details
   */
  async subscribe(queueName: string, pattern: string, callback: MessageHandler): Promise<ConsumerDetails> {
    try {
      const { channel } = await this.getConnection();
      
      // Set up dead letter queue
      await this.setupDeadLetterQueue(pattern);
      
      // Assert queue with dead letter exchange
      const queue = await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': `${this.config.exchangeName}.dlx`,
          'x-dead-letter-routing-key': `${pattern}.dlq`
        }
      });
      
      // Bind queue to exchange with routing pattern
      await channel.bindQueue(queue.queue, this.config.exchangeName, pattern);
      
      // Set prefetch count to avoid overwhelming consumers
      await channel.prefetch(10);
      
      // Consume messages
      const { consumerTag } = await channel.consume(queue.queue, async (msg) => {
        if (!msg) return;
        
        try {
          // Parse message content
          const content = JSON.parse(msg.content.toString());
          
          // Process message
          await Promise.resolve(callback(content, msg));
          
          // Acknowledge message
          channel.ack(msg);
        } catch (err) {
          logger.error('Error processing message', { 
            queue: queueName, 
            error: (err as Error).message 
          });
          
          // Reject message and send to dead letter queue
          channel.reject(msg, false);
        }
      });
      
      // Store consumer details
      const consumerDetails: ConsumerDetails = {
        consumerTag,
        queueName: queue.queue,
        pattern
      };
      
      this.consumers.set(queueName, consumerDetails);
      
      logger.info(`Subscribed to ${pattern} messages on queue ${queueName}`);
      
      return consumerDetails;
    } catch (err) {
      logger.error('Error subscribing to messages', { 
        queue: queueName, 
        pattern, 
        error: (err as Error).message 
      });
      throw err;
    }
  }

  /**
   * Unsubscribe from queue
   * @param queueName - Queue name
   * @returns True if successful
   */
  async unsubscribe(queueName: string): Promise<boolean> {
    try {
      const { channel } = await this.getConnection();
      
      // Get consumer details
      const consumer = this.consumers.get(queueName);
      
      if (!consumer) {
        logger.warn(`No consumer found for queue ${queueName}`);
        return false;
      }
      
      // Cancel consumer
      await channel.cancel(consumer.consumerTag);
      
      // Remove from consumers map
      this.consumers.delete(queueName);
      
      logger.info(`Unsubscribed from queue ${queueName}`);
      return true;
    } catch (err) {
      logger.error('Error unsubscribing from queue', { 
        queue: queueName, 
        error: (err as Error).message 
      });
      throw err;
    }
  }

  /**
   * Set up dead letter queue for a specific pattern
   * @param pattern - Routing pattern
   * @returns Dead letter queue details
   */
  async setupDeadLetterQueue(pattern: string): Promise<amqp.Replies.AssertQueue> {
    try {
      const { channel } = await this.getConnection();
      
      // Assert dead letter exchange
      await channel.assertExchange(
        `${this.config.exchangeName}.dlx`,
        'topic',
        { durable: true }
      );
      
      // Assert dead letter queue
      const dlq = await channel.assertQueue(
        `${pattern}.dlq`,
        { durable: true }
      );
      
      // Bind dead letter queue to dead letter exchange
      await channel.bindQueue(
        dlq.queue,
        `${this.config.exchangeName}.dlx`,
        `${pattern}.dlq`
      );
      
      logger.info(`Set up dead letter queue for pattern ${pattern}`);
      
      return dlq;
    } catch (err) {
      logger.error('Error setting up dead letter queue', { 
        pattern, 
        error: (err as Error).message 
      });
      throw err;
    }
  }

  /**
   * Process messages from dead letter queue
   * @param pattern - Routing pattern
   * @param callback - Message handler
   * @returns Consumer details
   */
  async processDLQ(pattern: string, callback: MessageHandler): Promise<ConsumerDetails> {
    try {
      const { channel } = await this.getConnection();
      const dlqName = `${pattern}.dlq`;
      
      // Set up dead letter queue if not already set up
      await this.setupDeadLetterQueue(pattern);
      
      // Consume messages from dead letter queue
      const { consumerTag } = await channel.consume(dlqName, async (msg) => {
        if (!msg) return;
        
        try {
          // Parse message
          const content = JSON.parse(msg.content.toString());
          
          // Process message
          await Promise.resolve(callback(content, msg));
          
          // Acknowledge message
          channel.ack(msg);
        } catch (err) {
          logger.error('Error processing DLQ message', { 
            queue: dlqName, 
            error: (err as Error).message 
          });
          
          // Reject message without requeuing
          channel.reject(msg, false);
        }
      });
      
      logger.info(`Processing dead letter queue for pattern ${pattern}`);
      
      const consumerDetails: ConsumerDetails = {
        consumerTag,
        queueName: dlqName,
        pattern
      };
      
      return consumerDetails;
    } catch (err) {
      logger.error('Error processing dead letter queue', { 
        pattern, 
        error: (err as Error).message 
      });
      throw err;
    }
  }

  /**
   * Close connection and channel
   */
  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
        logger.info('Closed RabbitMQ channel');
      }
      
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
        logger.info('Closed RabbitMQ connection');
      }
      
      // Clear consumers map
      this.consumers.clear();
    } catch (err) {
      logger.error('Error closing RabbitMQ connection', { error: (err as Error).message });
      throw err;
    }
  }
}

// Export singleton instance
const messageQueue = new MessageQueue();
export default messageQueue;
