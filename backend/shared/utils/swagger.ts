/**
 * Swagger/OpenAPI documentation for SAP backend services
 * This module provides API documentation across all microservices
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Request, Response } from 'express';
import { Express } from 'express-serve-static-core';
import config from '../config';

// Define interfaces for Swagger options
interface SwaggerDefinition {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    license?: {
      name: string;
      url: string;
    };
    contact?: {
      name: string;
      url: string;
      email: string;
    };
  };
  servers?: Array<{
    url: string;
    description: string;
  }>;
  components?: {
    securitySchemes?: {
      [key: string]: {
        type: string;
        scheme?: string;
        bearerFormat?: string;
        flows?: any;
      };
    };
    schemas?: any;
    responses?: any;
    parameters?: any;
    examples?: any;
    requestBodies?: any;
    headers?: any;
    links?: any;
    callbacks?: any;
  };
  security?: Array<{
    [key: string]: string[];
  }>;
  [key: string]: any;
}

interface SwaggerOptions {
  definition?: SwaggerDefinition;
  apis?: string[];
  [key: string]: any;
}

/**
 * Generate Swagger specification
 * @param options - Swagger options
 * @returns Swagger specification
 */
const generateSwaggerSpec = (options: SwaggerOptions = {}): object => {
  const defaultOptions: SwaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'SAP API Documentation',
        version: '1.0.0',
        description: 'API documentation for SAP backend services',
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
        contact: {
          name: 'SAP Support',
          url: 'https://sap-project.example.com',
          email: 'support@sap-project.example.com',
        },
      },
      servers: [
        {
          url: config.get('services.gateway', 'http://localhost:5001'),
          description: 'API Gateway',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
    apis: ['./routes/*.js', './controllers/*.js', './models/*.js'],
  };

  // Merge default options with provided options
  const mergedOptions: SwaggerOptions = {
    ...defaultOptions,
    ...options,
    definition: {
      openapi: (options.definition?.openapi || defaultOptions.definition?.openapi || '3.0.0'),
      info: {
        title: options.definition?.info?.title || defaultOptions.definition?.info?.title || 'API Documentation',
        version: options.definition?.info?.version || defaultOptions.definition?.info?.version || '1.0.0',
        description: options.definition?.info?.description || defaultOptions.definition?.info?.description || 'API Documentation',
        ...(options.definition?.info?.license || defaultOptions.definition?.info?.license ? {
          license: options.definition?.info?.license || defaultOptions.definition?.info?.license
        } : {}),
        ...(options.definition?.info?.contact || defaultOptions.definition?.info?.contact ? {
          contact: options.definition?.info?.contact || defaultOptions.definition?.info?.contact
        } : {}),
      },
      ...(options.definition?.servers || defaultOptions.definition?.servers ? {
        servers: options.definition?.servers || defaultOptions.definition?.servers
      } : {}),
      ...(options.definition?.components || defaultOptions.definition?.components ? {
        components: options.definition?.components || defaultOptions.definition?.components
      } : {}),
      ...(options.definition?.security || defaultOptions.definition?.security ? {
        security: options.definition?.security || defaultOptions.definition?.security
      } : {}),
    },
  };

  return swaggerJsdoc(mergedOptions);
};

/**
 * Set up Swagger UI for Express app
 * @param app - Express app
 * @param options - Swagger options
 * @param path - Path to serve Swagger UI (default: /api-docs)
 */
const setupSwagger = (app: any, options: SwaggerOptions = {}, path = '/api-docs'): void => {
  const swaggerSpec = generateSwaggerSpec(options);

  // Serve Swagger UI
  app.use(path, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
  }));

  // Serve Swagger specification as JSON
  app.get(`${path}.json`, (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log(`Swagger UI available at ${path}`);
};

/**
 * Creates service-specific Swagger configuration
 * @param serviceName Name of the service
 * @param serviceDescription Description of the service's purpose
 * @param port Port the service runs on
 * @param apiPaths Glob patterns for finding API documentation in code (default: controllers, routes, and models)
 * @returns Swagger configuration object
 */
const createServiceSwaggerConfig = (
  serviceName: string, 
  serviceDescription: string, 
  port: number,
  apiPaths: string[] = ['./src/routes/**/*.ts', './src/controllers/**/*.ts', './src/models/**/*.ts', './src/entities/**/*.ts']
): SwaggerOptions => {
  return {
    definition: {
      openapi: '3.0.0',
      info: {
        title: `${serviceName} API Documentation`,
        version: '1.0.0',
        description: serviceDescription,
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: `http://localhost:${port}`,
          description: 'Development Server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        },
        responses: {
          UnauthorizedError: {
            description: 'Authentication failed or token is invalid',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Unauthorized' },
                    error: { type: 'string', example: 'Invalid or expired token' }
                  }
                }
              }
            }
          },
          ServerError: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Internal Server Error' },
                    error: { type: 'string', example: 'An unexpected error occurred' }
                  }
                }
              }
            }
          },
          ForbiddenError: {
            description: 'Access denied due to insufficient permissions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Forbidden' },
                    error: { type: 'string', example: 'Insufficient permissions' }
                  }
                }
              }
            }
          }
        }
      },
      security: [
        {
          bearerAuth: []
        }
      ]
    },
    apis: apiPaths,
  };
};

export {
  generateSwaggerSpec,
  setupSwagger,
  SwaggerOptions,
  SwaggerDefinition,
  createServiceSwaggerConfig
};
