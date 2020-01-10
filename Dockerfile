FROM node:13-alpine
WORKDIR /app
COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm install
COPY ./src ./src
ENTRYPOINT ["npm","run","start"]
