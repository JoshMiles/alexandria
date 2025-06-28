#!/bin/bash
# Automates the release process: updates version, commits, tags, and pushes.
set -e

# Get the new version from the first argument, or default to 'patch'
VERSION_BUMP=${1:-patch}

echo "Staging all changes..."
git add .

echo "Bumping version with '$VERSION_BUMP'..."

# Update the version, create a commit, and tag it
npm version "$VERSION_BUMP" -m "chore(release): %s"

echo "Pushing commit and tags..."

# Push the commit and the new tag to the remote repository
git push && git push --tags

echo "Release script complete. The GitHub Actions workflow should now be triggered."
