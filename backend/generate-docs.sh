#!/bin/bash

# Script to generate API documentation for all TypeScript services

echo "Generating API documentation for all services..."

# Create docs directory if it doesn't exist
mkdir -p ../docs/api

# Install TypeDoc dependencies in each service
cd services/user-service
npm install typedoc typedoc-plugin-markdown --save-dev
echo "Generating User Service documentation..."
npm run docs

cd ../auth-service
npm install typedoc typedoc-plugin-markdown --save-dev
echo "Generating Auth Service documentation..."
npm run docs

cd ../content-service
npm install typedoc typedoc-plugin-markdown --save-dev
echo "Generating Content Service documentation..."
npm run docs

cd ../../

echo "Documentation generation complete!"
echo "API documentation is available in the docs/api directory."
