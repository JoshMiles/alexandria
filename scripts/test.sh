#!/bin/bash
# Cleans, builds, and launches the application for testing.
set -e

echo "Running test script..."

# Clean the project
./scripts/clean.sh

# Build the application
./scripts/build.sh

# Launch the application
npm start

echo "Test script complete."
