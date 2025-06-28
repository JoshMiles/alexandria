#!/bin/bash
# Cleans, builds, and creates executables for each platform.
set -e

echo "Running make script..."

# Clean the project
./scripts/clean.sh

# Build the application
./scripts/build.sh

# Create distributable packages
npm run dist

echo "Make script complete."
