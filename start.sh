#!/usr/bin/env bash
set -e

# Start the CPMTS frontend and file-proxy server together.
# Run this from the repository root: ./start.sh

cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "CPMTS/node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm --prefix CPMTS install
fi

if [ ! -d "file-proxy/node_modules" ]; then
  echo "Installing proxy dependencies..."
  npm --prefix file-proxy install
fi

echo "Starting file-proxy server..."
npm --prefix file-proxy start &
proxy_pid=$!

# Wait for the proxy server to be available before starting the frontend.
for i in {1..20}; do
  if curl -s http://127.0.0.1:3001/health >/dev/null 2>&1; then
    echo "file-proxy is up."
    break
  fi
  if ! kill -0 "$proxy_pid" 2>/dev/null; then
    echo "file-proxy process exited before startup."
    wait "$proxy_pid" 2>/dev/null || true
    exit 1
  fi
  echo "Waiting for file-proxy on port 3001... ($i/20)"
  sleep 1
done

if ! curl -s http://127.0.0.1:3001/health >/dev/null 2>&1; then
  echo "file-proxy did not start on port 3001. Check logs above."
  exit 1
fi

echo "Starting CPMTS frontend..."
npm --prefix CPMTS run dev &
frontend_pid=$!

cleanup() {
  echo "Stopping servers..."
  kill "$proxy_pid" "$frontend_pid" 2>/dev/null || true
  wait "$proxy_pid" 2>/dev/null || true
  wait "$frontend_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

wait