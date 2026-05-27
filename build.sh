#!/usr/bin/env bash
set -e

# Build script for the project.
# Usage: ./build.sh

cd "$(dirname "$0")"

# Ensure frontend dependencies are installed.
if [ ! -d "CPMTS/node_modules" ]; then
  echo "Installing CPMTS frontend dependencies..."
  npm --prefix CPMTS install
fi

# Ensure proxy dependencies are installed for local development and deployment.
if [ ! -d "file-proxy/node_modules" ]; then
  echo "Installing file-proxy dependencies..."
  npm --prefix file-proxy install
fi

echo "Building CPMTS frontend..."
npm --prefix CPMTS run build

echo "Build complete. Output available in CPMTS/dist"
