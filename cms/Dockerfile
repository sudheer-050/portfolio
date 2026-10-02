FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY server.js .
COPY seed/ seed/
COPY views/ views/
EXPOSE 4000
CMD ["node", "server.js"]
