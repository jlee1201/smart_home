#!/bin/bash

# Test Denon AVR-X4500H via Telnet
# Usage: ./test_denon_telnet.sh <command>
# Examples:
#   ./test_denon_telnet.sh PW?     # Query power status
#   ./test_denon_telnet.sh PWON    # Power on
#   ./test_denon_telnet.sh MV?     # Query volume
#   ./test_denon_telnet.sh MV40    # Set volume to 40

IP="192.168.50.98"
PORT=23
TIMEOUT=5
COMMAND=${1:-PW?}  # Default command is power query

echo "Sending command '$COMMAND' to Denon AVR at $IP:$PORT..."

# Create a temporary file to capture the response
TEMP_FILE=$(mktemp)

# Send command via netcat (macOS version)
# The -w sets a timeout
(echo -e "$COMMAND\r\n"; sleep 3) | nc -w $TIMEOUT $IP $PORT > $TEMP_FILE

# Display the response
echo "Response:"
cat $TEMP_FILE
echo ""

# Clean up
rm -f $TEMP_FILE 