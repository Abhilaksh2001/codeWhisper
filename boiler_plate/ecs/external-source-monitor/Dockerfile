FROM node:16-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV POLLING_INTERVAL=300000
ENV AWS_REGION=us-east-1

# Start the application
CMD ["node", "index.js"]