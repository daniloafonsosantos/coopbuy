FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
# cache bust: 2026-04-09
RUN echo "cache-bust-v3" && npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
COPY --from=build /app/serve.json ./dist/serve.json
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
