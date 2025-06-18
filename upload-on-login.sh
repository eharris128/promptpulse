#!/bin/bash

# Claude Code Usage Upload on Login
# This script checks if upload was missed and runs it

# Auto-detect script directory - no configuration needed
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
LAST_RUN_FILE="$LOG_DIR/last-upload"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Check when we last ran (if file exists)
if [ -f "$LAST_RUN_FILE" ]; then
    LAST_RUN=$(cat "$LAST_RUN_FILE")
    TODAY=$(date +%Y-%m-%d)
    
    # If we haven't run today, run the upload
    if [ "$LAST_RUN" != "$TODAY" ]; then
        echo "Last upload was $LAST_RUN, running upload now..."
        # Run in background so login isn't delayed
        nohup "$SCRIPT_DIR/cron-upload.sh" > /dev/null 2>&1 &
        # Update last run date
        echo "$TODAY" > "$LAST_RUN_FILE"
    fi
else
    # First time, create the file and run
    echo "First time setup, running upload..."
    TODAY=$(date +%Y-%m-%d)
    echo "$TODAY" > "$LAST_RUN_FILE"
    nohup "$SCRIPT_DIR/cron-upload.sh" > /dev/null 2>&1 &
fi