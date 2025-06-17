/**
 * Swagger Aggregator
 * Fetches and combines Swagger documentation from multiple microservices
 * Includes retry mechanism for services that might not be immediately available
 */
import axios from 'axios';
import * as deepmerge from 'deepmerge';
import { createServiceLogger } from '../../../shared/utils/logger';
import { EventEmitter } from 'events';

// Create an event emitter for communication between modules
export const swaggerEvents = new EventEmitter();

const logger = createServiceLogger('swagger-aggregator');

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,       // Maximum number of retry attempts
  initialDelay: 5000,  // Initial delay in ms (5 seconds)
  maxDelay: 30000,     // Maximum delay between retries (30 seconds)
  factor: 2,           // Exponential backoff factor
  timeout: 5000        // Request timeout in ms
};

// Event names
export const SWAGGER_EVENTS = {
  NEW_SPECS_AVAILABLE: 'newSwaggerSpecsAvailable'
};

export interface SwaggerSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
    responses?: Record<string, any>;
    parameters?: Record<string, any>;
    examples?: Record<string, any>;
    requestBodies?: Record<string, any>;
    headers?: Record<string, any>;
    links?: Record<string, any>;
    callbacks?: Record<string, any>;
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface ServiceInfo {
  name: string;
  url: string;
  swaggerPath: string;
}

/**
 * Fetches the Swagger specification from a microservice with retry mechanism
 * @param service Service information including URL and Swagger path
 * @param retryCount Current retry count (used internally for recursion)
 * @returns The Swagger specification or null if unavailable after all retries
 */
async function fetchServiceSwagger(
  service: ServiceInfo, 
  retryCount: number = 0
): Promise<SwaggerSpec | null> {
  // Common Swagger doc paths to try
  const swaggerPaths = [
    service.swaggerPath,                // Original path (usually /swagger.json)
    '/api-docs/swagger.json',           // Common Express Swagger UI path
    '/api/swagger.json',                // Another common path
    '/api-docs/v1/swagger.json',        // Versioned path
    '/swagger-ui/swagger.json',         // Alternative path
    '/docs/swagger.json'                // Another alternative
  ];
  
  // Try each path in order
  for (const path of swaggerPaths) {
    try {
      const url = `${service.url}${path}`;
      logger.info(`Attempting to fetch Swagger spec from ${service.name} at ${url}`);
      
      const response = await axios.get(url, {
        timeout: RETRY_CONFIG.timeout,
        headers: {
          'Accept': 'application/json'
        },
        validateStatus: status => status < 400 // Accept any 2xx or 3xx response
      });
      
      if (response.status === 200 && response.data) {
        logger.info(`Successfully fetched Swagger spec from ${service.name} using path ${path}`);
        return response.data as SwaggerSpec;
      }
      
      logger.warn(`Failed to fetch Swagger spec from ${service.name} at ${path}: Unexpected response`, {
        status: response.status
      });
      
    } catch (error: any) {
      // Just log and try the next path
      const errorCode = error.code || (error.response ? error.response.status : 'unknown');
      logger.warn(`Error fetching Swagger spec from ${service.name} at ${path}: ${errorCode}`);
    }
  }
  
  // If we get here, all paths failed
  logger.warn(`Failed to fetch Swagger spec from ${service.name} after trying ${swaggerPaths.length} paths`);
  
  // Implement retry with exponential backoff
  if (retryCount < RETRY_CONFIG.maxRetries) {
    const nextRetry = retryCount + 1;
    const delay = Math.min(
      RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.factor, retryCount),
      RETRY_CONFIG.maxDelay
    );
    
    logger.info(`Will retry fetching ${service.name} Swagger spec in ${delay}ms (attempt ${nextRetry}/${RETRY_CONFIG.maxRetries})`);
    
    return new Promise((resolve) => {
      setTimeout(async () => {
        const result = await fetchServiceSwagger(service, nextRetry);
        resolve(result);
      }, delay);
    });
  }

  // After all retries, we give up
  logger.error(`Failed to fetch Swagger spec from ${service.name} after ${RETRY_CONFIG.maxRetries + 1} attempts`);
  return null;
}

/**
 * Customizes a service's Swagger spec to prevent collisions
 * @param spec The service's Swagger specification
 * @param service Service information
 * @returns Modified Swagger specification
 */
function customizeServiceSpec(spec: SwaggerSpec, service: ServiceInfo): SwaggerSpec {
  // Add service name to tag descriptions for clarity
  if (spec.tags) {
    spec.tags = spec.tags.map(tag => ({
      ...tag,
      name: `${service.name.replace(/\s+Service$/i, '')}_${tag.name}`,
      description: `${tag.description || ''} (from ${service.name})`
    }));
  }
  
  // Update path operations to reference the new tag names
  if (spec.paths) {
    Object.keys(spec.paths).forEach(path => {
      const pathItem = spec.paths[path];
      Object.keys(pathItem).forEach(method => {
        if (pathItem[method].tags && Array.isArray(pathItem[method].tags)) {
          pathItem[method].tags = pathItem[method].tags.map(
            (tag: string) => `${service.name.replace(/\s+Service$/i, '')}_${tag}`
          );
        }
      });
    });
  }
  
  return spec;
}

/**
 * Merges multiple Swagger specifications into one
 * @param specs Array of Swagger specifications
 * @param mainInfo Main info for the aggregated specification
 * @returns Combined Swagger specification
 */
