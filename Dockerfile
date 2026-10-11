FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Create uploads directory
RUN mkdir -p uploads

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "--experimental-sqlite", "server.js"]
