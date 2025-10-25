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

const FEDERATION_PREFIX = '💚';
const LOCATION_EMOJI_COUNT = 3;

// In-memory cache for emoji -> URL mappings
const locationCache = new Map();

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
 * Discover location URL by querying neighborhood (breadth-first search)
 */
async function discoverLocation(startWikiUrl, locationIdentifier, maxHops = 3) {
  // Check cache first (local registry)
  if (locationCache.has(locationIdentifier)) {
    console.log(`Found location ${locationIdentifier} in local cache -> ${locationCache.get(locationIdentifier)}`);
    return locationCache.get(locationIdentifier);
  }

  const visited = new Set();
  const queue = [{ url: startWikiUrl, hop: 0 }];

  while (queue.length > 0) {
    const { url, hop } = queue.shift();

    if (visited.has(url) || hop > maxHops) {
      continue;
    }

    visited.add(url);

    console.log(`Querying ${url} for location ${locationIdentifier} (hop ${hop})`);

    // Query this wiki for the location
    const foundUrl = await queryWikiForLocation(url, locationIdentifier);

    if (foundUrl) {
      console.log(`Found location ${locationIdentifier} -> ${foundUrl}`);
      // Cache the result
      locationCache.set(locationIdentifier, foundUrl);
      return foundUrl;
    }

    // If not found, get this wiki's neighborhood and add to queue
    if (hop < maxHops) {
      const neighborhood = await getNeighborhood(url);
      neighborhood.forEach(neighborUrl => {
        if (!visited.has(neighborUrl)) {
          queue.push({ url: neighborUrl, hop: hop + 1 });
        }
      });
    }
  }

  return null;
}

/**
 * Resolve a federated shortcode to a full URL
 */
async function resolveFederatedShortcode(shortcode, currentWikiUrl) {
  const parsed = parseFederatedShortcode(shortcode);

  if (!parsed) {
    throw new Error('Not a valid federated shortcode');
  }

  // Discover the base URL for this location
  const baseUrl = await discoverLocation(currentWikiUrl, parsed.locationIdentifier);

  if (!baseUrl) {
    throw new Error(`Could not find location ${parsed.locationIdentifier} in federation`);
  }

  // Construct the full URL
  return `${baseUrl}${parsed.resourcePath}`;
}

/**
 * Register this wiki's location identifier
 */
function registerLocation(locationIdentifier, url) {
  locationCache.set(locationIdentifier, url);
  console.log(`Registered location: ${locationIdentifier} -> ${url}`);
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
