FROM node:20-bookworm-slim

ARG CHATTY_UID=996
ARG CHATTY_GID=985

WORKDIR /app

RUN groupadd --system --gid "${CHATTY_GID}" chatty \
  && useradd --system \
    --uid "${CHATTY_UID}" \
    --gid "${CHATTY_GID}" \
    --home-dir /home/chatty \
    --create-home \
    --shell /usr/sbin/nologin \
    chatty

COPY package.json ./
COPY server.js ./
COPY src ./src
COPY public ./public
COPY knowledge ./knowledge
COPY tools ./tools

RUN mkdir -p /var/lib/chatty \
  && chown -R chatty:chatty /app /var/lib/chatty

ENV NODE_ENV=production \
  PORT=3000 \
  KNOWLEDGE_DIR=/app/knowledge \
  ALLOWED_ORIGINS=* \
  KNOWLEDGE_CACHE_MS=2000 \
  CHAT_LEARNING_LOG_ENABLED=true \
  CHAT_LEARNING_LOG_PATH=/var/lib/chatty/learning-events.jsonl

USER chatty

EXPOSE 3000 3443

CMD ["node", "server.js"]
