FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/uploads/avatars && chown app:app /app/uploads /app/uploads/avatars
USER app
EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "--import", "dotenv/config", "dist/index.js"]
