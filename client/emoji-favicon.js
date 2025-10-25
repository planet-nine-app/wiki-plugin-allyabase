/**
 * Emoji Favicon Utility
 *
 * Sets an emoji as the browser favicon
 */

/**
 * Set an emoji as the page favicon
 * @param {string} emoji - The emoji to use as favicon
 */
function setEmojiFavicon(emoji) {
  // Create SVG with the emoji
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <text y="85" font-size="90" text-anchor="middle" x="50">${emoji}</text>
    </svg>
  `;

  // Convert to data URI
  const encoded = encodeURIComponent(svg);
  const dataUri = `data:image/svg+xml,${encoded}`;

  // Remove existing favicons
  const existingIcons = document.querySelectorAll('link[rel*="icon"]');
  existingIcons.forEach(icon => icon.remove());

  // Create and add new favicon
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = dataUri;
  document.head.appendChild(link);

  console.log(`🎨 Favicon set to: ${emoji}`);
}

/**
 * Get the wiki's emoji identifier from registered locations
 * and set it as the favicon
 */
async function setWikiFaviconFromFederation() {
  try {
    // Get registered locations for this wiki
    const response = await fetch('/plugin/allyabase/federation/locations');

    if (!response.ok) {
      console.log('Federation not available, skipping emoji favicon');
      return;
    }

    const locations = await response.json();

    // Find this wiki's emoji (the location that points to current origin)
    const currentOrigin = window.location.origin;

    for (const [emoji, url] of Object.entries(locations)) {
      if (url === currentOrigin || url.includes(window.location.hostname)) {
        setEmojiFavicon(emoji);
        return;
      }
    }

    console.log('No emoji identifier found for this wiki in federation');
  } catch (err) {
    console.log('Could not set emoji favicon from federation:', err.message);
  }
}

/**
 * Get location emoji for a specific wiki URL
 */
function getLocationEmoji(wikiUrl) {
  // Default emojis for test wikis
  const testWikiEmojis = {
    'http://localhost:7070': '☮️',
    'http://localhost:7071': '🌈',
    'http://localhost:7072': '🔥',
    'http://localhost:7073': '🌊',
    'http://localhost:7074': '🎭'
  };

  return testWikiEmojis[wikiUrl] || '🌐';
}

/**
 * Set favicon for test environment wikis
 */
function setTestWikiFavicon() {
  const currentUrl = window.location.origin;
  const emoji = getLocationEmoji(currentUrl);

  if (emoji !== '🌐') {
    setEmojiFavicon(emoji);
  }
}

// Auto-set favicon on load if in test environment
if (typeof window !== 'undefined') {
  window.setEmojiFavicon = setEmojiFavicon;
  window.setWikiFaviconFromFederation = setWikiFaviconFromFederation;
  window.setTestWikiFavicon = setTestWikiFavicon;

  // Try to set favicon from federation on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(setTestWikiFavicon, 1000);
    });
  } else {
    setTimeout(setTestWikiFavicon, 1000);
  }
}

export {
  setEmojiFavicon,
  setWikiFaviconFromFederation,
  setTestWikiFavicon,
  getLocationEmoji
};
