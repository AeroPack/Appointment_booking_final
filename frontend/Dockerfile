FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json tsconfig.node.json vite.config.ts postcss.config.js tailwind.config.js components.json index.html ./
COPY src/ src/
ARG VITE_API_URL=http://localhost
ENV VITE_API_URL=$VITE_API_URL
RUN npx vite build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
