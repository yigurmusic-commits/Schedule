# Build stage
FROM node:22-alpine as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine as production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html
# Save as template — envsubst will substitute BACKEND_URL and PORT at container startup
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

EXPOSE 80

# Only substitute $BACKEND_URL and $PORT — leave other nginx variables intact
CMD ["/bin/sh", "-c", "envsubst '$BACKEND_URL $PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
