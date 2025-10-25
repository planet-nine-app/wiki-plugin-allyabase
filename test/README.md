# Federated Wiki Test Environment

This directory contains a Docker-based test environment for running three federated wiki instances to test the wiki-plugin-allyabase plugin.

## Overview

The test environment creates:
- 5 Docker containers running Federated Wiki
- Wikis 1-3 (ports 7070, 7071, 7072) have wiki-plugin-allyabase installed
- Wikis 4-5 (ports 7073, 7074) are plain wikis without the allyabase plugin
- All wiki instances can federate with each other
- All wikis have wiki-security-sessionless pre-installed

## Prerequisites

- Docker and Docker Compose installed
- The wiki-plugin-allyabase source code in the parent directory

## Quick Start

### Start the environment

```bash
cd test
./start-test-environment.sh
```

### Start with clean slate (removes all data)

```bash
./start-test-environment.sh --clean
```

### Start with federation setup

```bash
./start-test-environment.sh --federate
```

This will:
1. Start all 5 wiki instances
2. Wait for them to fully initialize
3. Register emojicodes for each wiki
4. Verify the federation is working
5. Run test scenarios to ensure cross-wiki resolution works

### Combine flags

```bash
./start-test-environment.sh --clean --federate
```

## Access the Wikis

Once started, the wikis are available at:

**With allyabase plugin:**
- **Wiki 1**: http://localhost:7070
- **Wiki 2**: http://localhost:7071
- **Wiki 3**: http://localhost:7072

**Plain wikis (no allyabase plugin):**
- **Wiki 4**: http://localhost:7073
- **Wiki 5**: http://localhost:7074

## Signin Server

A simple signin server is provided to manage authentication across the test wikis.

### Start the signin server

```bash
cd signin-server
node server.js
```

Then open http://localhost:8080 in your browser.

### Using the Signin Server

- Click "Sign In" on any wiki card to authenticate with that wiki
- The wiki will open in a new tab with your credentials loaded
- Signing into one wiki automatically signs you out of all others
- Click "Sign Out" to clear authentication for a specific wiki

Each wiki has pre-configured test credentials stored in the signin server.

## Federation Dashboard

A comprehensive dashboard is available to monitor and test the federation:

### Start the dashboard

```bash
cd federation-dashboard
node server.js
```

Then open http://localhost:9090 in your browser.

### Dashboard Features

- **Network Visualization**: See all wikis in the federation and their connection status
- **Location Registry**: View all registered emojicodes and which wikis know about them
- **Live Testing**: Test shortcode resolution from any wiki
- **Activity Log**: Real-time log of all federation activities
- **Health Monitoring**: Status of each wiki and their registered locations
- **Statistics**: Success rates, resolution counts, and more

The dashboard auto-refreshes every 30 seconds and provides a complete view of your federation network.

## Testing Federation

### Basic Wiki Federation

1. Create a page on Wiki 1 at http://localhost:7070
2. On Wiki 2, create a link to `localhost:7070/welcome-visitors`
3. Click the link - you should see Wiki 1's page appear in Wiki 2's neighborhood
4. The wikis can now share and federate content

### Emojishortcode Federation

If you started with `--federate`, the wikis are configured with these emojicodes:

- Wiki 1: `☮️🏴‍☠️👽` (Peace Pirate Alien)
- Wiki 2: `🌈🦄✨` (Rainbow Unicorn Sparkle)
- Wiki 3: `🔥💎🌟` (Fire Diamond Star)
- Wiki 4: `🌊🐬🎨` (Ocean Dolphin Art)
- Wiki 5: `🎭🎪🎡` (Theater Circus Ferris)

You can now use federated shortcodes like:
- `💚☮️🏴‍☠️👽/resource` resolves to `http://localhost:7070/resource`
- `💚🌈🦄✨/api/users` resolves to `http://localhost:7071/api/users`
- `💚🔥💎🌟/welcome-visitors` resolves to `http://localhost:7072/welcome-visitors`

### Manual Federation Setup

To manually set up federation or test it yourself:

```bash
cd test
./setup-federation.sh
```

This script will:
1. Check all wikis are running
2. Register all emojicodes on all wikis
3. Verify registrations
4. Test cross-wiki resolution
5. Provide a detailed test report

## Testing the Allyabase Plugin

1. On Wiki 1, 2, or 3 (which have the plugin), create a new page
2. Add an "allyabase" item to the page
3. You should see the Allyabase Management interface with:
   - "Launch a Base" button
   - Service status panel
   - Healthcheck information
4. Note: Wikis 4 and 5 won't have the allyabase plugin, so you can test federation between wikis with and without the plugin

## Managing the Environment

### View logs from all wikis

```bash
docker-compose logs -f
```

### View logs from a specific wiki

```bash
docker-compose logs -f wiki1
docker-compose logs -f wiki2
docker-compose logs -f wiki3
```

### Stop the environment

```bash
docker-compose down
```

### Stop and remove all data

```bash
docker-compose down -v
```

### Restart a specific wiki

```bash
docker-compose restart wiki1
```

### Rebuild after code changes

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

## Directory Structure

```
test/
├── Dockerfile                    # Docker image with allyabase plugin
├── Dockerfile.plain              # Plain Docker image without plugin
├── docker-compose.yml            # Multi-container configuration
├── start-test-environment.sh     # Startup script
├── wiki-configs/                 # Pre-configured owner.json files
│   ├── wiki1/status/owner.json
│   ├── wiki2/status/owner.json
│   ├── wiki3/status/owner.json
│   ├── wiki4/status/owner.json
│   └── wiki5/status/owner.json
├── signin-server/                # Simple signin management UI
│   ├── server.js                 # HTTP server
│   ├── index.html                # Signin UI
│   ├── app.js                    # Client logic
│   ├── keys.js                   # Test credentials
│   └── package.json
└── README.md                     # This file
```

## How It Works

1. **Dockerfile**: Creates an image with:
   - Node.js 18
   - Wiki installed globally
   - wiki-security-sessionless plugin
   - Local wiki-plugin-allyabase copied from parent directory

2. **docker-compose.yml**: Defines 3 services:
   - Each runs the same Docker image
   - Each exposed on different host ports (7070, 7071, 7072)
   - Each has its own persistent volume for data
   - All connected via a shared network for federation

3. **start-test-environment.sh**: Convenience script to:
   - Check Docker is running
   - Optionally clean existing containers
   - Build images
   - Start containers
   - Display access information

## Troubleshooting

### Containers won't start

Check if ports are already in use:
```bash
lsof -i :7070
lsof -i :7071
lsof -i :7072
```

### Plugin not loading

Check the logs for any errors:
```bash
docker-compose logs -f wiki1
```

### Need to reset everything

```bash
docker-compose down -v
./start-test-environment.sh --clean
```

## Notes

- Each wiki runs in isolation with its own data volume
- Changes to the plugin code require rebuilding: `docker-compose build`
- The wikis use sessionless security for easier testing
- All containers are on the same Docker network and can communicate
