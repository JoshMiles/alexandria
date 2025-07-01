#!/bin/bash
# Cleans, builds, and creates distributables using Electron Forge.
set -e

echo "Running make script..."

# Clean the project
./scripts/clean.sh

# Build the application
./scripts/build.sh

# Create distributable packages with Electron Forge
npm run make

echo "Make script complete."
