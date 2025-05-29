const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration for each service
const services = [
  {
    name: 'Auth Service',
    command: 'npm',
    args: ['run', 'dev:auth'],
    cwd: path.join(__dirname, 'backend'),
    color: '\x1b[36m', // Cyan
    port: 3003
  },
  {
    name: 'User Service',
    command: 'npm',
    args: ['run', 'dev:user'],
    cwd: path.join(__dirname, 'backend'),
    color: '\x1b[32m', // Green
    port: 3004
  },
  {
    name: 'Content Service',
    command: 'npm',
    args: ['run', 'dev:content'],
    cwd: path.join(__dirname, 'backend'),
    color: '\x1b[33m', // Yellow
    port: 3005
  }
  // Add more services as needed
];

// Clear console
console.clear();
console.log('\x1b[1m\x1b[34m=== SAP Backend Services Manager ===\x1b[0m\n');
console.log('\x1b[1mService Configuration:\x1b[0m');
services.forEach(service => {
  console.log(`${service.color}${service.name}\x1b[0m: Port ${service.port}`);
});
console.log('');

// Start each service
services.forEach(service => {
  console.log(`${service.color}Starting ${service.name}...\x1b[0m`);
  
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    shell: true,
    stdio: 'pipe'
  });
  
  // Handle stdout
  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      console.log(`${service.color}[${service.name}]\x1b[0m ${line}`);
    });
  });
  
  // Handle stderr
  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      console.log(`${service.color}[${service.name}] ERROR:\x1b[0m ${line}`);
    });
  });
  
  // Handle process exit
  child.on('close', (code) => {
    if (code !== 0) {
      console.log(`${service.color}[${service.name}]\x1b[0m exited with code ${code}`);
    }
  });
  
  // Handle errors
  child.on('error', (err) => {
    console.log(`${service.color}[${service.name}] Failed to start:\x1b[0m ${err.message}`);
  });
});

console.log('\n\x1b[1m\x1b[34mAll services started. Press Ctrl+C to stop all services.\x1b[0m');

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\x1b[1m\x1b[34mShutting down all services...\x1b[0m');
  process.exit();
});
