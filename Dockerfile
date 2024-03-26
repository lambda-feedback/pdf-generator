FROM  node:16.14.0

WORKDIR /app

COPY . .

COPY dist/*.js ./

RUN yarn install

CMD [ "index.handler" ]