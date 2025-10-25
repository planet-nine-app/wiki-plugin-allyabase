# wiki-plugin-allyabase - Claude Documentation

## Overview

The `wiki-plugin-allyabase` is a Federated Wiki plugin that provides:

1. **Allyabase Management**: Launch and manage the Allyabase ecosystem of microservices
2. **Federation via Emojishortcodes**: A distributed location resolution system using emoji identifiers
3. **Service Proxying**: Routes to all 14 Allyabase microservices through the wiki

## Architecture

### Plugin Structure

```
wiki-plugin-allyabase/
├── factory.json              # Plugin metadata
├── package.json              # NPM dependencies
├── allyabase_setup.sh        # Script to launch all microservices
├── client/                   # Client-side code
│   ├── allyabase.js         # Main UI for base management
│   ├── federation.js        # Client-side federation resolver
│   └── emoji-favicon.js     # Dynamic emoji favicon utility
├── server/                   # Server-side code
│   ├── server.js            # Main server with routes
│   └── federation-resolver.js # Core federation logic
└── test/                     # Docker-based test environment
    ├── docker-compose.yml
    ├── Dockerfile
    ├── start-test-environment.sh
    ├── setup-federation.sh
    └── federation-dashboard/
```

### Key Components

#### Server-Side (`server/server.js`)

**Endpoints:**

- `POST /plugin/allyabase/launch` - Launch the Allyabase ecosystem
- `GET /plugin/allyabase/healthcheck` - Check status of all services
- `GET /plugin/allyabase/status` - Get current base status

**Federation Endpoints:**

- `POST /plugin/allyabase/federation/register` - Register a location identifier
  - Body: `{"locationIdentifier": "☮️🏴‍☠️👽", "url": "http://example.com"}`

- `GET /plugin/allyabase/federation/location/:identifier` - Get URL for a location
  - Returns: `{"locationIdentifier": "☮️🏴‍☠️👽", "url": "http://example.com"}`

- `GET /plugin/allyabase/federation/locations` - Get all registered locations
  - Returns: `{"☮️🏴‍☠️👽": "http://example.com", ...}`

- `POST /plugin/allyabase/federation/resolve` - Resolve a federated shortcode
  - Body: `{"shortcode": "💚☮️🏴‍☠️👽/resource", "currentWikiUrl": "http://localhost:7070"}`
  - Returns: `{"success": true, "resolvedUrl": "http://example.com/resource"}`

- `POST /plugin/allyabase/federation/parse` - Parse shortcode without resolving
  - Body: `{"shortcode": "💚☮️🏴‍☠️👽/test"}`
  - Returns: `{"success": true, "federationPrefix": "💚", "locationIdentifier": "☮️🏴‍☠️👽", "resourcePath": "/test"}`

**Service Proxies:**

All 14 microservices are proxied through the wiki:

- `/plugin/allyabase/julia/*` → `http://localhost:3000/*`
- `/plugin/allyabase/continuebee/*` → `http://localhost:2999/*`
- `/plugin/allyabase/fount/*` → `http://localhost:3002/*`
- `/plugin/allyabase/bdo/*` → `http://localhost:3003/*`
- `/plugin/allyabase/joan/*` → `http://localhost:3004/*`
- `/plugin/allyabase/addie/*` → `http://localhost:3005/*`
- `/plugin/allyabase/pref/*` → `http://localhost:3006/*`
- `/plugin/allyabase/dolores/*` → `http://localhost:3007/*`
- `/plugin/allyabase/prof/*` → `http://localhost:3008/*`
- `/plugin/allyabase/covenant/*` → `http://localhost:3011/*`
- `/plugin/allyabase/minnie/*` → `http://localhost:2525/*`
- `/plugin/allyabase/aretha/*` → `http://localhost:7277/*`
- `/plugin/allyabase/sanora/*` → `http://localhost:7243/*`
- `/plugin/allyabase/wiki/*` → `http://localhost:3333/*`

#### Federation Resolver (`server/federation-resolver.js`)

**Core Concepts:**

1. **Federated Emojishortcodes**: A distributed naming system using emoji
   - Format: `💚[3-emoji-location][resource-path]`
   - Example: `💚☮️🏴‍☠️👽/test` → `http://localhost:7070/test`

