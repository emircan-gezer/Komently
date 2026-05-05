#!/bin/bash
set -e

echo "Starting Komently MCP server on port 8001..."
MCP_SERVER_PORT=8001 python -m tools.mcp_server &
MCP_PID=$!

# Wait until MCP server port is open before starting the API
echo "Waiting for MCP server to be ready..."
for i in $(seq 1 20); do
    if python -c "import socket; s=socket.socket(); s.connect(('127.0.0.1',8001)); s.close()" 2>/dev/null; then
        echo "MCP server is ready."
        break
    fi
    sleep 1
done

echo "Starting Komently API on port ${PORT:-8000}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
