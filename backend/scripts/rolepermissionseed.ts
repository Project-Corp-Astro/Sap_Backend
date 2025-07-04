// scripts/seedRolePermissions.ts
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });

// Define the role permission interface matching your model
interface IRolePermission {
  role: string;
  application: string;
  permissions: string[];
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Sample roles and permissions
const rolePermissions: IRolePermission[] = [
  // Super Admin - Full access across all applications
  {
    role: 'super_admin',
    application: '*',
    permissions: ['*:*'],
    version: 1
  },
  // Admin - Limited access (no user deletion, no billing changes)
  {
    role: 'admin',
    application: 'system',
    permissions: [
      'user:create',
      'user:read',
      'user:update',
      'user:status:update',
      'role:assign',
      'settings:read',
      'settings:update',
      'content:manage',
      'reports:view'
    ],
    version: 1
  },
  // Subscription Manager
  {
    role: 'subscription_manager',
    application: 'billing',
    permissions: [
      'subscription:create',
      'subscription:read',
      'subscription:update',
      'subscription:cancel',
      'subscription:upgrade',
      'subscription:downgrade',
      'invoice:view',
      'payment:process',
      'analytics:view'
    ],
    version: 1
  },
  {
    role: 'subscription_analytics',
    application: 'billing',
    permissions: [
      'analytics:view',
      'invoice:view',
      'payment:process',
      'analytics:view'
    ],
    version: 1
  },
  // Content Manager
  {
    role: 'content_manager',
    application: 'cms',
    permissions: [
      'content:create',
      'content:read',
      'content:update',
      'content:delete',
      'media:upload',
      'media:manage'
    ],
    version: 1
  },
  // Support Agent
  {
    role: 'support_agent',
    application: 'support',
    permissions: [
      'ticket:create',
      'ticket:read',
      'ticket:update',
      'ticket:resolve',
      'user:read:limited'
    ],
    version: 1
  },
  {
    role: "user",
    application: "*",
    permissions: [
      "profile:read",
      "profile:update",
      "dashboard:view",
      "notifications:view",
      "settings:update"
    ],
    version: 1
  }
];

async function seedRolePermissions() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sap-db';
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const collection = db.collection('rolepermissions');

    // Delete all existing roles
    const deleteResult = await collection.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing role permissions`);

    // Add timestamps to each role
    const timestamp = new Date();
    const rolesWithTimestamps = rolePermissions.map(role => ({
      ...role,
      createdAt: timestamp,
      updatedAt: timestamp
    }));

    // Insert the new roles
    const result = await collection.insertMany(rolesWithTimestamps);
    console.log(`Successfully seeded ${result.insertedCount} role permissions`);

    // Display the inserted roles
    const count = await collection.countDocuments();
    console.log(`Total role permissions in database: ${count}`);

    // Display the list of created roles
    const roles = await collection.find({}, { projection: { role: 1, application: 1, _id: 0 } }).toArray();
    console.log('\nCreated roles:');
    console.table(roles);

  } catch (error) {
    console.error('Error seeding role permissions:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the seed function
seedRolePermissions()
  .then(() => console.log('\nSeeding completed successfully'))
  .catch(console.error);