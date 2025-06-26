/**
 * App Entity
 * Represents an application that has subscription plans
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index
} from 'typeorm';
import { SubscriptionPlan } from './SubscriptionPlan.entity';

@Entity('app')
export class App {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  @Index('IDX_APP_NAME')
  name!: string;

  @Column({ type: 'varchar' })
  description!: string;

  @Column({ type: 'varchar' })
  owner!: string;

  @Column({ type: 'varchar' })
  logo!: string;

  @Column({ type: 'varchar' })
  website!: string;

  @Column({ 
    type: 'varchar', 
    length: 7,
    default: '#000000',
    nullable: false
  })
  color!: string;

  @Column({ type: 'int', default: 0 })
  totalPlans!: number;

  // Use type function reference to avoid circular dependency issues
  @OneToMany(() => SubscriptionPlan, (plan) => plan.app, { cascade: true })
  plans!: SubscriptionPlan[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
