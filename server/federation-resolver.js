/**
 * Federated Emojishortcode Resolver
 *
 * Resolves federated emojishortcodes in the format:
 * 💚[3-emoji-location][resource-identifier]
 *
 * Example: 💚☮️🏴‍☠️👽/some/resource
 * - 💚 = federation namespace indicator
 * - ☮️🏴‍☠️👽 = 3-emoji location identifier
 * - /some/resource = the resource path
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const FEDERATION_PREFIX = '💚';
const LOCATION_EMOJI_COUNT = 3;

// In-memory cache for emoji -> URL mappings
// Each location identifier maps to an array of URLs (max 9)
const locationCache = new Map();
const MAX_URLS_PER_LOCATION = 9;

// File-based persistence
const FEDERATION_FILE = path.join(process.env.HOME || '/root', '.wiki/federation-registry.json');

/**
 * Load federation registry from file
 */
function loadRegistry() {
  try {
    if (fs.existsSync(FEDERATION_FILE)) {
      const data = fs.readFileSync(FEDERATION_FILE, 'utf8');
      const registry = JSON.parse(data);

      // Restore to Map
      locationCache.clear();
      for (const [emoji, urls] of Object.entries(registry)) {
        locationCache.set(emoji, urls);
      }

      console.log(`[federation-resolver] Loaded ${Object.keys(registry).length} locations from ${FEDERATION_FILE}`);
      return true;
    }
  } catch (err) {
    console.error('[federation-resolver] Error loading registry:', err);
  }
  return false;
}

/**
 * Save federation registry to file
 */
