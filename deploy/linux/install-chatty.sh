#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/kmh251/deployment/chatty}"
SERVICE_USER="${SERVICE_USER:-chatty}"
SERVICE_GROUP="${SERVICE_GROUP:-chatty}"
ENV_DIR="${ENV_DIR:-/etc/chatty}"
ENV_FILE="${ENV_FILE:-${ENV_DIR}/chatty.env}"
SERVICE_FILE="${SERVICE_FILE:-/etc/systemd/system/chatty.service}"
DATA_DIR="${DATA_DIR:-/var/lib/chatty}"
PORT="${PORT:-3000}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-*}"
KNOWLEDGE_CACHE_MS="${KNOWLEDGE_CACHE_MS:-2000}"
CHAT_LEARNING_LOG_ENABLED="${CHAT_LEARNING_LOG_ENABLED:-true}"
CHAT_LEARNING_LOG_PATH="${CHAT_LEARNING_LOG_PATH:-${DATA_DIR}/learning-events.jsonl}"
OPEN_FIREWALL="${OPEN_FIREWALL:-true}"
ENABLE_HTTPS="${ENABLE_HTTPS:-false}"
HTTPS_PORT="${HTTPS_PORT:-3443}"
PUBLIC_HOST="${PUBLIC_HOST:-$(hostname -f 2>/dev/null || hostname)}"
CERT_DIR="${CERT_DIR:-${ENV_DIR}/certs}"
HTTPS_CERT_PATH="${HTTPS_CERT_PATH:-}"
HTTPS_KEY_PATH="${HTTPS_KEY_PATH:-}"
HTTPS_CA_CERT_PATH="${HTTPS_CA_CERT_PATH:-}"
HTTPS_CA_KEY_PATH="${HTTPS_CA_KEY_PATH:-}"
if [[ -z "${PROTECT_HOME:-}" ]]; then
  if [[ "${APP_DIR}" == /home/* ]]; then
    PROTECT_HOME="read-only"
  else
    PROTECT_HOME="true"
  fi
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo/root."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install Node.js 20+ first, then rerun this installer."
  exit 1
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  echo "Node.js 20+ is required. Current version: $(node --version)"
  exit 1
fi

NODE_BIN="$(command -v node)"

if ! getent group "${SERVICE_GROUP}" >/dev/null; then
  groupadd --system "${SERVICE_GROUP}"
fi

if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd --system --gid "${SERVICE_GROUP}" --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${SERVICE_USER}"
fi

mkdir -p "${APP_DIR}" "${ENV_DIR}" "${CERT_DIR}" "${DATA_DIR}"

if [[ "${APP_DIR}" == /home/* ]]; then
  if command -v setfacl >/dev/null 2>&1; then
    current_path="${APP_DIR}"
    while [[ "${current_path}" != "/" && "${current_path}" != "/home" ]]; do
      current_path="$(dirname "${current_path}")"
      if [[ "${current_path}" != "/" && "${current_path}" != "/home" ]]; then
        setfacl -m "u:${SERVICE_USER}:--x" "${current_path}" || true
      fi
    done
  else
    echo "Warning: setfacl not found; ensure ${SERVICE_USER} can traverse parent directories for ${APP_DIR}."
  fi
fi

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "dist" \
    "${SRC_DIR}/" "${APP_DIR}/"
else
  tmp_archive="$(mktemp)"
  tar \
    --exclude=".git" \
    --exclude="node_modules" \
    --exclude="dist" \
    -C "${SRC_DIR}" \
    -cf "${tmp_archive}" .
  rm -rf "${APP_DIR:?}/"*
  tar -C "${APP_DIR}" -xf "${tmp_archive}"
  rm -f "${tmp_archive}"
fi

chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_DIR}"
chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${DATA_DIR}"
chmod 0750 "${DATA_DIR}"

if [[ "${ENABLE_HTTPS}" == "true" ]]; then
  use_generated_certificate="false"
  if [[ -z "${HTTPS_CERT_PATH}" || -z "${HTTPS_KEY_PATH}" ]]; then
    HTTPS_CERT_PATH="${CERT_DIR}/chatty.crt"
    HTTPS_KEY_PATH="${CERT_DIR}/chatty.key"
    HTTPS_CA_CERT_PATH="${HTTPS_CA_CERT_PATH:-${CERT_DIR}/chatty-root-ca.crt}"
    HTTPS_CA_KEY_PATH="${HTTPS_CA_KEY_PATH:-${CERT_DIR}/chatty-root-ca.key}"
    use_generated_certificate="true"
  fi

  if [[ "${use_generated_certificate}" == "true" && ( ! -f "${HTTPS_CA_CERT_PATH}" || ! -f "${HTTPS_CA_KEY_PATH}" || ! -f "${HTTPS_CERT_PATH}" || ! -f "${HTTPS_KEY_PATH}" ) ]]; then
    if ! command -v openssl >/dev/null 2>&1; then
      echo "OpenSSL was not found. Install openssl or provide HTTPS_CERT_PATH and HTTPS_KEY_PATH."
      exit 1
    fi

    ca_config="$(mktemp)"
    cat > "${ca_config}" <<CERT
[req]
default_bits = 4096
prompt = no
default_md = sha256
x509_extensions = v3_ca
distinguished_name = dn

[dn]
CN = Chatty Intranet Local Root CA

[v3_ca]
basicConstraints = critical, CA:true
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
CERT

    if [[ ! -f "${HTTPS_CA_CERT_PATH}" || ! -f "${HTTPS_CA_KEY_PATH}" ]]; then
      openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
        -keyout "${HTTPS_CA_KEY_PATH}" \
        -out "${HTTPS_CA_CERT_PATH}" \
        -config "${ca_config}" >/dev/null 2>&1
    fi
    rm -f "${ca_config}"

    cert_config="$(mktemp)"
    cert_request="$(mktemp)"
    alt_names="DNS.1 = ${PUBLIC_HOST}"
    if [[ "${PUBLIC_HOST}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      alt_names="${alt_names}"$'\n'"IP.1 = ${PUBLIC_HOST}"
    fi

    cat > "${cert_config}" <<CERT
[req]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = v3_req
distinguished_name = dn

[dn]
CN = ${PUBLIC_HOST}

[v3_req]
subjectAltName = @alt_names
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
${alt_names}
CERT

    openssl req -new -nodes -newkey rsa:2048 \
      -keyout "${HTTPS_KEY_PATH}" \
      -out "${cert_request}" \
      -config "${cert_config}" >/dev/null 2>&1
    openssl x509 -req -days 825 \
      -in "${cert_request}" \
      -CA "${HTTPS_CA_CERT_PATH}" \
      -CAkey "${HTTPS_CA_KEY_PATH}" \
      -CAcreateserial \
      -out "${HTTPS_CERT_PATH}" \
      -extensions v3_req \
      -extfile "${cert_config}" >/dev/null 2>&1
    rm -f "${cert_config}" "${cert_request}"
  elif [[ ! -f "${HTTPS_CERT_PATH}" || ! -f "${HTTPS_KEY_PATH}" ]]; then
    echo "HTTPS certificate or key was not found. Provide HTTPS_CERT_PATH and HTTPS_KEY_PATH or allow the installer to generate them."
    exit 1
  fi

  chown root:"${SERVICE_GROUP}" "${HTTPS_CERT_PATH}" "${HTTPS_KEY_PATH}"
  chmod 0644 "${HTTPS_CERT_PATH}"
  chmod 0640 "${HTTPS_KEY_PATH}"
  if [[ -n "${HTTPS_CA_CERT_PATH}" && -f "${HTTPS_CA_CERT_PATH}" ]]; then
    chown root:root "${HTTPS_CA_CERT_PATH}"
    chmod 0644 "${HTTPS_CA_CERT_PATH}"
  fi
  if [[ -n "${HTTPS_CA_KEY_PATH}" && -f "${HTTPS_CA_KEY_PATH}" ]]; then
    chown root:root "${HTTPS_CA_KEY_PATH}"
    chmod 0600 "${HTTPS_CA_KEY_PATH}"
  fi
fi

cat > "${ENV_FILE}" <<ENV
NODE_ENV=production
PORT=${PORT}
KNOWLEDGE_DIR=${APP_DIR}/knowledge
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
KNOWLEDGE_CACHE_MS=${KNOWLEDGE_CACHE_MS}
CHAT_LEARNING_LOG_ENABLED=${CHAT_LEARNING_LOG_ENABLED}
CHAT_LEARNING_LOG_PATH=${CHAT_LEARNING_LOG_PATH}
ENV

if [[ "${ENABLE_HTTPS}" == "true" ]]; then
  cat >> "${ENV_FILE}" <<ENV
HTTPS_PORT=${HTTPS_PORT}
HTTPS_CERT_PATH=${HTTPS_CERT_PATH}
HTTPS_KEY_PATH=${HTTPS_KEY_PATH}
ENV
fi

chmod 0640 "${ENV_FILE}"
chown root:"${SERVICE_GROUP}" "${ENV_FILE}"

cat > "${SERVICE_FILE}" <<SERVICE
[Unit]
Description=Hospital Intranet Chatbot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${NODE_BIN} ${APP_DIR}/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=${PROTECT_HOME}
ProtectSystem=full
ReadOnlyPaths=${APP_DIR}
ReadWritePaths=${DATA_DIR}

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable chatty.service
systemctl restart chatty.service

if [[ "${OPEN_FIREWALL}" == "true" ]]; then
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -qi "Status: active"; then
    ufw allow "${PORT}/tcp"
    if [[ "${ENABLE_HTTPS}" == "true" ]]; then
      ufw allow "${HTTPS_PORT}/tcp"
    fi
  elif command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-port="${PORT}/tcp"
    if [[ "${ENABLE_HTTPS}" == "true" ]]; then
      firewall-cmd --permanent --add-port="${HTTPS_PORT}/tcp"
    fi
    firewall-cmd --reload
  fi
fi

systemctl --no-pager --full status chatty.service || true
echo "Installed Chatty at ${APP_DIR}"
echo "Health check: http://$(hostname -f 2>/dev/null || hostname):${PORT}/api/health"
if [[ "${ENABLE_HTTPS}" == "true" ]]; then
  echo "HTTPS health check: https://${PUBLIC_HOST}:${HTTPS_PORT}/api/health"
fi
