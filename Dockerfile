FROM  node:16.14.0

WORKDIR /app

COPY . .

RUN npm install

CMD [ "npm", "run" ]