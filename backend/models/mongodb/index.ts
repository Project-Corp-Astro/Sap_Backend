/**
 * MongoDB Models Registry
 * 
 * This file imports and registers all MongoDB models to ensure they're
 * available throughout the application before they're used.
 */

// Import all models
import UserModel from './User.model';
import ContentModel from './Content.model';

// Export models for use in the application
export {
  UserModel,
  ContentModel
};

// Export a function to register all models
export const registerModels = () => {
  // Models are registered when they're imported, but we can add
  // additional initialization logic here if needed in the future
  console.log('MongoDB models registered successfully');
};

export default {
  User: UserModel,
  Content: ContentModel,
  registerModels
};
