# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

# Final stage
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app ./

EXPOSE 8400

CMD ["npm", "start"]