#!/bin/bash

# Monitor Denon AVR logs from server.log
# Highlights volume-related logs for debugging
# Usage: ./filter_denon_logs.sh

# Create a named pipe for tailing the log
pipe=$(mktemp -u)
mkfifo "$pipe"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Start tailing the server log in the background and filter for Denon AVR logs
tail -f server.log | grep --line-buffered -E "Denon AVR|volume|Volume" > "$pipe" &
tail_pid=$!

# Read from the pipe and display each message with color highlighting
cat "$pipe" | while IFS= read -r line; do
  if [[ "$line" == *"volume response parsed"* ]]; then
    echo -e "${GREEN}${line}${NC}"
  elif [[ "$line" == *"Could not parse"* ]] || [[ "$line" == *"Error"* ]]; then
    echo -e "${RED}${line}${NC}"
  elif [[ "$line" == *"volume"* ]] || [[ "$line" == *"Volume"* ]]; then
    echo -e "${YELLOW}${line}${NC}"
  elif [[ "$line" == *"refreshed"* ]]; then
    echo -e "${BLUE}${line}${NC}"
  else
    echo -e "${CYAN}${line}${NC}"
  fi
done &
cat_pid=$!

# Handle cleanup when script is terminated
trap "kill $tail_pid $cat_pid 2>/dev/null; rm -f $pipe; exit" INT TERM EXIT

# Keep the script running
echo "Monitoring Denon AVR logs, focusing on volume issues. Press Ctrl+C to stop."
while true; do
  sleep 1
done 