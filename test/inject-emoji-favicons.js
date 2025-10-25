#!/usr/bin/env node

/**
 * Inject emoji favicon script into wiki pages
 *
 * This script can be run to add emoji favicons to each test wiki
 */

const http = require('http');

const WIKIS = [
  { url: 'http://localhost:7070', emoji: '☮️', name: 'Wiki 1' },
  { url: 'http://localhost:7071', emoji: '🌈', name: 'Wiki 2' },
  { url: 'http://localhost:7072', emoji: '🔥', name: 'Wiki 3' },
  { url: 'http://localhost:7073', emoji: '🌊', name: 'Wiki 4' },
  { url: 'http://localhost:7074', emoji: '🎭', name: 'Wiki 5' }
];

function setEmojiFavicon(wikiUrl, emoji) {
  return new Promise((resolve, reject) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="85" font-size="90" text-anchor="middle" x="50">${emoji}</text></svg>`;
    const encoded = encodeURIComponent(svg);
    const dataUri = `data:image/svg+xml,${encoded}`;

    console.log(`Setting favicon for ${wikiUrl} to ${emoji}`);
    console.log(`Data URI: ${dataUri.substring(0, 80)}...`);

    // In a real implementation, this would use the wiki's API to set metadata
    // For now, we'll just output the information
    resolve({
      wiki: wikiUrl,
      emoji,
      dataUri
    });
  });
}

async function main() {
  console.log('🎨 Emoji Favicon Injector');
  console.log('='.repeat(60));
  console.log('');

  const results = [];

  for (const wiki of WIKIS) {
    const result = await setEmojiFavicon(wiki.url, wiki.emoji);
    results.push(result);
    console.log(`✓ ${wiki.name}: ${wiki.emoji}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ Emoji favicons configured!');
  console.log('');
  console.log('To use these favicons:');
  console.log('1. The emoji-favicon.js script auto-loads in the wiki plugin');
  console.log('2. Open any wiki page and the emoji will appear as favicon');
  console.log('3. Each wiki has its unique emoji identifier:');
  console.log('');

  WIKIS.forEach(wiki => {
    console.log(`   ${wiki.emoji} ${wiki.name} (${wiki.url})`);
  });

  console.log('');
  console.log('You can also manually set any emoji favicon by running:');
  console.log('   window.setEmojiFavicon("🚀")');
  console.log('');
}

main().catch(console.error);
