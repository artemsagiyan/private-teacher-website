FROM node:lts-alpine
WORKDIR /app
COPY package*.json ./
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm install --legacy-peer-deps
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
ENV NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --retries=10 \
  CMD node -e "require('http').get('http://127.0.0.1:3000',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["npm", "start"]
