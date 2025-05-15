/**
 * WebSocket Utility
 * Provides real-time communication capabilities using Socket.IO
 */

import { Server as HttpServer } from 'http';
import socketIO, { Server, Socket, Namespace } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createServiceLogger } from './logger';
import config from '../config';
import redisClient from './redis';
import { AppError, ErrorTypes } from './errorHandler';

// Initialize logger
const logger = createServiceLogger('websocket');

// Define interfaces
interface SocketIOOptions {
  cors?: {
    origin?: string | string[];
    methods?: string[];
    credentials?: boolean;
  };
  transports?: string[];
  pingInterval?: number;
  pingTimeout?: number;
  [key: string]: any;
}

interface AuthOptions {
  secret?: string;
  userProperty?: string;
  [key: string]: any;
}

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  [key: string]: any;
}

interface ClientRateLimit {
  count: number;
  resetAt: number;
}

interface EmitOptions {
  volatile?: boolean;
  compress?: boolean;
  [key: string]: any;
}

// Redis adapter for Socket.IO (for horizontal scaling)
let redisAdapter: any = null;

// Try to load the Redis adapter if available
try {
  const { createAdapter } = require('@socket.io/redis-adapter');
  redisAdapter = createAdapter;
} catch (err) {
  logger.warn('Socket.IO Redis adapter not available, horizontal scaling will not work');
}

/**
 * WebSocket server singleton
 */
class WebSocketServer {
  private io: Server | null;
  private namespaces: Map<string, Namespace>;
  private middlewares: Array<(socket: Socket, next: (err?: Error) => void) => void>;

  constructor() {
    this.io = null;
    this.namespaces = new Map();
    this.middlewares = [];
  }