function saveRegistry() {
  try {
    // Ensure directory exists
    const dir = path.dirname(FEDERATION_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Convert Map to plain object
    const registry = Object.fromEntries(locationCache);

    // Write to file
    fs.writeFileSync(FEDERATION_FILE, JSON.stringify(registry, null, 2), 'utf8');

    console.log(`[federation-resolver] Saved ${Object.keys(registry).length} locations to ${FEDERATION_FILE}`);
    return true;
  } catch (err) {
    console.error('[federation-resolver] Error saving registry:', err);
    return false;
  }
}

// Load registry on startup
loadRegistry();

/**
 * Extract emoji characters from a string
 * Handles complex emoji including ZWJ sequences (like 🏴‍☠️)
 */
function extractEmojis(str) {
  // More comprehensive emoji regex that handles:
  // - Single emoji
  // - Emoji with variation selectors
  // - ZWJ sequences (zero-width joiner, like flags, skin tones, etc.)
  // - Regional indicator pairs (flag emoji)
  const emojiRegex = /[\u{1F1E6}-\u{1F1FF}]{2}|(?:[\u{1F3F4}\u{1F3F3}][\u{FE0F}]?(?:\u{200D}[\u{2620}\u{2695}\u{2696}\u{2708}\u{1F308}][\u{FE0F}]?)?)|(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u{200D}(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/gu;

  const matches = str.match(emojiRegex) || [];
  return matches;
}

/**
 * Check if a shortcode is federated
 */
function isFederatedShortcode(shortcode) {
  const emojis = extractEmojis(shortcode);
  return emojis.length >= (LOCATION_EMOJI_COUNT + 1) && emojis[0] === FEDERATION_PREFIX;
}

/**
 * Parse a federated shortcode into its components
 */
function parseFederatedShortcode(shortcode) {
  if (!isFederatedShortcode(shortcode)) {
    return null;
  }

  const emojis = extractEmojis(shortcode);

  return {
    federationPrefix: emojis[0], // 💚
    locationIdentifier: emojis.slice(1, LOCATION_EMOJI_COUNT + 1).join(''), // Next 3 emoji
    resourcePath: shortcode.substring(shortcode.indexOf(emojis[LOCATION_EMOJI_COUNT]) + emojis[LOCATION_EMOJI_COUNT].length)
  };
}

/**
 * Fetch from a URL
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Query a wiki's neighborhood for the location mapping
 */
async function queryWikiForLocation(wikiUrl, locationIdentifier) {
  try {
    // Try to get the federation mapping from the wiki
    // This endpoint should return: { locationIdentifier: "☮️🏴‍☠️👽", url: "http://example.com" }
    const mappingUrl = `${wikiUrl}/plugin/allyabase/federation/location/${encodeURIComponent(locationIdentifier)}`;
    const mapping = await fetchUrl(mappingUrl);

    if (mapping && mapping.url) {
      return mapping.url;
    }
  } catch (err) {
    // This wiki doesn't have the mapping, or doesn't support federation
    return null;
  }

  return null;
}

/**
 * Get neighborhood wikis from a wiki
 */
async function getNeighborhood(wikiUrl) {
  try {
    // Federated wiki stores neighborhood in various ways
    // Try to fetch the sitemap which often contains neighborhood info
    const sitemapUrl = `${wikiUrl}/system/sitemap.json`;
    const sitemap = await fetchUrl(sitemapUrl);

    // Extract unique domains from the sitemap
    if (Array.isArray(sitemap)) {
      const domains = new Set();
      sitemap.forEach(item => {
        if (item.slug && item.slug.includes('.')) {
          // Extract domain from slug like "example.com/page-name"
          const domain = item.slug.split('/')[0];
          if (domain.includes('.')) {
            domains.add(`http://${domain}`);
          }
        }
      });
      return Array.from(domains);
    }
  } catch (err) {
    console.log('Could not fetch neighborhood from', wikiUrl, err.message);
  }

  return [];
}

/**
 * Discover location URLs by querying neighborhood (breadth-first search)
 * Returns array of URLs for this location
 */
async function discoverLocation(startWikiUrl, locationIdentifier, maxHops = 3) {
  // Check cache first (local registry)
  if (locationCache.has(locationIdentifier)) {
    const urls = locationCache.get(locationIdentifier);
    console.log(`Found location ${locationIdentifier} in local cache -> ${urls.join(', ')}`);
    return urls;
  }

  const visited = new Set();
  const queue = [{ url: startWikiUrl, hop: 0 }];
  const foundUrls = []; // Collect all URLs that respond for this location

  while (queue.length > 0) {
    const { url, hop } = queue.shift();

    if (visited.has(url) || hop > maxHops) {
      continue;
    }

    visited.add(url);

    console.log(`Querying ${url} for location ${locationIdentifier} (hop ${hop})`);

    // Query this wiki for the location
    const foundUrl = await queryWikiForLocation(url, locationIdentifier);

    if (foundUrl && !foundUrls.includes(foundUrl)) {
      console.log(`Found location ${locationIdentifier} -> ${foundUrl}`);
      foundUrls.push(foundUrl);

      // Don't return immediately - continue searching to find all URLs
      // But limit to MAX_URLS_PER_LOCATION
      if (foundUrls.length >= MAX_URLS_PER_LOCATION) {
        console.log(`Reached maximum URLs (${MAX_URLS_PER_LOCATION}) for location ${locationIdentifier}`);
        break;
      }
    }

    // Get this wiki's neighborhood and add to queue
    if (hop < maxHops) {
      const neighborhood = await getNeighborhood(url);
      neighborhood.forEach(neighborUrl => {
        if (!visited.has(neighborUrl)) {
          queue.push({ url: neighborUrl, hop: hop + 1 });
        }
      });
    }
  }

  // Cache all found URLs
  if (foundUrls.length > 0) {
    locationCache.set(locationIdentifier, foundUrls);
    console.log(`Cached ${foundUrls.length} URL(s) for location ${locationIdentifier}`);
    return foundUrls;
  }

  return [];
}

/**
 * Resolve a federated shortcode to a full URL
 * Returns first URL found (for backward compatibility)
 * Use discoverLocation directly to get all URLs
 */
async function resolveFederatedShortcode(shortcode, currentWikiUrl) {
  const parsed = parseFederatedShortcode(shortcode);

  if (!parsed) {
    throw new Error('Not a valid federated shortcode');
  }

  // Discover the base URLs for this location
  const baseUrls = await discoverLocation(currentWikiUrl, parsed.locationIdentifier);

  if (!baseUrls || baseUrls.length === 0) {
    throw new Error(`Could not find location ${parsed.locationIdentifier} in federation`);
  }

  // Return first URL for backward compatibility
  const baseUrl = baseUrls[0];

  // Construct the full URL
  return `${baseUrl}${parsed.resourcePath}`;
}

/**
 * Register this wiki's location identifier
 * Supports multiple URLs per location (max 9)
 */
function registerLocation(locationIdentifier, url) {
  // Get existing URLs for this location
  let urls = locationCache.get(locationIdentifier) || [];

  // Check if URL already registered
  if (urls.includes(url)) {
    console.log(`Location already registered: ${locationIdentifier} -> ${url}`);
    return { added: false, reason: 'already_exists', urlCount: urls.length };
  }

  // Check if we've hit the maximum
  if (urls.length >= MAX_URLS_PER_LOCATION) {
    console.warn(`⚠️  Maximum URLs (${MAX_URLS_PER_LOCATION}) reached for location: ${locationIdentifier}`);
    console.warn(`    Existing URLs: ${urls.join(', ')}`);
    console.warn(`    Rejected URL: ${url}`);
    return { added: false, reason: 'max_reached', urlCount: urls.length, maxUrls: MAX_URLS_PER_LOCATION };
  }

  // Add the new URL
  urls.push(url);
  locationCache.set(locationIdentifier, urls);
  console.log(`✓ Registered location: ${locationIdentifier} -> ${url} (${urls.length}/${MAX_URLS_PER_LOCATION})`);

  if (urls.length > 1) {
    console.log(`  ℹ️  Multiple URLs for ${locationIdentifier}: ${urls.join(', ')}`);
  }

  // Persist to file
  saveRegistry();

  return { added: true, urlCount: urls.length, maxUrls: MAX_URLS_PER_LOCATION };
}

/**
 * Get all registered locations
 */
function getRegisteredLocations() {
  return Object.fromEntries(locationCache);
}

module.exports = {
  isFederatedShortcode,
  parseFederatedShortcode,
  resolveFederatedShortcode,
  registerLocation,
  getRegisteredLocations,
  discoverLocation,
  extractEmojis,
  FEDERATION_PREFIX,
  LOCATION_EMOJI_COUNT
};