2. **Location Identifiers**: 3-emoji sequences that identify wiki locations
   - `☮️🏴‍☠️👽` (Peace Pirate Alien)
   - `🌈🦄✨` (Rainbow Unicorn Sparkle)
   - `🔥💎🌟` (Fire Diamond Star)
   - `🌊🐬🎨` (Ocean Dolphin Art)
   - `🎭🎪🎡` (Theater Circus Ferris)

3. **Discovery Algorithm**: Breadth-first search through wiki neighborhood
   - Checks local cache first
   - Queries current wiki
   - Traverses neighborhood up to 3 hops
   - Caches discovered mappings

**Critical Implementation Details:**

The emoji extraction regex must handle complex multi-codepoint emoji, especially ZWJ (Zero-Width Joiner) sequences like the pirate flag `🏴‍☠️`:

```javascript
const emojiRegex = /[\u{1F1E6}-\u{1F1FF}]{2}|(?:[\u{1F3F4}\u{1F3F3}][\u{FE0F}]?(?:\u{200D}[\u{2620}\u{2695}\u{2696}\u{2708}\u{1F308}][\u{FE0F}]?)?)|(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u{200D}(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/gu;
```

This regex properly handles:
- Regional indicator pairs (country flags)
- ZWJ sequences (pirate flag, skin tones, etc.)
- Variation selectors
- Simple emoji

**Without proper ZWJ handling**, `🏴‍☠️` gets split into separate components, breaking location resolution.

#### Client-Side (`client/allyabase.js`)

Provides a UI for:
- Launching the Allyabase ecosystem
- Viewing service health status
- Auto-refreshing status every 30 seconds
- Visual indicators (🟢 running, 🔴 not running, ⏱️ timeout)

#### Emoji Favicon (`client/emoji-favicon.js`)

Dynamically sets the wiki's favicon to an emoji:

```javascript
setEmojiFavicon('☮️')  // Sets peace sign as favicon
```

Functions:
- `setEmojiFavicon(emoji)` - Set any emoji as favicon
- `setTestWikiFavicon()` - Auto-set favicon in test environment
- `getLocationEmoji(url)` - Get emoji for a wiki URL

## Test Environment

### Docker Setup

The test environment creates 5 federated wikis:

