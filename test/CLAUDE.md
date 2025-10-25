# wiki-plugin-allyabase Test Environment - Claude Documentation

## Overview

This test environment provides a complete Docker-based federation testing setup with 5 Federated Wiki instances, 3 of which have the allyabase plugin installed.

## Quick Start

```bash
# Start with automatic federation setup
./start-test-environment.sh --clean --federate

# Start clean without federation
./start-test-environment.sh --clean

# Manually setup federation after start
./setup-federation.sh
```

## Architecture

### Wiki Instances

**With allyabase plugin:**
- **Wiki 1** (http://localhost:7070) - Emoji: `☮️🏴‍☠️👽` (Peace Pirate Alien)
- **Wiki 2** (http://localhost:7071) - Emoji: `🌈🦄✨` (Rainbow Unicorn Sparkle)
- **Wiki 3** (http://localhost:7072) - Emoji: `🔥💎🌟` (Fire Diamond Star)

**Plain wikis (no plugin):**
- **Wiki 4** (http://localhost:7073) - Emoji: `🌊🐬🎨` (Ocean Dolphin Art)
- **Wiki 5** (http://localhost:7074) - Emoji: `🎭🎪🎡` (Theater Circus Ferris)

### Docker Configuration

**Files:**
- `Dockerfile` - Image with allyabase plugin (for wikis 1-3)
- `Dockerfile.plain` - Plain image without plugin (for wikis 4-5)
- `docker-compose.yml` - Multi-container orchestration

**Key Docker Implementation Details:**

The plugin MUST be installed in the wiki package's node_modules directory:

```dockerfile
# Install wiki globally
RUN npm install -g wiki

# Find wiki's node_modules and install plugin there
RUN WIKI_PATH=$(npm root -g)/wiki/node_modules && \
    mkdir -p $WIKI_PATH/wiki-plugin-allyabase

# Copy plugin source
COPY ../package.json /tmp/allyabase-temp/package.json
# ... (copy all files)

# Install dependencies and copy to wiki's node_modules
RUN cd /tmp/allyabase-temp && \
    npm install && \
    WIKI_PATH=$(npm root -g)/wiki/node_modules && \
    cp -r /tmp/allyabase-temp/* $WIKI_PATH/wiki-plugin-allyabase/
```

**Why this matters:**
- ❌ Global install (`npm install -g`) - Wiki can't find it
- ❌ npm link - Wiki can't find it
- ✅ Direct install in wiki's node_modules - Wiki finds it!

### Test Scripts

#### `start-test-environment.sh`

Main startup script with options:

```bash
./start-test-environment.sh [--clean] [--federate]
```

**Flags:**
- `--clean` - Remove all containers and volumes before starting
- `--federate` - Automatically setup and test federation

**What it does:**
1. Checks Docker is running
2. Optionally cleans up existing containers
3. Builds Docker images
4. Starts all 5 wiki containers
5. Waits for wikis to be HTTP-responsive
6. If `--federate`: Creates allyabase pages, triggers plugin load, runs federation setup

**Health Check:**

The script waits for wikis to respond with HTTP 200, 302, or 404:

```bash
check_wiki_health() {
  local url=$1
  # Accept 200, 302 (redirect), or 404 as healthy responses
  if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|302\|404"; then
    return 0
  else
    return 1
  fi
}
```

**Why 302?** Federated Wiki redirects the root path (`/`) to `/welcome-visitors`, returning HTTP 302. This is normal and healthy.

#### `create-allyabase-pages.sh`

Creates pages that use the allyabase plugin to trigger lazy loading:

```bash
./create-allyabase-pages.sh
```

**Critical for plugin loading:**

Federated Wiki uses lazy loading - plugins only initialize when a page uses them.

**What it does:**
1. Creates an "allyabase" page in each container's filesystem
2. Visits each page with curl to trigger plugin loading
3. Waits for plugin servers to initialize

**Page creation via Docker:**

```bash
# Write page JSON directly to container filesystem
echo "$page_data" | docker exec -i fedwiki-test-1 sh -c 'cat > /root/.wiki/pages/allyabase'

# Trigger plugin load by visiting page
curl -s http://localhost:7070/allyabase > /dev/null
```

**Why not use wiki API?** The wiki's PUT endpoint requires authentication. Direct filesystem write bypasses this.

#### `setup-federation.sh`

Registers and tests federation:

```bash
./setup-federation.sh
```

**Test Phases:**

1. **Health Check** (180 second timeout)
   - Waits for all 5 wikis to respond
   - Checks every 5 seconds
   - Shows progress

2. **Registration** (15 registrations)
   - Each of wikis 1-3 registers all 5 location identifiers
   - 3 wikis × 5 locations = 15 registrations
   - Uses POST `/plugin/allyabase/federation/register`

3. **Verification** (15 verifications)
   - Each of wikis 1-3 queries all 5 location identifiers
   - Confirms registrations stored correctly
   - Uses GET `/plugin/allyabase/federation/location/:identifier`

4. **Resolution** (5 resolutions)
   - From Wiki 1, resolves shortcodes for all 5 locations
   - Tests: `💚☮️🏴‍☠️👽/test`, `💚🌈🦄✨/test`, etc.
   - Uses POST `/plugin/allyabase/federation/resolve`

**Expected Results:**

```
Registration Summary: 15/15 successful
Verification Summary: 15/15 successful
Resolution Summary: 5/5 successful

✅ All tests passed!
```

### Supporting Tools

#### Federation Dashboard

Comprehensive monitoring at http://localhost:9090:

```bash
cd federation-dashboard
node server.js
```

Features:
- Network visualization (D3.js force graph)
- Location registry table
- Live shortcode resolver
- Activity log
- Health monitoring
- Statistics

**How it works:**
- Queries all wikis for their registered locations
- Shows which wikis know about which locations
- Visualizes federation network topology
- Auto-refreshes every 30 seconds

#### Signin Server

Authentication manager at http://localhost:8080:

```bash
cd signin-server
node server.js
```

Features:
- Click to sign in to any wiki
- Automatic sign-out from others (sessionless security)
- Opens wiki in new tab with credentials loaded

**Pre-configured keys:**

Each wiki has a keypair stored in `signin-server/keys.js`:

```javascript
{
  "http://localhost:7070": {
    name: "wiki1-testuser",
    secret: "...",
    pubKey: "..."
  },
  // ... for all 5 wikis
}
```

These match the `owner.json` files mounted in each container.

## Owner.json Files

Each wiki has a pre-configured owner.json:

```
wiki-configs/
├── wiki1/status/owner.json
├── wiki2/status/owner.json
├── wiki3/status/owner.json
├── wiki4/status/owner.json
└── wiki5/status/owner.json
```

These are mounted as volumes in docker-compose:

```yaml
volumes:
  - wiki1-data:/root/.wiki
  - ./wiki-configs/wiki1/status/owner.json:/root/.wiki/status/owner.json
```

Each contains sessionless security keys:

```json
{
  "sessionlessKeys": {
    "pubKey": "...",
    "secretKey": "..."
  }
}
```

## Troubleshooting

### Plugin Not Loading

**Symptom:** Federation endpoints return 404

**Diagnosis:**
```bash
# Check if plugin is installed
docker exec fedwiki-test-1 ls -la /usr/local/lib/node_modules/wiki/node_modules/ | grep allyabase

# Check wiki logs
docker-compose logs wiki1 | grep "starting plugin"
```

**Solution:**
```bash
# Rebuild with --no-cache to force fresh install
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Then create pages and trigger loading
./create-allyabase-pages.sh
```

### Wikis Not Responding

**Symptom:** Health check timeout after 120 seconds

**Diagnosis:**
```bash
# Check container status
docker-compose ps

# Check logs for errors
docker-compose logs wiki1
```

**Common causes:**
- Port already in use: `lsof -i :7070`
- Docker not running: `docker info`
- Container crashed: Check logs for errors

### Federation Tests Failing

**Symptom:** Registrations work but resolutions fail

**Diagnosis:**
```bash
# Check if registration worked
curl http://localhost:7070/plugin/allyabase/federation/locations

# Try manual resolution
curl -X POST http://localhost:7070/plugin/allyabase/federation/resolve \
  -H "Content-Type: application/json" \
  -d '{"shortcode":"💚🌈🦄✨/test","currentWikiUrl":"http://localhost:7070"}'
```

**Common causes:**
- Emoji encoding issues (ZWJ sequences not handled)
- Cache not populated
- Network issues between containers

### Emoji Display Issues

**Symptom:** Emoji show as boxes or question marks in terminal

**Solution:** Use a terminal with good Unicode support:
- macOS Terminal (default is good)
- iTerm2
- VS Code integrated terminal

**Note:** This doesn't affect functionality, only display.

## Testing Workflow

### Full Clean Test

```bash
# 1. Stop everything
docker-compose down -v

# 2. Start with full federation
./start-test-environment.sh --clean --federate

# 3. Watch output for:
#    - ✓ Page created successfully (3 times)
#    - ✓ Plugin load triggered
#    - Registration Summary: 15/15
#    - Verification Summary: 15/15
#    - Resolution Summary: 5/5
```

### Manual Testing

```bash
# 1. Start without federation
./start-test-environment.sh --clean

# 2. Visit a wiki in browser
open http://localhost:7070

# 3. Create allyabase pages
./create-allyabase-pages.sh

# 4. Setup federation
./setup-federation.sh

# 5. Use dashboard
cd federation-dashboard
node server.js
open http://localhost:9090
```

### Testing Changes to Plugin

```bash
# 1. Make changes to plugin code in parent directory
# 2. Rebuild Docker images
docker-compose down
docker-compose build
docker-compose up -d

# 3. Create pages and test
./create-allyabase-pages.sh
sleep 5
./setup-federation.sh
```

**Note:** Changes to server code require rebuild. Changes to client code may be cached - do full rebuild if issues.

## Performance Considerations

### Build Time

- First build: ~30-60 seconds (downloads base image)
- Subsequent builds: ~5-10 seconds (cached layers)
- With `--no-cache`: ~30 seconds (forces fresh npm install)

### Startup Time

- Containers start: ~5 seconds
- Wikis HTTP-responsive: ~5-10 seconds
- Plugin loading: ~5 seconds after page visit
- Total ready time: ~15-20 seconds

### Test Execution

- Registration phase: ~2 seconds (15 requests)
- Verification phase: ~2 seconds (15 requests)
- Resolution phase: ~2 seconds (5 requests)
- Total test time: ~6-8 seconds

## Advanced Usage

### Custom Emoji Locations

Edit `setup-federation.sh` to use different emoji:

```bash
WIKI_EMOJIS=("🚀🌙⭐" "🌍🌊🏔️" "🔮🎯🎲" "🌊🐬🎨" "🎭🎪🎡")
```

**Important:** Use exactly 3 emoji per location!

### Adding More Wikis

1. Add to `docker-compose.yml`:
```yaml
wiki6:
  build:
    context: ..
    dockerfile: test/Dockerfile
  container_name: fedwiki-test-6
  ports:
    - "7075:3000"
  volumes:
    - wiki6-data:/root/.wiki
    - ./wiki-configs/wiki6/status/owner.json:/root/.wiki/status/owner.json
```

2. Create `wiki-configs/wiki6/status/owner.json`

3. Update test scripts with new wiki URL and emoji

### Custom Test Scenarios

Create custom test scripts based on `setup-federation.sh`:

```bash
#!/bin/bash
# Test specific federation scenario

# Register only on Wiki 1
curl -X POST http://localhost:7070/plugin/allyabase/federation/register \
  -H "Content-Type: application/json" \
  -d '{"locationIdentifier":"🎯🎪🎡","url":"http://example.com"}'

# Test resolution from Wiki 2
curl -X POST http://localhost:7071/plugin/allyabase/federation/resolve \
  -H "Content-Type: application/json" \
  -d '{"shortcode":"💚🎯🎪🎡/test","currentWikiUrl":"http://localhost:7071"}'
```

## Success Metrics

A fully working test environment shows:

```
🎉 Federation Test Complete!

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

This proves:
- ✅ Plugin installed correctly in all 3 wikis
- ✅ Emoji extraction handles complex ZWJ sequences
- ✅ Federation discovery works across wiki network
- ✅ Caching and resolution functioning properly
- ✅ Cross-wiki communication established

Congratulations! You have a working federated wiki network with emoji-based distributed location resolution! 🎉
