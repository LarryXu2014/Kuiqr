FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /app/data
VOLUME ["/app/data"]
ENV DB_PATH=/app/data/qr.db
EXPOSE 3000
CMD ["node", "server.js"]
