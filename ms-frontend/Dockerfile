FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy static assets
COPY ms-frontend/src/main/resources/static/ /app/static/

# Install minimal web server
RUN npm install -g http-server

# Expose port 3000
EXPOSE 3000

# Serve templates as root and static assets from /static
CMD ["http-server", "/app/static", "-p", "3000", "-c-1"]
