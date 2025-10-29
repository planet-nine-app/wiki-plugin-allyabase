# wiki-plugin-allyabase

Allyabase management plugin for Federated Wiki.

This plugin provides a convenient interface for launching and monitoring your local Allyabase instance directly from the wiki.

## Features

- **Launch a Base**: One-click button to run the allyabase_setup.sh script
- **Service Healthcheck**: Real-time monitoring of all 14 miniservices
- **Auto-refresh**: Status updates every 30 seconds
- **Service Details**: Shows port and HTTP status for each service
- **Federated Emojishortcodes**: Decentralized resource discovery using emoji-based identifiers (see [FEDERATION.md](./FEDERATION.md))
- **Federated BDO Resolution**: Cross-wiki BDO (Basic Data Object) fetching using emoji-based identifiers

## Services Monitored

The plugin monitors the following services:

- julia (port 3000)
- continuebee (port 2999)
- fount (port 3002)
- bdo (port 3003)
- joan (port 3004)
- addie (port 3005)
- pref (port 3006)
- dolores (port 3007)
- prof (port 3008)
- covenant (port 3011)
- minnie (port 2525)
- aretha (port 7277)
- sanora (port 7243)
- wiki (port 3333)

## Installation

```bash
npm install wiki-plugin-allyabase
```

## Configuration

The plugin includes the `allyabase_setup.sh` script bundled within the package, so no external dependencies are required. The script will be run from the plugin's installation directory.

## Usage

Add the plugin to your wiki page by creating an `allyabase` item. The plugin will display:

1. A "Launch a Base" button to start all services
2. A status panel showing which services are running
3. Automatic health checks with visual indicators (✅/❌)

## API Endpoints

### Allyabase Management

#### POST /plugin/allyabase/launch
Launches the allyabase setup script.

#### GET /plugin/allyabase/healthcheck
Returns the current health status of all services.

#### GET /plugin/allyabase/status
Returns the overall base status including last launch time.

### Service Proxies

All allyabase services are accessible via proxy routes:

- `/plugin/allyabase/julia/*` → julia service
- `/plugin/allyabase/bdo/*` → bdo service
- `/plugin/allyabase/fount/*` → fount service
- (and so on for all 14 services)

### Federated BDO Endpoints

#### GET /plugin/allyabase/bdo/emoji/:emojicode

Fetch a BDO by its emojicode, with automatic federation support.

**Emojicode Format**: `💚[3-location-emoji][5-uuid-emoji]`

Example: `💚☮️🌙🎸🔔🔫🕕🕓🚅`

**How it works:**

1. Extracts the 9 emoji from the emojicode
2. First emoji (💚) is the federation prefix
3. Next 3 emoji identify the wiki location (e.g., ☮️🌙🎸)
4. Remaining 5 emoji identify the BDO UUID
5. Looks up the location identifier in the federation registry
6. If the BDO is on this wiki, fetches locally
7. If the BDO is on a remote wiki, forwards the request automatically

**Response:**
```json
{
  "emojicode": "💚☮️🌙🎸🔔🔫🕕🕓🚅",
  "pubKey": "029dd60e726cbcc00fc486e158751d290172cc92733a3be4a5d18a2ef07e097f73",
  "bdo": {
    "data": "Test BDO data",
    "timestamp": 1761676196398
  },
  "createdAt": 1761676196526
}
```

**Key Features:**
- Automatic cross-wiki resolution
- Location-based routing using emoji identifiers
- Transparent local vs. remote detection
- Compatible with Docker networking (host.docker.internal)

### Federation

The plugin includes a federated emojishortcode system for decentralized resource discovery. See [FEDERATION.md](./FEDERATION.md) for complete documentation.

#### POST /plugin/allyabase/federation/register
Register a location identifier for this wiki.

#### GET /plugin/allyabase/federation/location/:identifier
Get the URL for a specific location identifier.

#### GET /plugin/allyabase/federation/locations
Get all registered location mappings.

#### POST /plugin/allyabase/federation/resolve
Resolve a federated shortcode to a full URL.

#### POST /plugin/allyabase/federation/parse
Parse a federated shortcode without resolving it.

## Development

This plugin follows the standard wiki-plugin structure:

- `client/allyabase.js` - Client-side code for the wiki interface
- `server/server.js` - Server-side endpoints for launching and monitoring
- `factory.json` - Plugin metadata

## License

MIT
