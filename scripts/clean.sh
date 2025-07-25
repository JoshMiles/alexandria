#!/bin/bash
# Cleans the project from build artifacts and cache.
set -e

echo "Cleaning the project..."

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Remove dist folder
rm -rf dist

# Remove out folder
rm -rf out

# Remove webpack cache
rm -rf node_modules/.cache/webpack

# Optional: Clear npm cache
npm cache clean --force

echo "Clean complete."
