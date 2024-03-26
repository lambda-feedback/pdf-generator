FROM  node:16.14.0 as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json ./

RUN yarn install --frozen-lockfile && yarn add typescript tsc

COPY . .

RUN yarn build

FROM node:slim

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

COPY --from=builder /usr/src/app/dist ./dist

CMD [ "node", "dist/index.js" ]