function mergeSwaggerSpecs(specs: SwaggerSpec[], mainInfo: SwaggerSpec['info']): SwaggerSpec {
  if (!specs.length) {
    logger.warn('No valid Swagger specs found to merge');
    return {
      openapi: '3.0.0',
      info: mainInfo,
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {},
        responses: {}
      },
      tags: []
    };
  }
  
  const baseSpec = specs[0];
  
  if (specs.length === 1) {
    return {
      ...baseSpec,
      info: mainInfo
    };
  }
  
  // Setup for merging
  let mergedSpec: SwaggerSpec = {
    openapi: baseSpec.openapi,
    info: mainInfo,
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
      responses: {},
      parameters: {},
      examples: {},
      requestBodies: {},
      headers: {},
      links: {},
      callbacks: {}
    },
    tags: []
  };
  
  // Collect all servers
  const allServers: any[] = [];
  
  // Merge specifications
  specs.forEach(spec => {
    // Merge paths
    mergedSpec.paths = { ...mergedSpec.paths, ...spec.paths };
    
    // Merge components
    if (spec.components) {
      Object.keys(spec.components).forEach(key => {
        const componentKey = key as keyof SwaggerSpec['components'];
        if (spec.components && spec.components[componentKey]) {
          // @ts-ignore - Dynamic property access
          mergedSpec.components[componentKey] = {
            // @ts-ignore - Dynamic property access
            ...(mergedSpec.components[componentKey] || {}),
            // @ts-ignore - Dynamic property access
            ...spec.components[componentKey]
          };
        }
      });
    }
    
    // Collect servers
    if (spec.servers && spec.servers.length) {
      allServers.push(...spec.servers);
    }
    
    // Merge tags
    if (spec.tags && spec.tags.length) {
      mergedSpec.tags = [...(mergedSpec.tags || []), ...spec.tags];
    }
  });
  
  // Add unique servers
  if (allServers.length) {
    mergedSpec.servers = allServers.filter((server, index, self) => 
      index === self.findIndex(s => s.url === server.url)
    );
  }
  
  return mergedSpec;
}

/**
 * Fetches and aggregates Swagger specs from all configured services
 * Includes a schedule mechanism to periodically retry fetching missing specs
 * @param services Array of service configurations
 * @param mainInfo Main info for the aggregated specification
 * @returns Aggregated Swagger specification
 */
export async function aggregateSwaggerSpecs(
  services: ServiceInfo[],
  mainInfo: SwaggerSpec['info']
): Promise<SwaggerSpec> {
  // Fetch all service specs in parallel with built-in retry capability
  const specsPromises = services.map(service => fetchServiceSwagger(service));
  const specs = await Promise.all(specsPromises);
  
  // Filter out failed fetches and customize each spec
  const validSpecs: SwaggerSpec[] = [];
  const failedServices: ServiceInfo[] = [];
  
  specs.forEach((spec, index) => {
    if (spec) {
      const customizedSpec = customizeServiceSpec(spec, services[index]);
      validSpecs.push(customizedSpec);
    } else {
      failedServices.push(services[index]);
    }
  });
  
  logger.info(`Successfully aggregated ${validSpecs.length} out of ${services.length} Swagger specs`);
  
  // Set up a background task to continue trying to fetch specs from failed services
  if (failedServices.length > 0) {
    logger.info(`Will continue trying to fetch specs from ${failedServices.length} missing services in the background`);
    scheduleSpecRetry(failedServices, mainInfo);
  }
  
  // Merge all valid specs
  return mergeSwaggerSpecs(validSpecs, mainInfo);
}

/**
 * Schedules a retry to fetch specs from services that failed during initial aggregation
 * When specs are successfully fetched, they will be merged with the existing Swagger documentation
 * @param failedServices List of services that failed during initial fetch
 * @param mainInfo Main info for the aggregated specification
 */
async function scheduleSpecRetry(
  failedServices: ServiceInfo[], 
  mainInfo: SwaggerSpec['info']
): Promise<void> {
  // Wait for a significant time to allow services to finish initializing
  const retryDelay = RETRY_CONFIG.maxDelay;
  
  logger.info(`Scheduling retry for ${failedServices.length} services in ${retryDelay}ms`);
  
  setTimeout(async () => {
    try {
      // Fetch all previously failed service specs in parallel
      logger.info('Retrying to fetch specs for previously unavailable services');
      const specsPromises = failedServices.map(service => fetchServiceSwagger(service));
      const specs = await Promise.all(specsPromises);
      
      // Filter out any that still failed
      const newlyAvailableSpecs: SwaggerSpec[] = [];
      const stillFailedServices: ServiceInfo[] = [];
      
      specs.forEach((spec, index) => {
        if (spec) {
          const customizedSpec = customizeServiceSpec(spec, failedServices[index]);
          newlyAvailableSpecs.push(customizedSpec);
        } else {
          stillFailedServices.push(failedServices[index]);
        }
      });
      
      if (newlyAvailableSpecs.length > 0) {
        logger.info(`Successfully fetched ${newlyAvailableSpecs.length} more service specs during retry`);
        
        // Here you would need to update the existing Swagger UI 
        // This requires an external mechanism to notify the API Gateway to refresh its Swagger docs
        // This could be done through an event emitter or by exposing an endpoint
        
        // Signal that new specs are available using our event emitter
        swaggerEvents.emit(SWAGGER_EVENTS.NEW_SPECS_AVAILABLE, newlyAvailableSpecs);
      }
      
      // If there are still failed services, schedule another retry with longer delay
      if (stillFailedServices.length > 0) {
        logger.info(`Still unable to fetch specs from ${stillFailedServices.length} services, scheduling another retry`);
        scheduleSpecRetry(stillFailedServices, mainInfo);
      }
    } catch (error) {
      logger.error('Error during scheduled retry of spec fetching', error);
    }
  }, retryDelay);
}
