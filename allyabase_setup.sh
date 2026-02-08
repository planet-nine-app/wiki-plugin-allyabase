#!/bin/bash

set -e

# Use /var/lib for persistent storage on Ubuntu instead of /tmp
# /var/lib is the standard location for application state data that persists across reboots
defaultDir="/var/lib"
buildDir="${1:-$defaultDir}"
[[ $buildDir != /* ]]&& buildDir="${PWD%/}/$buildDir"
buildDir="${buildDir#./}/allyabase"
ecosystem_config='ecosystem.config.js'
services=(
    'addie'
    'aretha'
    'bdo'
    'continuebee'
    'covenant'
    'dolores'
    'fount'
    'joan'
    'julia'
    'minnie'
    'pref'
    'prof'
    'sanora'
)

setup_services() {
    # Remove existing directory if it exists to ensure clean setup
    if [ -d "$buildDir" ]; then
        echo "Removing existing allyabase directory..."
        rm -rf "$buildDir"
    fi

    mkdir -p "$buildDir" && cd "$buildDir"

    # Configure git for better performance and reliability in containers
    git config --global http.postBuffer 524288000  # 500MB buffer
    git config --global http.lowSpeedLimit 0
    git config --global http.lowSpeedTime 999999

    for service in "${services[@]}"; do
        echo "Cloning '$service'..."
        # Use shallow clone to reduce data transfer and retry on failure
        if ! git clone --depth 1 "https://github.com/planet-nine-app/$service"; then
            echo "First attempt failed, retrying with full clone..."
            if ! git clone "https://github.com/planet-nine-app/$service"; then
                echo "ERROR: Failed to clone $service after retry"
                exit 1
            fi
        fi

        printf '%s\n' "Installing '$service'..."
        npm install "$service/src/server/node"
    done

    # Add logging to BDO service to debug request handling
    echo "Adding debug logging to BDO service..."

    # Find the PUT /user/create endpoint and add logging at the start
    sed -i.bak "/app.put.*user\/create/,/^app\./ {
        /^app\.put/a\\
console.log('[BDO] Received PUT /user/create request');\
console.log('[BDO] Headers:', JSON.stringify(req.headers, null, 2));\
console.log('[BDO] Body:', JSON.stringify(req.body, null, 2));
    }" bdo/src/server/node/bdo.js

    echo "✓ Added logging to BDO service"

} # setup_services

setup_ecosystem() {
    if [[ ! -f "package.json" || ! -f "package-lock.json" ]]; then
        echo "Initializing npm in this directory..."
        npm init -y
    else
        echo "Both package.json and package-lock.json are already present. Skipping initialization."
    fi

    npm install pm2

    # Try to read location emoji and federation emoji from wiki's owner.json
    LOCATION_EMOJI=""
    FEDERATION_EMOJI=""
    OWNER_JSON="${HOME}/.wiki/status/owner.json"
    if [[ -f "$OWNER_JSON" ]]; then
        # Try to extract locationEmoji and federationEmoji using node
        read -r LOCATION_EMOJI FEDERATION_EMOJI < <(node -e "
            try {
                const owner = require('$OWNER_JSON');
                const location = owner.locationEmoji || '';
                const federation = owner.federationEmoji || '';
                console.log(location + ' ' + federation);
            } catch (e) {
                console.log(' ');
            }
        " 2>/dev/null || echo " ")

        if [[ -n "$LOCATION_EMOJI" ]]; then
            echo "Found location emoji: $LOCATION_EMOJI"
        fi
        if [[ -n "$FEDERATION_EMOJI" ]]; then
            echo "Found federation emoji: $FEDERATION_EMOJI"
        fi
    fi

    printf '%s\n' \
        'module.exports = {' \
        '  apps: [' >>"$ecosystem_config"

    # Port mapping for each service (using defaults from original repos)
    declare -A service_ports=(
        [julia]=3000
        [continuebee]=2999
        [fount]=3006
        [bdo]=3003
        [joan]=3004
        [addie]=3005
        [pref]=3002
        [dolores]=3007
        [prof]=3008
        [covenant]=3011
        [minnie]=2525
        [aretha]=7277
        [sanora]=7243
    )

    for service in "${services[@]}"; do
        port="${service_ports[$service]}"

        if [[ $service == 'addie' ]]; then
            env="{
                LOCALHOST: 'true',
                PORT: '$port',
                STRIPE_KEY: '<api key here>',
                STRIPE_PUBLISHING_KEY: '<publishing key here>',
                SQUARE_KEY: '<api key here>'
            }"
        elif [[ $service == 'bdo' && -n "$LOCATION_EMOJI" && -n "$FEDERATION_EMOJI" ]]; then
            # Pass location emoji and federation emoji to BDO service
            env="{
                LOCALHOST: 'true',
                PORT: '$port',
                BDO_BASE_EMOJI: '$LOCATION_EMOJI',
                BDO_FEDERATION_EMOJI: '$FEDERATION_EMOJI'
            }"
        else
            env="{
                LOCALHOST: 'true',
                PORT: '$port'
            }"
        fi

        printf '%s\n' \
            "    {" \
            "      name: '$service'," \
            "      script: '$buildDir/$service/src/server/node/${service}.js'," \
            "      env: $env" \
            "    }," >>"$ecosystem_config"
    done

    printf '%s\n' '    ]' \
        '}' >>"$ecosystem_config"
} # setup_ecosystem

main() {
    setup_services
    setup_ecosystem

    # Start with pm2 daemon (allows pm2 logs, pm2 status, etc.)
    echo "Starting PM2 with ecosystem config..."
    ./node_modules/.bin/pm2 start ecosystem.config.js

    # Wait a moment for services to start
    echo "Waiting for services to initialize..."
    sleep 5

    # Show PM2 status
    ./node_modules/.bin/pm2 status

    echo "✅ Allyabase services launched successfully"
    echo "Services are running in PM2 daemon mode"
    echo "Use 'pm2 status' to check service status"
    echo "Use 'pm2 logs' to view logs"

    # Don't block - exit cleanly so wiki plugin can track the setup script's PID
    # PM2 daemon will keep services running in the background
    exit 0
}; main
