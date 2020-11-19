FROM node:13-alpine
WORKDIR /app

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
ENV CHROMIUM_EXECUTABLE_PATH="/usr/bin/chromium-browser"

RUN npm install -g yarn

COPY package.json package.json
COPY yarn.lock yarn.lock

RUN yarn install

COPY ./src ./src

ENTRYPOINT ["npm","run","start"]
