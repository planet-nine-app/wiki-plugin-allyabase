# Federated Emojishortcode System

The wiki-plugin-allyabase implements a federated naming system using emojishortcodes to enable resource discovery across a network of federated wikis.

## Overview

The federation system uses emoji sequences to create human-memorable, decentralized identifiers for wikis and their resources. This allows wikis to reference each other without hardcoding URLs, leveraging the federated wiki neighborhood mechanism for discovery.

## Emojishortcode Format

```
💚 + [3 emoji location] + [resource path]
```

### Components

1. **Federation Prefix** (`💚`): Indicates this is a federated emojishortcode
2. **Location Identifier** (3 emoji): A unique emoji sequence identifying the wiki
3. **Resource Path**: The path to the specific resource on that wiki

### Example

```
💚☮️🏴‍☠️👽/api/users/123
```

- `💚` = Federation namespace
- `☮️🏴‍☠️👽` = Location identifier (maps to a wiki URL)
- `/api/users/123` = Resource path on that wiki

## How It Works

### 1. Registration

Each wiki registers its location identifier mapping:

```javascript
// Register this wiki's location
await fetch('/plugin/allyabase/federation/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    locationIdentifier: '☮️🏴‍☠️👽',
    url: 'http://wiki1.example.com'
  })
});
```

### 2. Discovery

When a wiki receives a federated shortcode it hasn't seen before:

1. **Check local cache**: See if we've resolved this location before
2. **Query neighborhood**: Ask wikis in the neighborhood if they know the mapping
3. **Breadth-first search**: Recursively query neighbors' neighbors (up to 3 hops)
4. **Cache result**: Store the discovered mapping for future use

### 3. Resolution

Once the location is discovered, the full URL is constructed:

```
Input:  💚☮️🏴‍☠️👽/api/users/123
Output: http://wiki1.example.com/api/users/123
```

## API Reference

### Server Endpoints

#### POST /plugin/allyabase/federation/register

Register a location identifier for this wiki.

**Request:**
```json
{
  "locationIdentifier": "☮️🏴‍☠️👽",
  "url": "http://wiki1.example.com"
}
```

**Response:**
```json
{
  "success": true,
  "locationIdentifier": "☮️🏴‍☠️👽",
  "url": "http://wiki1.example.com"
}
```

#### GET /plugin/allyabase/federation/location/:identifier

Get the URL for a specific location identifier.

**Response:**
```json
{
  "locationIdentifier": "☮️🏴‍☠️👽",
  "url": "http://wiki1.example.com"
}
```

#### GET /plugin/allyabase/federation/locations

Get all registered location mappings.

**Response:**
```json
{
  "☮️🏴‍☠️👽": "http://wiki1.example.com",
  "🌈🦄✨": "http://wiki2.example.com"
}
```

#### POST /plugin/allyabase/federation/resolve

Resolve a federated shortcode to a full URL.

**Request:**
```json
{
  "shortcode": "💚☮️🏴‍☠️👽/api/users/123",
  "currentWikiUrl": "http://localhost:7070"
}
```

**Response:**
```json
{
  "success": true,
  "shortcode": "💚☮️🏴‍☠️👽/api/users/123",
  "resolvedUrl": "http://wiki1.example.com/api/users/123"
}
```

#### POST /plugin/allyabase/federation/parse

Parse a federated shortcode without resolving it.

**Request:**
```json
{
  "shortcode": "💚☮️🏴‍☠️👽/api/users/123"
}
```

**Response:**
```json
{
  "success": true,
  "federationPrefix": "💚",
  "locationIdentifier": "☮️🏴‍☠️👽",
  "resourcePath": "/api/users/123"
}
```

### Client-Side API

