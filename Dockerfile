FROM node:14-alpine

RUN apk update && apk add --no-cache nmap && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
    apk update && \
    apk add --no-cache \
    chromium \
    harfbuzz \
    "freetype>2.8" \
    ttf-freefont \
    nss
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
ENV CHROMIUM_EXECUTABLE_PATH="/usr/bin/chromium-browser"

RUN addgroup -S w2t && adduser -S w2t -G w2t -h /app
WORKDIR /app
USER w2t

COPY --chown=w2t /package.json ./
COPY --chown=w2t /yarn.lock ./
COPY --chown=w2t /src/modules/facebook_anonymous/package.json ./src/modules/facebook_anonymous/
COPY --chown=w2t /src/modules/facebook_page/package.json ./src/modules/facebook_page/
COPY --chown=w2t /src/modules/json/package.json ./src/modules/json/
COPY --chown=w2t /src/modules/rss/package.json ./src/modules/rss/
COPY --chown=w2t /src/modules/visual/package.json ./src/modules/visual/
COPY --chown=w2t /src/formatters/translate/package.json ./src/formatters/translate/
RUN ls -la

RUN yarn install

COPY --chown=w2t /src ./src

ENTRYPOINT ["npm","run","start"]
