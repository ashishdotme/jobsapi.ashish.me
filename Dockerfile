#
# BUILD CONTAINER
#
FROM node:22 as base
USER node
WORKDIR /app
COPY --chown=node:node package*.json tsconfig*.json ./

RUN rm package-lock.json


RUN npm install
COPY --chown=node:node . .
ENV NODE_ENV=production
RUN npm run build

#
# PRODUCTION CONTAINER
#
ENV NODE_ENV production
FROM node:22 as production
USER node
EXPOSE 3000
WORKDIR /app
COPY --chown=node:node --from=base /app/node_modules ./node_modules
COPY --chown=node:node --from=base /app/dist ./dist
COPY --chown=node:node --from=base /app/package.json ./
CMD [ "node", "dist/main.js" ]
