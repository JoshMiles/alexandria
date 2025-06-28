#!/bin/bash
# Builds the application.
set -e

echo "Building the application..."

# Install dependencies
npm install

# Build the application with webpack
npm run build

echo "Build complete."
