#!/usr/bin/env bash
# ==============================================
# Project Initialization Script
# Usage: bash scripts/init.sh
# ==============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

echo "Initializing Microservices Project..."
echo "==========================================="

get_env_value() {
  local name="$1"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

set_env_value() {
  local name="$1"
  local value="$2"
  if grep -q "^${name}=" "$ENV_FILE"; then
    local escaped
    escaped="$(printf '%s' "$value" | sed 's/[&/]/\\&/g')"
    sed -i.bak "s/^${name}=.*/${name}=${escaped}/" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
  else
    printf '
%s=%s
' "$name" "$value" >> "$ENV_FILE"
  fi
}

is_placeholder() {
  local value="${1:-}"
  [ -z "$value" ] || [[ "$value" == *REPLACE_WITH* ]] || [[ "$value" == *replace-with* ]] || [[ "$value" == *'<secret>'* ]]
}

generate_base64url_secret() {
  if command -v node >/dev/null 2>&1; then
    node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))"
  elif command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr '+/' '-_' | tr -d '=
'
  else
    echo "Node.js or OpenSSL is required to generate AUTH_PASSWORD_RESET_PEPPER." >&2
    exit 1
  fi
}

# --- 1. Environment file and password-reset configuration ---
if [ ! -f "$ENV_FILE" ]; then
  cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
  echo "Created .env from .env.example"
else
  echo ".env already exists; preserving configured values"
fi

reset_pepper="$(get_env_value AUTH_PASSWORD_RESET_PEPPER || true)"
if is_placeholder "$reset_pepper"; then
  set_env_value AUTH_PASSWORD_RESET_PEPPER "$(generate_base64url_secret)"
  echo "Generated AUTH_PASSWORD_RESET_PEPPER"
fi

[ -n "$(get_env_value AUTH_PASSWORD_RESET_TTL_MINUTES || true)" ] || set_env_value AUTH_PASSWORD_RESET_TTL_MINUTES 15
[ -n "$(get_env_value AUTH_PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS || true)" ] || set_env_value AUTH_PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS 60
[ -n "$(get_env_value AUTH_PASSWORD_RESET_URL || true)" ] || set_env_value AUTH_PASSWORD_RESET_URL http://localhost:3000/reset-password
[ -n "$(get_env_value AUTH_SMTP_PORT || true)" ] || set_env_value AUTH_SMTP_PORT 587
[ -n "$(get_env_value AUTH_SMTP_SECURE || true)" ] || set_env_value AUTH_SMTP_SECURE false

smtp_user="$(get_env_value AUTH_SMTP_USER || true)"
smtp_password="$(get_env_value AUTH_SMTP_PASSWORD || true)"
if { [ -n "$smtp_user" ] && [ -z "$smtp_password" ]; } || { [ -z "$smtp_user" ] && [ -n "$smtp_password" ]; }; then
  echo "AUTH_SMTP_USER and AUTH_SMTP_PASSWORD must be configured together." >&2
  exit 1
fi
if is_placeholder "$(get_env_value AUTH_SMTP_HOST || true)" || is_placeholder "$(get_env_value AUTH_EMAIL_FROM || true)"; then
  echo "WARNING: SMTP is incomplete. Set AUTH_SMTP_HOST and AUTH_EMAIL_FROM before testing forgot-password." >&2
fi

# --- 2. Check Docker ---
if command -v docker >/dev/null 2>&1; then
  echo "Docker found: $(docker --version)"
else
  echo "Docker not found. Please install Docker Desktop."
  echo "https://docs.docker.com/get-docker/"
  exit 1
fi

# --- 3. Check Docker Compose ---
if docker compose version >/dev/null 2>&1; then
  echo "Docker Compose found: $(docker compose version --short)"
elif command -v docker-compose >/dev/null 2>&1; then
  echo "Docker Compose (legacy) found: $(docker-compose --version)"
else
  echo "Docker Compose not found."
  exit 1
fi

# --- 4. Build containers ---
echo ""
echo "Building containers..."
cd "$PROJECT_DIR"
docker compose build

echo ""
echo "==========================================="
echo "Project initialized successfully!"
echo ""
echo "Next steps:"
echo "  1. Configure AUTH_SMTP_* and AUTH_EMAIL_FROM in .env"
echo "  2. Verify AUTH_PASSWORD_RESET_URL points to the frontend reset page"
echo "  3. Run: docker compose up --build"
echo "  4. auth-migrate will apply the password_reset_tokens migration"
echo "==========================================="
