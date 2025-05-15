/**
 * Database Migration Script
 * Handles database schema migrations
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { createServiceLogger } = require('../shared/utils/logger');
const config = require('../shared/config');

// Initialize logger
const logger = createServiceLogger('database-migration');

// Migration model schema
const MigrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  appliedAt: {
    type: Date,
    default: Date.now
  }
});

// Migration directories
const MIGRATION_DIRS = [
  path.join(__dirname, '../services/auth-service/src/migrations'),
  path.join(__dirname, '../services/user-service/src/migrations'),
  path.join(__dirname, '../services/content-service/src/migrations'),
  path.join(__dirname, '../services/monitoring-service/src/migrations'),
  path.join(__dirname, '../services/notification-service/src/migrations')
];

/**
 * Run migrations
 */
async function runMigrations() {
  try {
    // Connect to MongoDB
    const mongoUri = config.get('mongo.uri', 'mongodb://localhost:27017/sap-db');
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Create Migration model
    const Migration = mongoose.model('Migration', MigrationSchema);

    // Get applied migrations
    const appliedMigrations = await Migration.find().sort({ name: 1 });
    const appliedMigrationNames = appliedMigrations.map(m => m.name);

    logger.info(`Found ${appliedMigrations.length} applied migrations`);

    // Get all migration files
    const migrationFiles = [];
    
    for (const dir of MIGRATION_DIRS) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir)
          .filter(file => file.endsWith('.js'))
          .map(file => ({
            name: file,
            path: path.join(dir, file)
          }));
        
        migrationFiles.push(...files);
      }
    }
    
    // Sort migration files by name
    migrationFiles.sort((a, b) => a.name.localeCompare(b.name));
    
    logger.info(`Found ${migrationFiles.length} migration files`);

    // Filter out already applied migrations
    const pendingMigrations = migrationFiles.filter(
      file => !appliedMigrationNames.includes(file.name)
    );
    
    logger.info(`Found ${pendingMigrations.length} pending migrations`);

    // Apply pending migrations
    for (const migration of pendingMigrations) {
      try {
        logger.info(`Applying migration: ${migration.name}`);
        
        // Import migration file
        const migrationModule = require(migration.path);
        
        // Run up function
        if (typeof migrationModule.up === 'function') {
          await migrationModule.up();
          
          // Record migration
          await Migration.create({ name: migration.name });
          
          logger.info(`Successfully applied migration: ${migration.name}`);
        } else {
          logger.warn(`Migration ${migration.name} has no up function, skipping`);
        }
      } catch (err) {
        logger.error(`Error applying migration ${migration.name}`, { error: err.message });
        throw err;
      }
    }

    logger.info('All migrations applied successfully');
  } catch (err) {
    logger.error('Migration error', { error: err.message });
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    logger.info('Closed MongoDB connection');
  }
}

/**
 * Rollback last migration
 */
async function rollbackLastMigration() {
  try {
    // Connect to MongoDB
    const mongoUri = config.get('mongo.uri', 'mongodb://localhost:27017/sap-db');
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Create Migration model
    const Migration = mongoose.model('Migration', MigrationSchema);

    // Get last applied migration
    const lastMigration = await Migration.findOne().sort({ appliedAt: -1 });
    
    if (!lastMigration) {
      logger.info('No migrations to rollback');
      return;
    }
    
    logger.info(`Rolling back migration: ${lastMigration.name}`);

    // Find migration file
    let migrationPath = null;
    
    for (const dir of MIGRATION_DIRS) {
      const filePath = path.join(dir, lastMigration.name);
      
      if (fs.existsSync(filePath)) {
        migrationPath = filePath;
        break;
      }
    }
    
    if (!migrationPath) {
      logger.error(`Migration file not found: ${lastMigration.name}`);
      throw new Error(`Migration file not found: ${lastMigration.name}`);
    }

    // Import migration file
    const migrationModule = require(migrationPath);
    
    // Run down function
    if (typeof migrationModule.down === 'function') {
      await migrationModule.down();
      
      // Remove migration record
      await Migration.deleteOne({ _id: lastMigration._id });
      
      logger.info(`Successfully rolled back migration: ${lastMigration.name}`);
    } else {
      logger.warn(`Migration ${lastMigration.name} has no down function, cannot rollback`);
    }
  } catch (err) {
    logger.error('Rollback error', { error: err.message });
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    logger.info('Closed MongoDB connection');
  }
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.includes('--rollback')) {
  rollbackLastMigration();
} else {
  runMigrations();
}
