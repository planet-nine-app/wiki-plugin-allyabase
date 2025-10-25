/**
 * Client-side Federation Resolver
 *
 * Handles federated emojishortcode resolution in the browser
 */

const FEDERATION_PREFIX = '💚';
const LOCATION_EMOJI_COUNT = 3;

// Client-side cache for resolved locations
const locationCache = new Map();

/**
 * Extract emoji characters from a string
 */
function extractEmojis(str) {
  // Emoji regex that handles multi-codepoint emoji
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  return str.match(emojiRegex) || [];
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
 * Resolve a federated shortcode to a URL
 */
async function resolveFederatedShortcode(shortcode) {
  const parsed = parseFederatedShortcode(shortcode);

  if (!parsed) {
    throw new Error('Not a valid federated shortcode');
  }

  // Check cache first
  if (locationCache.has(parsed.locationIdentifier)) {
    const baseUrl = locationCache.get(parsed.locationIdentifier);
    return `${baseUrl}${parsed.resourcePath}`;
  }

  // Call server to resolve
  const response = await fetch('/plugin/allyabase/federation/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shortcode,
      currentWikiUrl: window.location.origin
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve shortcode: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to resolve shortcode');
  }

  // Cache the location for future use
  const parsed2 = parseFederatedShortcode(shortcode);
  const baseUrl = result.resolvedUrl.substring(0, result.resolvedUrl.indexOf(parsed2.resourcePath));
  locationCache.set(parsed2.locationIdentifier, baseUrl);

  return result.resolvedUrl;
}

/**
 * Register this wiki's location identifier
 */
async function registerLocation(locationIdentifier, url) {
  const response = await fetch('/plugin/allyabase/federation/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationIdentifier, url })
  });

  if (!response.ok) {
    throw new Error(`Failed to register location: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to register location');
  }

  // Cache locally too
  locationCache.set(locationIdentifier, url);

  return result;
}

/**
 * Get all registered locations
 */
async function getRegisteredLocations() {
  const response = await fetch('/plugin/allyabase/federation/locations');

  if (!response.ok) {
    throw new Error(`Failed to get locations: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Display federated shortcode resolution UI
 */
function createFederationUI($item) {
  const container = document.createElement('div');
  container.style.marginTop = '20px';
  container.style.padding = '15px';
  container.style.border = '1px solid #ddd';
  container.style.borderRadius = '5px';
  container.style.background = '#f9f9f9';

  container.innerHTML = `
    <h4 style="margin-top: 0;">Federation Resolver</h4>
    <div style="margin-bottom: 10px;">
      <input type="text" id="shortcode-input"
        placeholder="💚☮️🏴‍☠️👽/resource/path"
        style="width: 70%; padding: 8px; font-size: 14px;">
      <button id="resolve-btn"
        style="padding: 8px 16px; margin-left: 5px; cursor: pointer;">
        Resolve
      </button>
    </div>
    <div id="result-area" style="margin-top: 10px;"></div>
    <hr style="margin: 15px 0;">
    <h4>Register Location</h4>
    <div style="margin-bottom: 10px;">
      <input type="text" id="location-emoji"
        placeholder="☮️🏴‍☠️👽"
        style="width: 30%; padding: 8px; font-size: 14px;">
      <input type="text" id="location-url"
        placeholder="http://example.com"
        style="width: 35%; padding: 8px; font-size: 14px; margin-left: 5px;">
      <button id="register-btn"
        style="padding: 8px 16px; margin-left: 5px; cursor: pointer;">
        Register
      </button>
    </div>
    <div id="register-result" style="margin-top: 10px;"></div>
  `;

  $item.append(container);

  // Resolve button handler
  container.querySelector('#resolve-btn').addEventListener('click', async () => {
    const shortcode = container.querySelector('#shortcode-input').value;
    const resultArea = container.querySelector('#result-area');

    if (!shortcode) {
      resultArea.innerHTML = '<p style="color: red;">Please enter a shortcode</p>';
      return;
    }

    resultArea.innerHTML = '<p>Resolving...</p>';

    try {
      const url = await resolveFederatedShortcode(shortcode);
      resultArea.innerHTML = `
        <p style="color: green;">✓ Resolved!</p>
        <p><strong>URL:</strong> <a href="${url}" target="_blank">${url}</a></p>
      `;
    } catch (err) {
      resultArea.innerHTML = `<p style="color: red;">✗ Error: ${err.message}</p>`;
    }
  });

  // Register button handler
  container.querySelector('#register-btn').addEventListener('click', async () => {
    const emoji = container.querySelector('#location-emoji').value;
    const url = container.querySelector('#location-url').value;
    const registerResult = container.querySelector('#register-result');

    if (!emoji || !url) {
      registerResult.innerHTML = '<p style="color: red;">Please enter both emoji and URL</p>';
      return;
    }

    registerResult.innerHTML = '<p>Registering...</p>';

    try {
      await registerLocation(emoji, url);
      registerResult.innerHTML = `
        <p style="color: green;">✓ Registered ${emoji} → ${url}</p>
      `;
    } catch (err) {
      registerResult.innerHTML = `<p style="color: red;">✗ Error: ${err.message}</p>`;
    }
  });
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.federationResolver = {
    isFederatedShortcode,
    parseFederatedShortcode,
    resolveFederatedShortcode,
    registerLocation,
    getRegisteredLocations,
    createFederationUI,
    FEDERATION_PREFIX,
    LOCATION_EMOJI_COUNT
  };
}

export {
  isFederatedShortcode,
  parseFederatedShortcode,
  resolveFederatedShortcode,
  registerLocation,
  getRegisteredLocations,
  createFederationUI,
  FEDERATION_PREFIX,
  LOCATION_EMOJI_COUNT
};