```javascript
// Check if a shortcode is federated
const isFederated = window.federationResolver.isFederatedShortcode('💚☮️🏴‍☠️👽/resource');

// Parse a shortcode
const parsed = window.federationResolver.parseFederatedShortcode('💚☮️🏴‍☠️👽/resource');
// Returns: { federationPrefix: '💚', locationIdentifier: '☮️🏴‍☠️👽', resourcePath: '/resource' }

// Resolve a shortcode to a URL
const url = await window.federationResolver.resolveFederatedShortcode('💚☮️🏴‍☠️👽/resource');
// Returns: 'http://wiki1.example.com/resource'

// Register a location
await window.federationResolver.registerLocation('☮️🏴‍☠️👽', 'http://wiki1.example.com');

// Get all locations
const locations = await window.federationResolver.getRegisteredLocations();
```

## Discovery Algorithm

The federation resolver uses a breadth-first search algorithm to discover location mappings:

```
1. Start at current wiki
2. Check if location is known locally
3. If not found:
   a. Get neighborhood wikis
   b. Query each neighbor for the location
   c. If found, cache and return
   d. If not found and hops < max_hops:
      - Get each neighbor's neighborhood
      - Add to queue for next iteration
4. Repeat until found or max_hops reached
```

Default max_hops: **3**

This ensures we can find locations efficiently while preventing infinite loops.

## Caching Strategy

Both server and client maintain location caches:

- **Server cache**: In-memory Map, persists during server lifetime
- **Client cache**: JavaScript Map, persists during page session

Caches store mappings like:
```
'☮️🏴‍☠️👽' → 'http://wiki1.example.com'
```

This dramatically speeds up repeated resolutions of the same location.

## Why Emoji?

1. **Human-memorable**: Easier to remember `☮️🏴‍☠️👽` than `a7c4e9f2`
2. **Visual**: Emoji are instantly recognizable
3. **Universal**: Work across languages and cultures
4. **Compact**: 3 emoji can represent millions of unique locations
5. **Fun**: Makes the federation more approachable

## Example Use Cases

### Cross-Wiki Resource References

```javascript
// Reference a user on another wiki
const userUrl = await resolveFederatedShortcode('💚☮️🏴‍☠️👽/users/alice');

// Reference a page
const pageUrl = await resolveFederatedShortcode('💚🌈🦄✨/welcome-visitors');

// Reference an API endpoint
const apiUrl = await resolveFederatedShortcode('💚🔥💎🌟/api/v1/status');
```

### Building a Federation Directory

```javascript
// Each wiki in the federation registers its location
await registerLocation('☮️🏴‍☠️👽', 'http://wiki1.example.com'); // Peace wiki
await registerLocation('🌈🦄✨', 'http://wiki2.example.com');     // Rainbow wiki
await registerLocation('🔥💎🌟', 'http://wiki3.example.com');     // Fire wiki
```

### Automated Discovery

Once wikis are part of the same neighborhood, they automatically discover each other's locations through the federation protocol.

## Security Considerations

1. **Trust Model**: Wikis trust their neighborhood
2. **Verification**: Location mappings are only accepted from wikis in the neighborhood
3. **No Central Authority**: Fully decentralized discovery
4. **Cache Poisoning**: Caches should be periodically validated
5. **DOS Prevention**: Max hops limit prevents infinite recursion

## Testing

The test environment includes 5 wikis that can be used to test federation:

```bash
cd test
./start-test-environment.sh
```

Register locations on each wiki:
- Wiki 1: `☮️🏴‍☠️👽` at http://localhost:7070
- Wiki 2: `🌈🦄✨` at http://localhost:7071
- Wiki 3: `🔥💎🌟` at http://localhost:7072
- Wiki 4: `🌊🐬🎨` at http://localhost:7073
- Wiki 5: `🎭🎪🎡` at http://localhost:7074

Then test resolution across the federation.

## Future Enhancements

1. **Persistence**: Save location mappings to disk
2. **TTL/Expiry**: Invalidate old mappings
3. **Metrics**: Track resolution success rates
4. **Visual Browser**: UI to explore the federation graph
5. **Smart Routing**: Choose shortest path in multi-hop scenarios
