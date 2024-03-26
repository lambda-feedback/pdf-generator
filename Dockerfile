FROM  node:16.14.0 as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json ./

RUN yarn install --frozen-lockfile && yarn add typescript tsc

COPY . .

RUN yarn build

FROM node:slim

ENV NODE_ENV production
USER node

COPY --from=builder /usr/src/app/dist/index.js ./dist/index.js

CMD [ "node", "dist/index.js" ]