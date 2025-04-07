### Stage 1: Builder
FROM node:22 AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install 

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

### Stage 2: Runner
FROM node:22-alpine AS runner

# Set working directory
WORKDIR /app

# Copy necessary files from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
ENV TZ=UTC

EXPOSE $APP_PORT
EXPOSE $WS_PORT

# Start the application
CMD ["node", "dist/main"]
