/**
 * Initial Database Schema Migration
 * Creates the initial database schema for PostgreSQL
 */

import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class InitialSchema1620000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the uuid-ossp extension if it doesn't exist
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Create permission table
    await queryRunner.createTable(
      new Table({
        name: 'permission',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'description',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'isSystem',
            type: 'boolean',
            default: false,
          },
          {
            name: 'resource',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'action',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Create index on permission name
    await queryRunner.createIndex(
      'permission',
      new TableIndex({
        name: 'IDX_PERMISSION_NAME',
        columnNames: ['name'],
      })
    );

    // Create role table
    await queryRunner.createTable(
      new Table({
        name: 'role',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'description',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'isDefault',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isSystem',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Create index on role name
    await queryRunner.createIndex(
      'role',
      new TableIndex({
        name: 'IDX_ROLE_NAME',
        columnNames: ['name'],
      })
    );

    // Create role_permission junction table
    await queryRunner.createTable(
      new Table({
        name: 'role_permission',
        columns: [
          {
            name: 'roleId',
            type: 'uuid',
          },
          {
            name: 'permissionId',
            type: 'uuid',
          },
        ],
        primaryColumns: ['roleId', 'permissionId'],
      }),
      true
    );

    // Add foreign keys to role_permission table
    await queryRunner.createForeignKey(
      'role_permission',
      new TableForeignKey({
        name: 'FK_ROLE_PERMISSION_ROLE',
        columnNames: ['roleId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'role',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'role_permission',
      new TableForeignKey({
        name: 'FK_ROLE_PERMISSION_PERMISSION',
        columnNames: ['permissionId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'permission',
        onDelete: 'CASCADE',
      })
    );

    // Create user table
    await queryRunner.createTable(
      new Table({
        name: 'user',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'email',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'passwordHash',
            type: 'varchar',
          },
          {
            name: 'firstName',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'lastName',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'isVerified',
            type: 'boolean',
            default: false,
          },
          {
            name: 'verificationToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'resetPasswordToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'resetPasswordExpires',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'isMfaEnabled',
            type: 'boolean',
            default: false,
          },
          {
            name: 'mfaSecret',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'lastLogin',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'loginAttempts',
            type: 'integer',
            default: 0,
          },
          {
            name: 'lockUntil',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'roleId',
            type: 'uuid',
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'deactivatedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'avatar',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'bio',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Create indexes on user table
    await queryRunner.createIndex(
      'user',
      new TableIndex({
        name: 'IDX_USER_EMAIL',
        columnNames: ['email'],
      })
    );

    await queryRunner.createIndex(
      'user',
      new TableIndex({
        name: 'IDX_USER_ROLE',
        columnNames: ['roleId'],
      })
    );

    // Add foreign key to user table
    await queryRunner.createForeignKey(
      'user',
      new TableForeignKey({
        name: 'FK_USER_ROLE',
        columnNames: ['roleId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'role',
        onDelete: 'RESTRICT',
      })
    );

    // Create user_session table
    await queryRunner.createTable(
      new Table({
        name: 'user_session',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'token',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'isRevoked',
            type: 'boolean',
            default: false,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deviceId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'deviceName',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'deviceType',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'browser',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'operatingSystem',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'location',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'isTrusted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'lastUsedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Create indexes on user_session table
    await queryRunner.createIndex(
      'user_session',
      new TableIndex({
        name: 'IDX_USER_SESSION_TOKEN',
        columnNames: ['token'],
      })
    );

    await queryRunner.createIndex(
      'user_session',
      new TableIndex({
        name: 'IDX_USER_SESSION_USER',
        columnNames: ['userId'],
      })
    );

    // Add foreign key to user_session table
    await queryRunner.createForeignKey(
      'user_session',
      new TableForeignKey({
        name: 'FK_USER_SESSION_USER',
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      })
    );

    // Create user_preference table
    await queryRunner.createTable(
      new Table({
        name: 'user_preference',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'theme',
            type: 'varchar',
            default: "'system'",
          },
          {
            name: 'language',
            type: 'varchar',
            default: "'en'",
          },
          {
            name: 'emailNotifications',
            type: 'boolean',
            default: true,
          },
          {
            name: 'pushNotifications',
            type: 'boolean',
            default: true,
          },
          {
            name: 'inAppNotifications',
            type: 'boolean',
            default: true,
          },
          {
            name: 'notificationSettings',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'dashboardLayout',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'customSettings',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Create index on user_preference table
    await queryRunner.createIndex(
      'user_preference',
      new TableIndex({
        name: 'IDX_USER_PREFERENCE_USER',
        columnNames: ['userId'],
      })
    );

    // Add foreign key to user_preference table
    await queryRunner.createForeignKey(
      'user_preference',
      new TableForeignKey({
        name: 'FK_USER_PREFERENCE_USER',
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('user_preference', 'FK_USER_PREFERENCE_USER');
    await queryRunner.dropForeignKey('user_session', 'FK_USER_SESSION_USER');
    await queryRunner.dropForeignKey('user', 'FK_USER_ROLE');
    await queryRunner.dropForeignKey('role_permission', 'FK_ROLE_PERMISSION_PERMISSION');
    await queryRunner.dropForeignKey('role_permission', 'FK_ROLE_PERMISSION_ROLE');

    // Drop tables
    await queryRunner.dropTable('user_preference');
    await queryRunner.dropTable('user_session');
    await queryRunner.dropTable('user');
    await queryRunner.dropTable('role_permission');
    await queryRunner.dropTable('role');
    await queryRunner.dropTable('permission');
  }
}
