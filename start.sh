#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting AT_Super server..."
cd "$ROOT_DIR/server" && npm start &
SERVER_PID=$!

echo "Starting AT_Super client..."
cd "$ROOT_DIR/client" && npm run dev &
CLIENT_PID=$!

echo "Server PID: $SERVER_PID | Client PID: $CLIENT_PID"
echo "Press Ctrl+C to stop both."

trap "echo 'Stopping...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait
