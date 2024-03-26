FROM  node:16.14.0 as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json ./

RUN yarn install --frozen-lockfile && yarn add typescript tsc

COPY . .

RUN yarn build

COPY /usr/src/app/dist ./dist

CMD [ "dist/index.js" ]