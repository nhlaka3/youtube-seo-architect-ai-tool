#!/bin/bash
cd "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool"
node server.js > /tmp/server.out.log 2> /tmp/server.err.log &
echo "Server started with PID $!"
sleep 8
cat /tmp/server.err.log
ss -tlnp | grep 5175