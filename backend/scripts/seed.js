/**
 * Database Seeding Script
 * Populates the database with test data
 */

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcryptjs');
const { createServiceLogger } = require('../shared/utils/logger');
const config = require('../shared/config');

// Initialize logger
const logger = createServiceLogger('database-seed');

// User model schema
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  profileImage: {
    type: String
  },
  roles: {
    type: [String],
    default: ['user']
  },
  permissions: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockUntil: {
    type: Date
  },
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  mfaSecret: {
    type: String
  },
  mfaRecoveryCodes: {
    type: [String]
  },
  oauth: {
    google: {
      id: String,
      token: String
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Content model schema
const ContentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['news', 'blog', 'tutorial', 'announcement', 'documentation']
  },
  tags: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: {
    type: Date
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  comments: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Seed database with test data
 */
async function seedDatabase() {
  try {
    // Connect to MongoDB
    const mongoUri = config.get('mongo.uri', 'mongodb://localhost:27017/sap-db');
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Create models
    const User = mongoose.model('User', UserSchema);
    const Content = mongoose.model('Content', ContentSchema);

    // Check if database already has data
    const userCount = await User.countDocuments();
    const contentCount = await Content.countDocuments();

    if (userCount > 0 || contentCount > 0) {
      logger.info('Database already has data. Use --force to override.');
      
      // Check if --force flag is provided
      if (!process.argv.includes('--force')) {
        logger.info('Exiting without seeding.');
        return;
      }
      
      // Clear existing data
      logger.info('Clearing existing data...');
      await User.deleteMany({});
      await Content.deleteMany({});
    }

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      email: 'admin@example.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      roles: ['admin', 'user'],
      permissions: ['manage_users', 'manage_content', 'manage_settings'],
      isActive: true,
      emailVerified: true
    });
    
    logger.info('Created admin user');

    // Create test users
    const users = [];
    users.push(admin);

    for (let i = 0; i < 50; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet.email({ firstName, lastName }).toLowerCase();
      const password = await bcrypt.hash('password123', 10);
      
      const user = await User.create({
        email,
        password,
        firstName,
        lastName,
        profileImage: faker.image.avatar(),
        roles: ['user'],
        permissions: [],
        isActive: faker.datatype.boolean(0.9), // 90% active
        emailVerified: faker.datatype.boolean(0.8) // 80% verified
      });
      
      users.push(user);
    }
    
    logger.info(`Created ${users.length} users`);

    // Create content
    const categories = ['news', 'blog', 'tutorial', 'announcement', 'documentation'];
    const statuses = ['draft', 'published', 'archived'];
    const statusWeights = [0.2, 0.7, 0.1]; // 20% draft, 70% published, 10% archived
    
    const contents = [];
    
    for (let i = 0; i < 200; i++) {
      const author = users[Math.floor(Math.random() * users.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      // Weighted random status
      let statusIndex = 0;
      const random = Math.random();
      let cumulativeWeight = 0;
      
      for (let j = 0; j < statusWeights.length; j++) {
        cumulativeWeight += statusWeights[j];
        if (random < cumulativeWeight) {
          statusIndex = j;
          break;
        }
      }
      
      const status = statuses[statusIndex];
      
      // Generate random date within last year
      const createdAt = faker.date.past({ years: 1 });
      let publishedAt = null;
      
      if (status === 'published') {
        // Published date is after created date
        publishedAt = new Date(createdAt);
        publishedAt.setDate(publishedAt.getDate() + Math.floor(Math.random() * 7)); // 0-7 days after creation
      }
      
      // Generate random metrics based on age and status
      let views = 0;
      let likes = 0;
      let shares = 0;
      let comments = 0;
      
      if (status === 'published') {
        const ageInDays = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
        const popularityFactor = Math.random() * 10; // 0-10 popularity factor
        
        views = Math.floor(ageInDays * popularityFactor * 10); // 0-100 views per day
        likes = Math.floor(views * (Math.random() * 0.2)); // 0-20% of views are likes
        shares = Math.floor(views * (Math.random() * 0.05)); // 0-5% of views are shares
        comments = Math.floor(views * (Math.random() * 0.1)); // 0-10% of views are comments
      }
      
      const content = await Content.create({
        title: faker.lorem.sentence({ min: 4, max: 10 }),
        description: faker.lorem.paragraph(),
        content: faker.lorem.paragraphs(10),
        author: author._id,
        category,
        tags: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => faker.word.sample()),
        status,
        publishedAt,
        views,
        likes,
        shares,
        comments,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime()))
      });
      
      contents.push(content);
    }
    
    logger.info(`Created ${contents.length} content items`);
    logger.info('Database seeding completed successfully');
  } catch (err) {
    logger.error('Seeding error', { error: err.message });
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    logger.info('Closed MongoDB connection');
  }
}

// Run seeding
seedDatabase();
