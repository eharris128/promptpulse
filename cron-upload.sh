#!/bin/bash

# Claude Code Usage Upload Cron Script
# This script runs the usage upload and logs the results

# Auto-detect script directory - no configuration needed
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/upload-$(date +%Y-%m).log"
LOCK_FILE="/tmp/ccusage-upload.lock"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to cleanup on exit
cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# Check if another instance is running
if [ -f "$LOCK_FILE" ]; then
    log "ERROR: Another upload process is already running (lock file exists)"
    exit 1
fi

# Create lock file
touch "$LOCK_FILE"

log "Starting Claude Code usage upload..."

# Change to script directory
cd "$SCRIPT_DIR" || {
    log "ERROR: Could not change to script directory: $SCRIPT_DIR"
    exit 1
}

# Run the upload script and capture output
if output=$(node upload-usage.js 2>&1); then
    log "SUCCESS: Upload completed successfully"
    log "Output: $output"
    # Update last successful run date
    echo "$(date +%Y-%m-%d)" > "$LOG_DIR/last-upload"
else
    log "ERROR: Upload failed with exit code $?"
    log "Error output: $output"
    exit 1
fi

log "Upload process completed"