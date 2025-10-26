#!/usr/bin/env node

// Test federated BDO resolution across all wiki permutations
// Uses bdo-js to seed and fetch BDOs with proper authentication

const path = require('path');

// Try to load bdo-js and sessionless from parent directory's node_modules
let bdo, sessionless;
try {
  const bdoModule = require(path.join(__dirname, '../node_modules/bdo-js'));
  bdo = bdoModule.default || bdoModule;

  const sessionlessModule = require(path.join(__dirname, '../node_modules/sessionless-node'));
  sessionless = sessionlessModule.default || sessionlessModule;
} catch (e) {
  console.error('Error: dependencies not found. Install them first:');
  console.error('  cd .. && npm install');
  console.error(e.message);
  process.exit(1);
}

// Wiki configuration with keys
const WIKIS = [
  {
    name: 'Wiki 1',
    url: 'http://127.0.0.1:7070',
    emoji: '☮️🏴‍☠️👽',
    keys: {
      pubKey: '029dd60e726cbcc00fc486e158751d290172cc92733a3be4a5d18a2ef07e097f73',
      privateKey: '45e6138bd2109c77f2bcdd63c4ddf4083a4c0f91820a1a5ff16fd6bec5ea2bf0'
    }
  },
  {
    name: 'Wiki 2',
    url: 'http://127.0.0.1:7071',
    emoji: '🌈🦄✨',
    keys: {
      pubKey: '020ac2680d4f9cd5b3ca8920d92d521203770a53ee03e7fe081e043c1e698999ef',
      privateKey: 'b4932179e9612962ee9d1995ed579f69bd8051d1cb805f934a706d82b48a42bc'
    }
  },
  {
    name: 'Wiki 3',
    url: 'http://127.0.0.1:7072',
    emoji: '🔥💎🌟',
    keys: {
      pubKey: '0266ff08c34b1d0f406370415fd18f632eb8bb4e2b89623b51db5cfb557637290a',
      privateKey: 'cb4c0e0501e2760feaca77c26752b2ae488c208ea3126e7a2dbc9ed35ccf7d2f'
    }
  }
];

// Statistics
let totalTests = 0;
let successfulTests = 0;
let failedTests = 0;

console.log('🧪 Testing Federated BDO Resolution');
console.log('====================================');
console.log('');

// Step 1: Seed BDOs on each wiki
async function seedBDOs() {
  console.log('📋 Step 1: Seeding test BDOs...');
  console.log('');

  const seededBDOs = [];

  for (const wiki of WIKIS) {
    console.log(`Seeding BDO on ${wiki.name} (${wiki.emoji})...`);

    try {
      // Set the base URL to this wiki's BDO service
      const baseURL = `${wiki.url}/plugin/allyabase/bdo/`;

      // Temporarily set bdo.baseURL and sessionless.getKeys
      const originalBaseURL = bdo.baseURL;
      const originalGetKeys = sessionless.getKeys;

      bdo.baseURL = baseURL;
      sessionless.getKeys = async () => wiki.keys;

      // Create test BDO data
      const bdoData = {
        data: `Test BDO from ${wiki.name} (${wiki.emoji})`,
        timestamp: Date.now()
      };

      // Use updateBDO to create the BDO
      const result = await bdo.updateBDO(null, null, bdoData, true);

      // Restore original values
      bdo.baseURL = originalBaseURL;
      sessionless.getKeys = originalGetKeys;

      console.log(`  ✓ BDO created with UUID: ${result.uuid}`);

      seededBDOs.push({
        wiki,
        uuid: result.uuid,
        emojicode: `💚${wiki.emoji}/bdo/${result.uuid}`
      });

    } catch (err) {
      console.log(`  ✗ Failed to create BDO on ${wiki.name}`);
      console.log(`    Error: ${err.message}`);
      console.log(`    Stack: ${err.stack}`);
      process.exit(1);
    }
  }

  console.log('');
  return seededBDOs;
}

// Step 2: Test fetching BDOs via federation endpoint
async function testFederatedFetches(seededBDOs) {
  console.log('====================================');
  console.log('📊 Step 2: Testing all wiki-to-wiki permutations...');
  console.log('');

  for (const sourceWiki of WIKIS) {
    for (const seededBDO of seededBDOs) {
      totalTests++;
      const targetWiki = seededBDO.wiki;

      console.log(`Test ${totalTests}: ${sourceWiki.name} → ${targetWiki.name}`);
      console.log(`  Emojicode: ${seededBDO.emojicode}`);

      try {
        // Make request to source wiki's federation endpoint
        const response = await fetch(`${sourceWiki.url}/plugin/allyabase/federation/fetch-bdo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            emojicode: seededBDO.emojicode,
            currentWikiUrl: sourceWiki.url
          })
        });

        const result = await response.json();

        if (result.success && result.bdo) {
          console.log('  ✓ SUCCESS');
          console.log(`  📦 Retrieved BDO: ${result.bdo.uuid}`);
          successfulTests++;
        } else {
          console.log('  ✗ FAILED');
          console.log(`  Error: ${result.error || 'Unknown error'}`);
          failedTests++;
        }

      } catch (err) {
        console.log('  ✗ FAILED');
        console.log(`  Error: ${err.message}`);
        failedTests++;
      }

      console.log('');
    }
  }
}

// Step 3: Display results
function displayResults() {
  console.log('====================================');
  console.log('📈 Test Results');
  console.log('====================================');
  console.log('');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log('');

  if (failedTests === 0) {
    console.log('✅ All tests passed!');
    console.log('');
    console.log('🎉 Federated BDO resolution is working correctly!');
    console.log('');
    console.log('Matrix:');
    console.log('       → Wiki 1  Wiki 2  Wiki 3');
    console.log('Wiki 1    ✓       ✓       ✓');
    console.log('Wiki 2    ✓       ✓       ✓');
    console.log('Wiki 3    ✓       ✓       ✓');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    console.log('');
    console.log(`Success rate: ${((successfulTests * 100) / totalTests).toFixed(2)}%`);
    console.log('');
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    const seededBDOs = await seedBDOs();
    await testFederatedFetches(seededBDOs);
    displayResults();
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
