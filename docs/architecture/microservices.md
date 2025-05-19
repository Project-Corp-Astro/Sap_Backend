# Microservices Architecture

This document details the microservices architecture used in the Corp Astro Super Admin Panel (SAP) backend.

## Microservices Approach

The Corp Astro SAP uses a microservices architecture to achieve:

- **Scalability**: Services can be scaled independently based on demand
- **Resilience**: Failure in one service doesn't bring down the entire system
- **Maintainability**: Services can be developed, tested, and deployed independently
- **Technology Flexibility**: Different services can use different technologies as needed

## Service Boundaries

Services are divided along business domain boundaries, following Domain-Driven Design principles. Each service:

- Has its own database or database schema
- Exposes a well-defined API
- Is independently deployable
- Has a single responsibility

## Core Services

### API Gateway

The API Gateway serves as the entry point for all client requests, providing:

- Request routing to appropriate services
- Authentication and authorization
- Request/response transformation
- Rate limiting and throttling
- Request logging
- API documentation (Swagger/OpenAPI)

```mermaid
graph LR
    Client[Client Applications] -->|HTTP Requests| Gateway[API Gateway]
    Gateway -->|Routes Requests| Services[Microservices]
```

### Auth Service

The Auth Service handles all authentication and authorization concerns:

- User registration and login
- JWT token generation and validation
- OAuth provider integration
- Multi-factor authentication
- Password reset functionality
- Role-based access control

### User Service

The User Service manages user-related functionality:

- User profile management
- User preferences
- User activity tracking
- User relationships and connections
- User notifications

### Content Service

The Content Service handles content management:

- Content creation and editing
- Content categorization and tagging
- Content publishing and scheduling
- Content search and discovery
- Media management (images, videos)

### Astro Engine Service

The Astro Engine Service provides astrological calculations:

- Chart generation using Swiss Ephemeris
- Planetary positions and aspects
- Dashas and transits
- Compatibility calculations
- Astrological predictions

### Astro Ratan AI Service

The Astro Ratan AI Service provides AI-powered interpretations:

- Natural language processing of user queries
- Astrological interpretation generation
- Personalized recommendations
- Learning from user feedback
- Integration with astrological calculations

## Service Communication

Services communicate with each other through:

### Synchronous Communication (REST/GraphQL)

Used for request/response patterns where an immediate response is needed:

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as API Gateway
    participant Service1 as Service A
    participant Service2 as Service B
    
    Client->>Gateway: Request
    Gateway->>Service1: Forward Request
    Service1->>Service2: API Call
    Service2-->>Service1: Response
    Service1-->>Gateway: Response
    Gateway-->>Client: Response
```

### Asynchronous Communication (Event-Driven)

Used for notifications and eventual consistency:

```mermaid
sequenceDiagram
    participant Service1 as Service A
    participant MessageBroker as RabbitMQ
    participant Service2 as Service B
    participant Service3 as Service C
    
    Service1->>MessageBroker: Publish Event
    MessageBroker->>Service2: Consume Event
    MessageBroker->>Service3: Consume Event
    Service2-->>Service1: Acknowledge (Optional)
```

## Service Discovery and Load Balancing

Services register themselves with a service registry (Consul/etcd) and are discovered dynamically:

```mermaid
graph TD
    Service1[Service A] -->|Register| Registry[Service Registry]
    Service2[Service B] -->|Register| Registry
    Service3[Service C] -->|Register| Registry
    
    Client -->|Lookup| Registry
    Client -->|Request| Service1
    Client -->|Request| Service2
    Client -->|Request| Service3
```

## Deployment Model

Each service is deployed as a Docker container, orchestrated with Kubernetes:

```mermaid
graph TD
    subgraph Kubernetes Cluster
        subgraph API Gateway Pod
            Gateway[API Gateway]
        end
        
        subgraph Auth Service Pods
            Auth1[Auth Instance 1]
            Auth2[Auth Instance 2]
        end
        
        subgraph User Service Pods
            User1[User Instance 1]
            User2[User Instance 2]
        end
        
        subgraph Content Service Pods
            Content1[Content Instance 1]
            Content2[Content Instance 2]
        end
    end
    
    Gateway -->|Routes to| Auth1
    Gateway -->|Routes to| Auth2
    Gateway -->|Routes to| User1
    Gateway -->|Routes to| User2
    Gateway -->|Routes to| Content1
    Gateway -->|Routes to| Content2
```

## Service Template

Each microservice follows a common structure:

```
service-name/
├── src/
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── models/          # Data models
│   ├── repositories/    # Data access
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utility functions
│   ├── config/          # Configuration
│   ├── routes/          # API routes
│   └── app.ts           # Application setup
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── e2e/             # End-to-end tests
├── Dockerfile           # Container definition
├── package.json         # Dependencies
└── tsconfig.json        # TypeScript config
```

## Monitoring and Observability

Each service implements:

- Health check endpoints
- Metrics collection (Prometheus)
- Distributed tracing (Jaeger)
- Structured logging (ELK Stack)
- Error reporting

## Resilience Patterns

Services implement resilience patterns such as:

- Circuit breakers
- Retry with exponential backoff
- Rate limiting
- Bulkheads
- Timeouts
- Fallbacks

For more detailed information about specific services, please refer to their individual documentation.
