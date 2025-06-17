# Redis Key Documentation

## Redis Database Structure

Each service uses its own Redis logical database:
- DB 0: API Gateway & Legacy Data
- DB 1: Auth Service (Sessions, OTPs)
- DB 2: User Service (Users, Permissions, Roles)
- DB 3: Content Service
- DB 4: Subscription Service
- DB 5: Notification Service
- DB 6: Payment Service
- DB 7: Monitoring Service
- DB 8: Analytics Service

All keys follow this pattern: `sap:<service>:<purpose>:<identifier>`

## Auth Service (DB 1)

### OTP Keys
```bash
# Connect to Auth DB
SELECT 1

# View all OTP keys
KEYS sap:auth:otp:*

# Check specific OTP
GET sap:auth:otp:password_reset:<userId>
GET sap:auth:otp:direct:<userId>

# Get TTL for OTP
TTL sap:auth:otp:password_reset:<userId>

# Delete OTP
DEL sap:auth:otp:password_reset:<userId>
```

### Session Keys
```bash
# View all session keys
KEYS sap:auth:session:*

# Check specific session
GET sap:auth:session:<session_id>

# Delete session
DEL sap:auth:session:<session_id>
```

## User Service (DB 2)

### User Data
```bash
# Connect to User DB
SELECT 2

# View all user keys
KEYS sap:user:user:*

# Get specific user data
GET sap:user:user:<userId>

# Get user permissions
GET sap:user:permission:<userId>

# Get user roles
GET sap:user:role:<userId>
```

### User Activity
```bash
# Get user activity
KEYS sap:user:activity:<userId>:*

# Get recent activities
ZRANGE sap:user:activity:<userId> 0 -1
```

### User Devices
```bash
# Get user devices
KEYS sap:user:device:<userId>:*

# Get specific device
GET sap:user:device:<userId>:<deviceId>
```

## Subscription Service (DB 3)

### Subscription Plans
```bash
# Connect to Subscription DB
SELECT 3

# View all plans
KEYS sap:subscription:plans:*

# Get specific plan
GET sap:subscription:plans:<planId>
```

### User Subscriptions
```bash
# Get user subscriptions
KEYS sap:subscription:user-subscriptions:<userId>:*

# Get specific subscription
GET sap:subscription:user-subscriptions:<userId>:<subscriptionId>
```

## Content Service (DB 4)

### Content Cache
```bash
# Connect to Content DB
SELECT 4

# View all content keys
KEYS sap:content:*

# Get specific content
GET sap:content:<contentId>
```

## Common Redis Commands

```bash
# Select specific database
SELECT <db_number>

# View all keys in current DB
KEYS *

# View keys matching pattern
KEYS <pattern>*

# Get value of key
GET <key>

# Get Time To Live (seconds)
TTL <key>

# Delete key
DEL <key>

# Clear all keys in current DB
FLUSHDB

# Clear all keys in all DBs
FLUSHALL

# Get Redis server info
INFO

# Get specific Redis info
INFO keyspace
INFO memory
INFO persistence
```

## Key Management Best Practices

1. **Key Naming Conventions**
   - Use consistent prefixes: `sap:<service>:<purpose>:<identifier>`
   - Include service name in all keys
   - Use descriptive purpose prefixes
   - Use clear identifiers

2. **Database Isolation**
   - Each service uses its own Redis DB
   - Prevents key collisions
   - Improves performance
   - Easier to manage and debug

3. **TTL Management**
   - Set appropriate TTLs for all cache keys
   - OTPs: 300 seconds (5 minutes)
   - Sessions: configurable via settings
   - User data: configurable via settings

4. **Monitoring**
   - Use Redis INFO commands to monitor:
     - Memory usage
     - Connection counts
     - Command statistics
     - Key space statistics

5. **Security**
   - Never store sensitive data without encryption
   - Use Redis AUTH for authentication
   - Consider Redis ACL for fine-grained access control

6. **Backup**
   - Configure RDB/AOF persistence
   - Regularly backup Redis data
   - Test restore procedures

7. **Performance**
   - Use Redis Cluster for high availability
   - Monitor slow commands
   - Use Redis Monitor for real-time monitoring
   - Implement connection pooling

## Troubleshooting Commands

```bash
# Check Redis server health
INFO server

# Monitor Redis commands
MONITOR

# Check memory usage
INFO memory

# Check key space statistics
INFO keyspace

# Check slow commands
SLOWLOG GET

# Check Redis configuration
CONFIG GET *

# Check Redis replication status
INFO replication

# Check Redis persistence status
INFO persistence
```
