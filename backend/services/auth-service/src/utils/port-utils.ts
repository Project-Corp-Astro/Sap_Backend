/**
 * Port utilities for handling port conflicts
 */
import net from 'net';
import logger from './logger';

/**
 * Checks if a port is in use
 * @param port - Port to check
 * @returns Promise that resolves to true if port is available, false otherwise
 */
export const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    // Set a timeout to avoid hanging if there's an issue with the port check
    const timeout = setTimeout(() => {
      server.removeAllListeners();
      server.close();
      logger.warn(`Port check for ${port} timed out, assuming it's in use`);
      resolve(false);
    }, 1000);
    
    server.once('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Port ${port} is already in use`);
        resolve(false);
      } else {
        // Some other error occurred
        logger.error(`Error checking port ${port}:`, { error: err.message });
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      clearTimeout(timeout);
      // Port is available, close the server
      server.close(() => {
        resolve(true);
      });
    });
    
    // Attempt to bind to the port
    try {
      server.listen(port, '127.0.0.1'); // Explicitly use IPv4 to avoid IPv6 issues
    } catch (err) {
      clearTimeout(timeout);
      logger.error(`Exception trying to check port ${port}:`, { error: (err as Error).message });
      resolve(false);
    }
  });
};

/**
 * Finds an available port starting from the specified port
 * @param startPort - Port to start checking from
 * @param maxAttempts - Maximum number of ports to check
 * @returns Promise that resolves to an available port or null if none found
 */
export const findAvailablePort = async (
  startPort: number, 
  maxAttempts: number = 20 // Increased from 10 to 20 for more attempts
): Promise<number | null> => {
  logger.info(`Looking for an available port starting from ${startPort}`);
  
  // Try the preferred port first
  if (await isPortAvailable(startPort)) {
    logger.info(`Preferred port ${startPort} is available`);
    return startPort;
  }
  
  // If preferred port is not available, try a range of ports
  // Try a wider range of ports (3000-5000) to increase chances of finding an available one
  const portRanges = [
    // Try ports close to the preferred port first
    { start: startPort + 1, end: startPort + maxAttempts },
    // Then try some common alternative port ranges
    { start: 8000, end: 8020 },
    { start: 4000, end: 4020 },
    { start: 5000, end: 5020 }
  ];
  
  for (const range of portRanges) {
    logger.info(`Trying port range ${range.start}-${range.end}`);
    
    for (let port = range.start; port <= range.end; port++) {
      if (await isPortAvailable(port)) {
        logger.info(`Found available port: ${port}`);
        return port;
      }
      logger.warn(`Port ${port} is in use, trying next port`);
    }
  }
  
  // If we still haven't found a port, try a random port in a higher range
  const randomPort = Math.floor(Math.random() * 10000) + 10000; // Random port between 10000-20000
  logger.info(`Trying random port ${randomPort}`);
  if (await isPortAvailable(randomPort)) {
    logger.info(`Found available random port: ${randomPort}`);
    return randomPort;
  }
  
  logger.error(`Could not find an available port after exhaustive search`);
  return null;
};

/**
 * Terminates a process using a specific port (if possible)
 * @param port - The port to free up
 * @returns Promise that resolves to true if successful, false otherwise
 */
export const terminateProcessOnPort = async (port: number): Promise<boolean> => {
  try {
    // This is a Windows-specific approach
    const { execSync } = require('child_process');
    
    // Find the PID using the port
    const findCommand = `netstat -ano | findstr :${port}`;
    const output = execSync(findCommand, { encoding: 'utf8' });
    
    // Extract PID from the output
    const lines = output.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) {
      logger.warn(`No process found using port ${port}`);
      return false;
    }
    
    // Get the PID from the last column
    const pidMatch = lines[0].trim().match(/\s+(\d+)\s*$/); 
    if (!pidMatch) {
      logger.warn(`Could not extract PID for port ${port}`);
      return false;
    }
    
    const pid = pidMatch[1];
    logger.info(`Found process ${pid} using port ${port}, attempting to terminate`);
    
    // Kill the process
    execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' });
    logger.info(`Successfully terminated process ${pid} using port ${port}`);
    
    return true;
  } catch (error) {
    logger.error(`Failed to terminate process on port ${port}:`, { error: (error as Error).message });
    return false;
  }
};
