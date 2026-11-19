FROM node:22-slim

WORKDIR /app

COPY package.json ./
COPY .actor ./.actor
COPY compiler.js yaml_parser.js zip_builder.js schema_fetch.js apify_main.mjs README.md ./

RUN npm install --no-save --omit=dev apify@^3.4.0 && npm cache clean --force

CMD ["node", "apify_main.mjs"]
