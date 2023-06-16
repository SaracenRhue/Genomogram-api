FROM node:alpine

WORKDIR /home/app

COPY . .

RUN npm install

ENV PORT=3000
EXPOSE 3000

VOLUME /home/app/database

CMD touch database/data.db && node server.js