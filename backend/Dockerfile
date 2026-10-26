FROM node:24-alpine AS frontend
WORKDIR /build
COPY xavinex-management/package*.json ./
RUN npm ci
COPY xavinex-management/index.html xavinex-management/vite.config.ts xavinex-management/tsconfig.json ./
COPY xavinex-management/src ./src
COPY xavinex-management/public ./public
RUN npm run build

FROM node:24-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node backend/app.js backend/auth.js backend/bootstrap.js backend/config.js backend/database.js backend/dates.js backend/service.js backend/validation.js backend/server.js backend/local-mongo.js ./
COPY --from=frontend /build/dist /app/xavinex-management/dist
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000 LOCAL_MONGO=false
EXPOSE 4000
CMD ["node", "server.js"]
