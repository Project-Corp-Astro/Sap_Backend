// scripts/seedUsers.ts
import { MongoClient, ObjectId } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';
import * as bcrypt from 'bcryptjs';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });

// User interface matching the schema
interface IUser {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  avatar: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin: Date;
  roles: ObjectId[];
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email: boolean;
      push: boolean;
    };
    language: string;
    timezone: string;
  };
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  devices?: Array<{
    deviceId: string;
    deviceName: string;
    deviceType: string;
    os?: string;
    browser?: string;
    ipAddress?: string;
    lastUsed: Date;
    isTrusted: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to generate random date within last 30 days
const randomDate = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Base user template with all fields
const baseUser = (role: string, index: number) => {
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin' || isSuperAdmin;
  const roleName = role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  
  return {
    username: `${role}${index}`,
    email: `${role}${index}@example.com`,
    password: `${role.charAt(0).toUpperCase() + role.slice(1)}@123`,
    firstName: roleName,
    lastName: `User ${index}`,
    phoneNumber: `+1${5550000000 + (index * 100) + (role.charCodeAt(0) % 100)}`,
    avatar: `https://ui-avatars.com/api/?name=${roleName}+User+${index}&background=random`,
    isActive: true,
    isEmailVerified: true,
    lastLogin: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
    preferences: {
      theme: isSuperAdmin ? 'dark' : isAdmin ? 'system' : 'light',
      notifications: {
        email: true,
        push: isAdmin
      },
      language: 'en',
      timezone: isSuperAdmin ? 'UTC' : 'America/New_York'
    },
    ...(isAdmin && {
      address: {
        street: `${index} ${roleName} St`,
        city: 'Metropolis',
        state: 'NY',
        postalCode: '10001',
        country: 'USA'
      }
    }),
    ...(isSuperAdmin && {
      devices: [{
        deviceId: `dev-${role}-${index}`,
        deviceName: `${roleName} Device ${index}`,
        deviceType: 'desktop',
        os: 'Windows 11',
        browser: 'Chrome',
        ipAddress: `192.168.1.${100 + index}`,
        lastUsed: new Date(),
        isTrusted: true
      }]
    }),
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

// Role to users mapping - each role will have exactly 2 users
const roleToUsersMap = {
  'super_admin': [1, 2].map(i => baseUser('super_admin', i)),
  'admin': [1, 2].map(i => baseUser('admin', i)),
  'subscription_manager': [1, 2].map(i => baseUser('subscription_manager', i)),
  'subscription_analytics': [1, 2].map(i => baseUser('subscription_analytics', i)),
  'content_manager': [1, 2].map(i => baseUser('content_manager', i)),
  'support_agent': [1, 2].map(i => baseUser('support_agent', i)),
  'user': [1, 2].map(i => baseUser('user', i))
};

// Flatten the users and prepare for seeding
const usersToSeed = Object.entries(roleToUsersMap).flatMap(([role, userList]) => 
  userList.map(user => ({
    ...user,
    role  // Store the role name for later assignment
  }))
);

async function seedUsers() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sap-db';
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const usersCollection = db.collection('users');
    const rolesCollection = db.collection('rolepermissions');

    // 1. Delete all existing users
    const deleteResult = await usersCollection.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing users`);

    // 2. Get all role permissions
    const allRoles = await rolesCollection.find({}).toArray();
    if (allRoles.length === 0) {
      throw new Error('No roles found. Please seed roles first.');
    }

    // Create a map of role names to their IDs
    const roleMap = new Map(
      allRoles.map(role => [role.role, role._id])
    );

    // 3. Process each user
    const hashedUsers = await Promise.all(
      usersToSeed.map(async (user) => {
        const roleId = roleMap.get(user.role);
        if (!roleId) {
          console.warn(`Role ${user.role} not found for user ${user.username}`);
          return null;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(user.password, salt);

        // Remove the role property before saving
        const { role, ...userData } = user;

        return {
          ...userData,
          password: hashedPassword,
          roles: [roleId],
          createdAt: new Date(),
          updatedAt: new Date()
        };
      })
    );

    // Filter out any null entries (from invalid roles)
    const validUsers = hashedUsers.filter(Boolean) as any[];

    // 4. Insert users
    const result = await usersCollection.insertMany(validUsers);
    console.log(`Successfully seeded ${result.insertedCount} users`);

    // 5. Display created users with their roles
    console.log('\nCreated users:');
    const createdUsers = await usersCollection.aggregate([
      { $match: { _id: { $in: validUsers.map(u => u._id) } } },
      {
        $lookup: {
          from: 'rolepermissions',
          localField: 'roles',
          foreignField: '_id',
          as: 'roleDetails'
        }
      },
      {
        $project: {
          _id: 1,
          username: 1,
          email: 1,
          firstName: 1,
          lastName: 1,
          phoneNumber: 1,
          roles: '$roleDetails.role'
        }
      }
    ]).toArray();

    console.table(createdUsers.map(u => ({
      _id: u._id,
      username: u.username,
      email: u.email,
      name: `${u.firstName} ${u.lastName}`,
      phone: u.phoneNumber,
      roles: u.roles.join(', ')
    })));

  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the seed function
seedUsers()
  .then(() => console.log('\nUser seeding completed successfully'))
  .catch(console.error);