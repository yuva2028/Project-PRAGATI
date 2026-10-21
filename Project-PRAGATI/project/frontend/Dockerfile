# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Accept backend URL as a build-time argument (override in CI/CD)
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine

# Custom nginx config for SPA routing (prevents 404 on direct URL access)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets to Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
