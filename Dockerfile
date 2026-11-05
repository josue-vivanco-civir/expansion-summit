FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Copy project files
COPY . .

# Expose port (Render will override via PORT env var)
EXPOSE 3000
ENV PORT=3000

# Start server
CMD ["node", "server.js"]
