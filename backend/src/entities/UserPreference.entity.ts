/**
 * UserPreference Entity
 * Represents user preferences and settings
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { User } from './User.entity';

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

export enum NotificationType {
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'in_app'
}

@Entity('user_preference')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, user => user.preferences)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', default: Theme.SYSTEM })
  theme: Theme;

  @Column({ default: 'en' })
  language: string;

  @Column({ default: true })
  emailNotifications: boolean;

  @Column({ default: true })
  pushNotifications: boolean;

  @Column({ default: true })
  inAppNotifications: boolean;

  @Column({ type: 'jsonb', nullable: true })
  notificationSettings: {
    [key: string]: {
      email?: boolean;
      push?: boolean;
      inApp?: boolean;
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  dashboardLayout: any;

  @Column({ type: 'jsonb', nullable: true })
  customSettings: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
