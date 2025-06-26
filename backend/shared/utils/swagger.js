"use strict";
/**
 * Swagger/OpenAPI documentation for SAP backend services
 * This module provides API documentation across all microservices
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceSwaggerConfig = exports.setupSwagger = exports.generateSwaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const config_1 = __importDefault(require("../config"));
/**
 * Generate Swagger specification
 * @param options - Swagger options
 * @returns Swagger specification
 */
const generateSwaggerSpec = (options = {}) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17;
    const defaultOptions = {
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
                    url: config_1.default.get('services.gateway', 'http://localhost:5001'),
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
    const mergedOptions = Object.assign(Object.assign(Object.assign({}, defaultOptions), options), { definition: Object.assign(Object.assign(Object.assign({ openapi: (((_a = options.definition) === null || _a === void 0 ? void 0 : _a.openapi) || ((_b = defaultOptions.definition) === null || _b === void 0 ? void 0 : _b.openapi) || '3.0.0'), info: Object.assign(Object.assign({ title: ((_d = (_c = options.definition) === null || _c === void 0 ? void 0 : _c.info) === null || _d === void 0 ? void 0 : _d.title) || ((_f = (_e = defaultOptions.definition) === null || _e === void 0 ? void 0 : _e.info) === null || _f === void 0 ? void 0 : _f.title) || 'API Documentation', version: ((_h = (_g = options.definition) === null || _g === void 0 ? void 0 : _g.info) === null || _h === void 0 ? void 0 : _h.version) || ((_k = (_j = defaultOptions.definition) === null || _j === void 0 ? void 0 : _j.info) === null || _k === void 0 ? void 0 : _k.version) || '1.0.0', description: ((_m = (_l = options.definition) === null || _l === void 0 ? void 0 : _l.info) === null || _m === void 0 ? void 0 : _m.description) || ((_p = (_o = defaultOptions.definition) === null || _o === void 0 ? void 0 : _o.info) === null || _p === void 0 ? void 0 : _p.description) || 'API Documentation' }, (((_r = (_q = options.definition) === null || _q === void 0 ? void 0 : _q.info) === null || _r === void 0 ? void 0 : _r.license) || ((_t = (_s = defaultOptions.definition) === null || _s === void 0 ? void 0 : _s.info) === null || _t === void 0 ? void 0 : _t.license) ? {
                license: ((_v = (_u = options.definition) === null || _u === void 0 ? void 0 : _u.info) === null || _v === void 0 ? void 0 : _v.license) || ((_x = (_w = defaultOptions.definition) === null || _w === void 0 ? void 0 : _w.info) === null || _x === void 0 ? void 0 : _x.license)
            } : {})), (((_z = (_y = options.definition) === null || _y === void 0 ? void 0 : _y.info) === null || _z === void 0 ? void 0 : _z.contact) || ((_1 = (_0 = defaultOptions.definition) === null || _0 === void 0 ? void 0 : _0.info) === null || _1 === void 0 ? void 0 : _1.contact) ? {
                contact: ((_3 = (_2 = options.definition) === null || _2 === void 0 ? void 0 : _2.info) === null || _3 === void 0 ? void 0 : _3.contact) || ((_5 = (_4 = defaultOptions.definition) === null || _4 === void 0 ? void 0 : _4.info) === null || _5 === void 0 ? void 0 : _5.contact)
            } : {})) }, (((_6 = options.definition) === null || _6 === void 0 ? void 0 : _6.servers) || ((_7 = defaultOptions.definition) === null || _7 === void 0 ? void 0 : _7.servers) ? {
            servers: ((_8 = options.definition) === null || _8 === void 0 ? void 0 : _8.servers) || ((_9 = defaultOptions.definition) === null || _9 === void 0 ? void 0 : _9.servers)
        } : {})), (((_10 = options.definition) === null || _10 === void 0 ? void 0 : _10.components) || ((_11 = defaultOptions.definition) === null || _11 === void 0 ? void 0 : _11.components) ? {
            components: ((_12 = options.definition) === null || _12 === void 0 ? void 0 : _12.components) || ((_13 = defaultOptions.definition) === null || _13 === void 0 ? void 0 : _13.components)
        } : {})), (((_14 = options.definition) === null || _14 === void 0 ? void 0 : _14.security) || ((_15 = defaultOptions.definition) === null || _15 === void 0 ? void 0 : _15.security) ? {
            security: ((_16 = options.definition) === null || _16 === void 0 ? void 0 : _16.security) || ((_17 = defaultOptions.definition) === null || _17 === void 0 ? void 0 : _17.security)
        } : {})) });
    return (0, swagger_jsdoc_1.default)(mergedOptions);
};
exports.generateSwaggerSpec = generateSwaggerSpec;
/**
 * Set up Swagger UI for Express app
 * @param app - Express app
 * @param options - Swagger options
 * @param path - Path to serve Swagger UI (default: /api-docs)
 */
const setupSwagger = (app, options = {}, path = '/api-docs') => {
    const swaggerSpec = generateSwaggerSpec(options);
    // Serve Swagger UI
    app.use(path, swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
    }));
    // Serve Swagger specification as JSON
    app.get(`${path}.json`, (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
    console.log(`Swagger UI available at ${path}`);
};
exports.setupSwagger = setupSwagger;
/**
 * Creates service-specific Swagger configuration
 * @param serviceName Name of the service
 * @param serviceDescription Description of the service's purpose
 * @param port Port the service runs on
 * @param apiPaths Glob patterns for finding API documentation in code (default: controllers, routes, and models)
 * @returns Swagger configuration object
 */
const createServiceSwaggerConfig = (serviceName, serviceDescription, port, apiPaths = ['./src/routes/**/*.ts', './src/controllers/**/*.ts', './src/models/**/*.ts', './src/entities/**/*.ts']) => {
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
exports.createServiceSwaggerConfig = createServiceSwaggerConfig;