  /**
   * Initialize WebSocket server
   * @param server - HTTP server
   * @param options - Socket.IO options
   * @returns Socket.IO server
   */
  initialize(server: HttpServer, options: SocketIOOptions = {}): Server {
    if (this.io) {
      return this.io;
    }

    const defaultOptions: SocketIOOptions = {
      cors: {
        origin: config.get('cors.origin', '*'),
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingInterval: 10000,
      pingTimeout: 5000
    };

    // Create Socket.IO server
    this.io = new Server(server, { ...defaultOptions, ...options });
    
    // Set up Redis adapter if available
    if (redisAdapter) {
      const pubClient = redisClient.getClient();
      const subClient = redisClient.getClient();
      
      this.io.adapter(redisAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter initialized');
    }

    // Apply global middlewares
    this.middlewares.forEach(middleware => {
      this.io.use(middleware);
    });

    // Set up default connection handler
    this.io.on('connection', (socket: Socket) => {
      logger.info('New socket connection', { 
        socketId: socket.id,
        transport: (socket as any).conn.transport.name
      });

      // Handle disconnect
      socket.on('disconnect', (reason: string) => {
        logger.info('Socket disconnected', { 
          socketId: socket.id, 
          reason 
        });
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        logger.error('Socket error', { 
          socketId: socket.id, 
          error: error.message 
        });
      });
    });

    logger.info('WebSocket server initialized');
    return this.io;
  }

  /**
   * Get Socket.IO server instance
   * @returns Socket.IO server
   */
  getIO(): Server {
    if (!this.io) {
      throw new AppError(ErrorTypes.INTERNAL_ERROR, 'WebSocket server not initialized');
    }
    return this.io;
  }

  /**
   * Add middleware to Socket.IO server
   * @param middleware - Socket.IO middleware
   */
  use(middleware: (socket: Socket, next: (err?: Error) => void) => void): void {
    if (typeof middleware !== 'function') {
      throw new AppError(ErrorTypes.BAD_REQUEST, 'Middleware must be a function');
    }

    if (this.io) {
      // Apply to existing server
      this.io.use(middleware);
    }

    // Store for future initialization
    this.middlewares.push(middleware);
  }

  /**
   * Create or get namespace
   * @param name - Namespace name
   * @param connectionHandler - Connection handler
   * @returns Socket.IO namespace
   */
  namespace(name: string, connectionHandler?: (socket: Socket) => void): Namespace {
    if (!this.io) {
      throw new AppError(ErrorTypes.INTERNAL_ERROR, 'WebSocket server not initialized');
    }

    // Ensure name starts with /
    const namespaceName = name.startsWith('/') ? name : `/${name}`;

    // Check if namespace already exists
    if (this.namespaces.has(namespaceName)) {
      return this.namespaces.get(namespaceName)!;
    }

    // Create namespace
    const namespace = this.io.of(namespaceName);

    // Set up connection handler if provided
    if (typeof connectionHandler === 'function') {
      namespace.on('connection', connectionHandler);
    }

    // Store namespace
    this.namespaces.set(namespaceName, namespace);

    logger.info(`Created WebSocket namespace: ${namespaceName}`);
    return namespace;
  }

  /**
   * Emit event to all clients in a namespace
   * @param event - Event name
   * @param data - Event data
   * @param namespace - Namespace name (optional)
   * @param options - Emit options
   * @returns True if successful
   */
  emit(event: string, data: any, namespace: string = '/', options: EmitOptions = {}): boolean {
    if (!this.io) {
      throw new AppError(ErrorTypes.INTERNAL_ERROR, 'WebSocket server not initialized');
    }

    try {
      // Get namespace
      const ns = namespace === '/' 
        ? this.io 
        : this.namespace(namespace);

      // Create emitter
      let emitter = ns;
      
      // Apply options
      if (options.volatile) {
        emitter = emitter.volatile;
      }
      
      // Emit event
      emitter.emit(event, data);
      
      logger.debug(`Emitted event ${event} to namespace ${namespace}`);
      return true;
    } catch (err) {
      logger.error(`Error emitting event ${event}`, { 
        namespace, 
        error: (err as Error).message 
      });
      return false;
    }
  }

  /**
   * Emit event to a specific room
   * @param room - Room name
   * @param event - Event name
   * @param data - Event data
   * @param namespace - Namespace name (optional)
   * @param options - Emit options
   * @returns True if successful
   */
  emitToRoom(room: string, event: string, data: any, namespace: string = '/', options: EmitOptions = {}): boolean {
    if (!this.io) {
      throw new AppError(ErrorTypes.INTERNAL_ERROR, 'WebSocket server not initialized');
    }

    try {
      // Get namespace
      const ns = namespace === '/' 
        ? this.io 
        : this.namespace(namespace);

      // Create emitter
      let emitter = ns.to(room);
      
      // Apply options
      if (options.volatile) {
        emitter = emitter.volatile;
      }
      
      // Emit event
      emitter.emit(event, data);
      
      logger.debug(`Emitted event ${event} to room ${room} in namespace ${namespace}`);
      return true;
    } catch (err) {
      logger.error(`Error emitting event ${event} to room ${room}`, { 
        namespace, 
        error: (err as Error).message 
      });
      return false;
    }
  }

  /**
   * Emit event to a specific client
   * @param socketId - Socket ID
   * @param event - Event name
   * @param data - Event data
   * @param namespace - Namespace name (optional)
   * @param options - Emit options
   * @returns True if successful
   */
  emitToClient(socketId: string, event: string, data: any, namespace: string = '/', options: EmitOptions = {}): boolean {
    if (!this.io) {
      throw new AppError(ErrorTypes.INTERNAL_ERROR, 'WebSocket server not initialized');
    }

    try {
      // Get namespace
      const ns = namespace === '/' 
        ? this.io 
        : this.namespace(namespace);

      // Get socket
      const socket = ns.sockets.get(socketId);
      
      if (!socket) {
        logger.warn(`Socket ${socketId} not found in namespace ${namespace}`);
        return false;
      }

      // Create emitter
      let emitter = socket;
      
      // Apply options
      if (options.volatile) {
        emitter = emitter.volatile;
      }
      
      // Emit event
      emitter.emit(event, data);
      
      logger.debug(`Emitted event ${event} to socket ${socketId} in namespace ${namespace}`);
      return true;
    } catch (err) {
      logger.error(`Error emitting event ${event} to socket ${socketId}`, { 
        namespace, 
        error: (err as Error).message 
      });
      return false;
    }
  }

  /**
   * Add client to a room
   * @param socketId - Socket ID
   * @param room - Room name
   * @param namespace - Namespace name (optional)
   * @returns True if successful
   */
  joinRoom(socketId: string, room: string, namespace: string = '/'): boolean {
    if (!this.io) {
      throw new AppError(ErrorTypes.INTERNAL_ERROR, 'WebSocket server not initialized');
    }

    try {
      // Get namespace
      const ns = namespace === '/' 
        ? this.io 
        : this.namespace(namespace);

      // Get socket
      const socket = ns.sockets.get(socketId);
      
      if (!socket) {
        logger.warn(`Socket ${socketId} not found in namespace ${namespace}`);
        return false;
      }

      // Join room
      socket.join(room);
      
      logger.debug(`Socket ${socketId} joined room ${room} in namespace ${namespace}`);
      return true;
    } catch (err) {
      logger.error(`Error joining room ${room}`, { 
        socketId, 
        namespace, 
        error: (err as Error).message 
      });
      return false;
    }
  }

  /**
   * Remove client from a room
   * @param socketId - Socket ID
   * @param room - Room name
   * @param namespace - Namespace name (optional)
   * @returns True if successful
   */
  leaveRoom(socketId: string, room: string, namespace: string = '/'): boolean {
    if (!this.io) {
      throw new AppError(ErrorTypes.INTERNAL_ERROR, 'WebSocket server not initialized');
    }

    try {
      // Get namespace
      const ns = namespace === '/' 
        ? this.io 
        : this.namespace(namespace);

      // Get socket
      const socket = ns.sockets.get(socketId);
      
      if (!socket) {
        logger.warn(`Socket ${socketId} not found in namespace ${namespace}`);
        return false;
      }

      // Leave room
      socket.leave(room);
      
      logger.debug(`Socket ${socketId} left room ${room} in namespace ${namespace}`);
      return true;
    } catch (err) {
      logger.error(`Error leaving room ${room}`, { 
        socketId, 
        namespace, 
        error: (err as Error).message 
      });
      return false;
    }
  }

  /**
   * Get clients in a room
   * @param room - Room name
   * @param namespace - Namespace name (optional)
   * @returns Array of socket IDs
   */
  async getClientsInRoom(room: string, namespace: string = '/'): Promise<string[]> {
    if (!this.io) {
      throw new AppError(ErrorTypes.INTERNAL_ERROR, 'WebSocket server not initialized');
    }

    try {
      // Get namespace
      const ns = namespace === '/' 
        ? this.io 
        : this.namespace(namespace);

      // Get sockets in room
      const sockets = await ns.in(room).fetchSockets();
      
      return sockets.map(socket => socket.id);
    } catch (err) {
      logger.error(`Error getting clients in room ${room}`, { 
        namespace, 
        error: (err as Error).message 
      });
      return [];
    }
  }

  /**
   * Create authentication middleware
   * @param options - Authentication options
   * @returns Socket.IO middleware
   */
  createAuthMiddleware(options: AuthOptions = {}): (socket: Socket, next: (err?: Error) => void) => void {
    const {
      secret = config.get('jwt.secret', 'your-secret-key-change-in-production'),
      userProperty = 'user'
    } = options;

    return (socket: Socket, next: (err?: Error) => void): void => {
      try {
        // Get token from handshake
        const authHeader = socket.handshake.headers.authorization as string | undefined;
        const token = socket.handshake.auth.token || 
                     (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined);

        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Verify token
        jwt.verify(token, secret, (err, decoded) => {
          if (err) {
            return next(new Error('Invalid token'));
          }

          // Attach user to socket
          (socket as any)[userProperty] = decoded;
          next();
        });
      } catch (err) {
        logger.error('WebSocket authentication error', { error: (err as Error).message });
        next(new Error('Authentication error'));
      }
    };
  }

  /**
   * Create rate limiting middleware
   * @param options - Rate limiting options
   * @returns Socket.IO middleware
   */
  createRateLimitMiddleware(options: RateLimitOptions = {}): (socket: Socket, next: (err?: Error) => void) => void {
    const {
      windowMs = 60000, // 1 minute
      max = 100, // 100 events per minute
      message = 'Too many events, please try again later'
    } = options;

    const clients = new Map<string, ClientRateLimit>();

    return (socket: Socket, next: (err?: Error) => void): void => {
      try {
        const clientId = socket.id;
        const now = Date.now();
        
        // Get client data
        const clientData = clients.get(clientId) || {
          count: 0,
          resetAt: now + windowMs
        };
        
        // Check if window has expired
        if (now > clientData.resetAt) {
          clientData.count = 0;
          clientData.resetAt = now + windowMs;
        }
        
        // Check rate limit
        if (clientData.count >= max) {
          return next(new Error(message));
        }
        
        // Increment count
        clientData.count++;
        clients.set(clientId, clientData);
        
        // Clean up on disconnect
        socket.on('disconnect', () => {
          clients.delete(clientId);
        });
        
        next();
      } catch (err) {
        logger.error('WebSocket rate limit error', { error: (err as Error).message });
        next(new Error('Rate limit error'));
      }
    };
  }
}

// Export singleton instance
const webSocketServer = new WebSocketServer();
export default webSocketServer;
