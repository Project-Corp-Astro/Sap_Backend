/**
 * ESM-to-CommonJS Bridge for @sap/logger
 * 
 * This file uses dynamic import() to properly load the ES Module logger
 * and exports it in a way that's compatible with CommonJS.
 * 
 * This avoids the experimental warning when importing ES modules in CommonJS.
 */

// Use dynamic import for ES modules
const importESModule = async () => {
  try {
    // Dynamic import returns a Promise that resolves to the module
    const sapLogger = await import('@sap/logger');
    return sapLogger.default || sapLogger;
  } catch (error) {
    console.error('Failed to import @sap/logger:', error);
    throw error;
  }
};

// Initialize the logger module
let loggerModule = null;
let initPromise = null;

// Function to initialize the logger
const initialize = async () => {
  if (!initPromise) {
    initPromise = importESModule().then(module => {
      loggerModule = module;
      return module;
    });
  }
  return initPromise;
};

// Start initialization immediately
initialize();

// Export a proxy that ensures the module is loaded before use
module.exports = new Proxy({}, {
  get(target, prop) {
    // Return a function that ensures the module is loaded
    if (typeof prop === 'string') {
      return (...args) => {
        if (!loggerModule) {
          throw new Error('Logger module not initialized yet. Please await initialize() first.');
        }
        const fn = loggerModule[prop];
        if (typeof fn === 'function') {
          return fn(...args);
        } else {
          return fn;
        }
      };
    }
    return undefined;
  }
});

// Export the initialize function for explicit initialization
module.exports.initialize = initialize;
