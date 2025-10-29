FROM node:22

# Set working directory
WORKDIR /app

# Install wiki globally
RUN npm install -g wiki

# Install wiki-security-sessionless plugin
RUN npm install -g wiki-security-sessionless

# Find where wiki is installed and add plugin to its node_modules
RUN WIKI_PATH=$(npm root -g)/wiki/node_modules && \
    mkdir -p $WIKI_PATH/wiki-plugin-allyabase

# Copy the local wiki-plugin-allyabase source into wiki's node_modules
COPY ../package.json /tmp/allyabase-temp/package.json
COPY ../package-lock.json /tmp/allyabase-temp/package-lock.json
COPY ../factory.json /tmp/allyabase-temp/factory.json
COPY ../allyabase_setup.sh /tmp/allyabase-temp/allyabase_setup.sh
COPY ../client /tmp/allyabase-temp/client
COPY ../server /tmp/allyabase-temp/server
COPY ../README.md /tmp/allyabase-temp/README.md

# Install dependencies in temp directory, then copy to wiki's node_modules
RUN cd /tmp/allyabase-temp && \
    npm install && \
    WIKI_PATH=$(npm root -g)/wiki/node_modules && \
    cp -r /tmp/allyabase-temp/* $WIKI_PATH/wiki-plugin-allyabase/ && \
    rm -rf /tmp/allyabase-temp

# Go back to app directory
WORKDIR /app

# Create .wiki directory for data persistence
RUN mkdir -p /root/.wiki

# Expose the port (will be overridden by docker-compose)
EXPOSE 4000

# Default command - run wiki on port 4000 to avoid conflict with allyabase julia service on 3000
CMD ["wiki", "--port", "4000", "--security_type", "sessionless"]
