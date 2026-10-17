#!/usr/bin/env bash
# Legacy compatibility wrapper.
# Windows developers should use: powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if command -v pwsh >/dev/null 2>&1; then
  exec pwsh -File "$SCRIPT_DIR/setup.ps1" "$@"
fi

if command -v powershell.exe >/dev/null 2>&1; then
  exec powershell.exe -ExecutionPolicy Bypass -File "$SCRIPT_DIR/setup.ps1" "$@"
fi

echo "PowerShell 7 hoặc Windows PowerShell là bắt buộc để chạy setup tự động." >&2
echo "Chạy trên Windows: powershell -ExecutionPolicy Bypass -File .\\scripts\\setup.ps1" >&2
exit 1
