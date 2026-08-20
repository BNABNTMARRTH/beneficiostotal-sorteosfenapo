#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"
export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$PATH"
pkill -9 -f "node.*server.js" 2>/dev/null || true
sleep 1
nohup node src/server.js </dev/null >> "$DIR/server.log" 2>&1 &
echo "Daemon started with PID: $!"
