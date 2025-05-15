/**
 * Swagger/OpenAPI documentation for SAP backend services
 * This module provides API documentation across all microservices
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express, Request, Response } from 'express';
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
      ...(defaultOptions.definition || {}),
      ...(options.definition || {}),
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
const setupSwagger = (app: Express, options: SwaggerOptions = {}, path = '/api-docs'): void => {
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

export {
  generateSwaggerSpec,
  setupSwagger,
  SwaggerOptions,
  SwaggerDefinition
};
