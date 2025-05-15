/**
 * Role Entity
 * Represents a user role with associated permissions
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index
} from 'typeorm';
import { User } from './User.entity';
import { Permission } from './Permission.entity';

@Entity('role')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index()
  name!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ default: false })
  isDefault!: boolean;

  @Column({ default: false })
  isSystem!: boolean;

  @OneToMany(() => User, user => user.role)
  users!: User[];

  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'role_permission',
    joinColumn: {
      name: 'roleId',
      referencedColumnName: 'id'
    },
    inverseJoinColumn: {
      name: 'permissionId',
      referencedColumnName: 'id'
    }
  })
  permissions!: Permission[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
