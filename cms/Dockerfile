FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js .
COPY catalog.js publishing.js site-page.js demo.js ./
COPY test-catalog.js test-http.js ./
COPY templates/ templates/
COPY seed/ seed/
COPY views/ views/
EXPOSE 4000
CMD ["node", "server.js"]
