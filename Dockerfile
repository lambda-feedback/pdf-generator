FROM  node:16.14.0 as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

COPY /usr/src/app/dist ./dist

EXPOSE 8080
CMD [ "node", "dist/index.js" ]