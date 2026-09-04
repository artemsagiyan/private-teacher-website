FROM node:lts-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=10 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["sh", "-c", "node ./node_modules/typeorm/cli.js -d dist/data-source.js migration:run && node dist/main"]
