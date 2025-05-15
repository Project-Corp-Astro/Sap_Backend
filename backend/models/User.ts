import { UserDocument, IUser, UserRole } from '../shared/interfaces/user.interface';

// Simple in-memory user storage for demonstration
interface User extends IUser {
  _id: string;
  password: string;
}

const users: User[] = [
  { 
    _id: "1", 
    username: "admin", 
    email: "admin@example.com", 
    password: "password123", 
    role: UserRole.ADMIN,
    firstName: "Admin",
    lastName: "User",
    isActive: true,
    preferences: {
      theme: 'light' as any,
      notifications: {
        email: true,
        push: false
      }
    }
  }
];

/**
 * Find a user by email
 * @param email - User's email address
 * @returns User object or null if not found
 */
const findByEmail = (email: string): User | null => 
  users.find(u => u.email === email) || null;

/**
 * Find a user by ID
 * @param id - User's ID
 * @returns User object or null if not found
 */
const findById = (id: string): User | null => 
  users.find(u => u._id === id) || null;

/**
 * Get all users (without passwords)
 * @returns Array of users without passwords
 */
const getAll = (): Omit<User, 'password'>[] => 
  users.map(({ password, ...user }) => user);

/**
 * Create a new user
 * @param user - User object to create
 * @returns Created user without password
 */
const create = (user: Omit<User, '_id'>): Omit<User, 'password'> => {
  // Ensure user has required fields
  if (!user.username || !user.email || !user.password || !user.firstName || !user.lastName) {
    throw new Error('User must have username, email, password, firstName, and lastName');
  }
  
  // Set default values for required fields if not provided
  const userWithDefaults = {
    ...user,
    role: user.role || UserRole.USER,
    isActive: user.isActive !== undefined ? user.isActive : true,
    preferences: user.preferences || {
      theme: 'system' as any,
      notifications: {
        email: true,
        push: false
      }
    }
  };
  
  const newUser = { ...userWithDefaults, _id: String(users.length + 1) };
  users.push(newUser as User);
  const { password, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};

/**
 * Update a user
 * @param id - User's ID
 * @param updates - Object with fields to update
 * @returns Updated user without password or null if not found
 */
const update = (id: string, updates: Partial<User>): Omit<User, 'password'> | null => {
  const index = users.findIndex(user => user._id === id);
  if (index !== -1) {
    users[index] = { ...users[index], ...updates };
    const { password, ...userWithoutPassword } = users[index];
    return userWithoutPassword;
  }
  return null;
};

/**
 * Delete a user
 * @param id - User's ID
 * @returns Deleted user without password or null if not found
 */
const delete_ = (id: string): Omit<User, 'password'> | null => {
  const index = users.findIndex(user => user._id === id);
  if (index !== -1) {
    const { password, ...userWithoutPassword } = users[index];
    users.splice(index, 1);
    return userWithoutPassword;
  }
  return null;
};

export {
  findByEmail,
  findById,
  getAll,
  create,
  update,
  delete_ as delete
};
