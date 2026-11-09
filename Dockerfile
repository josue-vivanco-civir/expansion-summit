FROM node:18-alpine

# zip se usa para descargar el paquete de assets
RUN apk add --no-cache zip

WORKDIR /app
COPY package.json ./
COPY . .

# El proceso no corre como root
RUN chown -R node:node /app
USER node

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