**With allyabase plugin (ports 7070-7072):**
- Wiki 1: `☮️🏴‍☠️👽` (http://localhost:7070)
- Wiki 2: `🌈🦄✨` (http://localhost:7071)
- Wiki 3: `🔥💎🌟` (http://localhost:7072)

**Plain wikis (ports 7073-7074):**
- Wiki 4: `🌊🐬🎨` (http://localhost:7073)
- Wiki 5: `🎭🎪🎡` (http://localhost:7074)

### Running the Tests

```bash
cd test

# Start environment with automatic federation setup
./start-test-environment.sh --clean --federate

# Start clean without federation
./start-test-environment.sh --clean

# Manually setup federation after start
./setup-federation.sh
```

### What the Tests Do

1. **Registration**: Registers all 5 location identifiers on wikis 1-3
2. **Verification**: Verifies each wiki can look up all locations
3. **Resolution**: Tests full shortcode resolution from Wiki 1

Expected results:
- Registrations: 15/15 (3 wikis × 5 locations)
- Verifications: 15/15 (3 wikis × 5 locations)
- Resolutions: 5/5 (all locations resolve correctly)

### Key Implementation Details for Tests

1. **Plugin Loading**: Federated Wiki uses lazy loading for plugins
   - Plugins only load when a page uses them
   - Solution: Create an "allyabase" page on each wiki
   - Visit the page via curl to trigger plugin initialization

2. **Plugin Installation**: Wiki looks for plugins in its own `node_modules`
   - Cannot use global npm install or `npm link`
   - Must install directly: `/usr/local/lib/node_modules/wiki/node_modules/wiki-plugin-allyabase`

3. **Health Checks**: Wiki returns HTTP 302 (redirect) on homepage
   - Health check must accept 200, 302, or 404 as "healthy"

4. **Timing**: Plugins need time to initialize
   - Create pages
   - Visit pages to trigger loading
   - Wait 5 seconds for plugin servers to start
   - Then run federation tests

### Dockerfile

The Dockerfile installs the plugin into the wiki's node_modules:

```dockerfile
RUN WIKI_PATH=$(npm root -g)/wiki/node_modules && \
    mkdir -p $WIKI_PATH/wiki-plugin-allyabase

# Copy source and install dependencies
COPY ../package.json /tmp/allyabase-temp/package.json
# ... copy all files

RUN cd /tmp/allyabase-temp && \
    npm install && \
    WIKI_PATH=$(npm root -g)/wiki/node_modules && \
    cp -r /tmp/allyabase-temp/* $WIKI_PATH/wiki-plugin-allyabase/
```

## Federation Dashboard

A comprehensive monitoring tool at http://localhost:9090 (when running):

```bash
cd federation-dashboard
node server.js
```

Features:
- Network visualization of all wikis
- Location registry viewer
- Live shortcode resolution testing
- Activity log
- Health monitoring
- Success rate statistics

## Signin Server

Simple authentication management at http://localhost:8080:

```bash
cd signin-server
node server.js
```

Features:
- Sign in to any test wiki
- Automatic sign-out from others (sessionless security)
- Pre-configured test credentials for all 5 wikis

## Common Issues & Solutions

### Plugin Not Loading

**Problem**: Federation endpoints return 404

**Solution**:
1. Verify plugin is installed in wiki's node_modules:
   ```bash
   docker exec fedwiki-test-1 ls -la /usr/local/lib/node_modules/wiki/node_modules/ | grep allyabase
   ```

2. Create and visit an allyabase page to trigger loading:
   ```bash
   ./create-allyabase-pages.sh
   ```

3. Check logs for "starting plugin wiki-plugin-allyabase":
   ```bash
   docker-compose logs wiki1 | grep "starting plugin"
   ```

### Emoji Extraction Issues

**Problem**: Location identifiers with complex emoji (like 🏴‍☠️) fail to resolve

**Solution**: Use the comprehensive emoji regex that handles ZWJ sequences. The pirate flag `🏴‍☠️` is actually:
- `\u{1F3F4}` (Black Flag)
- `\u{200D}` (Zero Width Joiner)
- `\u{2620}` (Skull and Crossbones)
- `\u{FE0F}` (Variation Selector)

The regex must treat this as a single emoji, not split it apart.

### Health Check Failures

**Problem**: Wikis appear to be running but health checks fail

**Solution**: Wiki returns HTTP 302 (redirect) on root path. Accept 302 as healthy:

```bash
if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|302\|404"; then
  return 0  # Healthy
fi
```

## Future Enhancements

1. **Persistent Storage**: Federation mappings currently stored in memory
   - Consider: Redis, SQLite, or file-based storage

2. **NPM Publication**: Publish plugin to npm for easier installation
   - `npm install wiki-plugin-allyabase`

3. **Federation Protocol**: Standardize the federation API
   - Could be adopted by other wiki plugins

4. **Discovery Optimization**: Cache neighborhood graphs
   - Reduce redundant queries

5. **Security**: Authentication for federation endpoints
   - Prevent unauthorized location registration

## Resources

- [Federated Wiki](http://fed.wiki.org)
- [Wiki Plugin Development](http://plugins.fed.wiki.org)
- [Emoji Regex Guide](https://github.com/mathiasbynens/emoji-regex)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## Success Metrics

A fully working federation test should show:

```
==================================================
🎉 Federation Test Complete!
==================================================

Summary:
  Registrations: 15/15
  Verifications: 15/15
  Resolutions:   5/5

✅ All tests passed!

🌐 Federation is working correctly!

You can now use emojicodes like:
  💚☮️🏴‍☠️👽/resource → http://localhost:7070/resource
  💚🌈🦄✨/resource → http://localhost:7071/resource
  💚🔥💎🌟/resource → http://localhost:7072/resource
  💚🌊🐬🎨/resource → http://localhost:7073/resource
  💚🎭🎪🎡/resource → http://localhost:7074/resource
```

This represents a fully functional federated wiki network with distributed emoji-based location resolution!
