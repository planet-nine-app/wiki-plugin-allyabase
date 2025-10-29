#!/usr/bin/env node

// Test federated BDO resolution across all wiki permutations
// Uses bdo-js to seed and fetch BDOs with proper authentication

const path = require('path');

// Try to load bdo-js from parent directory's node_modules
let bdo;
try {
  const bdoModule = require(path.join(__dirname, '../node_modules/bdo-js'));
  bdo = bdoModule.default || bdoModule;
console.log('found bdo somehow', bdo);
} catch (e) {
  console.error('Error: bdo-js not found. Install it first:');
  console.error('  cd .. && npm install');
  console.error(e.message);
  process.exit(1);
}

// Wiki configuration with keys
const WIKIS = [
  {
    name: 'Wiki 1',
    url: 'http://127.0.0.1:7070',
    emoji: '☮️🌙🎸',
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
console.log('baseURL for wiki is', baseURL);

      // Temporarily set bdo.baseURL
      const originalBaseURL = bdo.baseURL;
      bdo.baseURL = baseURL;

      // Create test BDO data
      const bdoData = {
        data: `Test BDO from ${wiki.name} (${wiki.emoji})`,
        timestamp: Date.now()
      };

      // Create getKeys function that returns this wiki's keys
      const getKeys = async () => wiki.keys;

      // Step 1: Create the BDO with createUser
      // Signature: createUser(hash, newBDO, saveKeys, getKeys)
      console.log('Creating BDO...');
      const uuid = await Promise.race([
        bdo.createUser('test', bdoData, () => {}, getKeys),
        new Promise((_, reject) => setTimeout(() => reject(new Error('createUser timeout after 10s')), 10000))
      ]);
      console.log(`  BDO created with UUID: ${uuid}`);

      // Step 2: Make the BDO public using updateBDO
      // Signature: updateBDO(uuid, hash, newBDO, public)
      console.log('Making BDO public...');
      const updateResult = await Promise.race([
        bdo.updateBDO(uuid, 'test', bdoData, true),
        new Promise((_, reject) => setTimeout(() => reject(new Error('updateBDO timeout after 10s')), 10000))
      ]);

      // Restore original baseURL
      bdo.baseURL = originalBaseURL;

      console.log('Update result:', updateResult);

      // Extract emojicode from the update result and prepend green heart
      const baseEmojicode = updateResult.emojiShortcode;
      if (!baseEmojicode) {
        throw new Error('No emojiShortcode returned from updateBDO');
      }

      // Prepend the green heart (💚) to make it a federated emojicode
      //const emojicode = `💚${baseEmojicode}`;
      const emojicode = `${baseEmojicode}`;
      console.log(`  ✓ BDO made public with emojicode: ${emojicode}`);

      seededBDOs.push({
        wiki,
        uuid: uuid,
        emojicode: emojicode
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

// Step 2: Register federation locations on all wikis
async function registerLocations() {
  console.log('====================================');
  console.log('📋 Step 2: Registering federation locations...');
  console.log('');

  // Register all locations on each wiki
  // Use host.docker.internal for URLs so the proxy inside Docker can reach them
  for (const wiki of WIKIS) {
    console.log(`Registering locations on ${wiki.name}...`);
    for (const location of WIKIS) {
      try {
        // Convert 127.0.0.1 to host.docker.internal for Docker networking
        const dockerUrl = location.url.replace('127.0.0.1', 'host.docker.internal');

        const response = await fetch(`${wiki.url}/plugin/allyabase/federation/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            locationIdentifier: location.emoji,
            url: dockerUrl
          })
        });

        const result = await response.json();
        if (result.success) {
          console.log(`  ✓ Registered ${location.emoji} -> ${dockerUrl}`);
        } else {
          console.log(`  ✗ Failed to register ${location.emoji}: ${result.error}`);
        }
      } catch (err) {
        console.log(`  ✗ Error registering ${location.emoji}: ${err.message}`);
      }
    }
  }

  console.log('');
}

// Step 3: Test fetching BDOs via bdo-js with emojicodes
async function testFederatedFetches(seededBDOs) {
  console.log('====================================');
  console.log('📊 Step 3: Testing all wiki-to-wiki permutations...');
  console.log('');

  for (const sourceWiki of WIKIS) {
    for (const seededBDO of seededBDOs) {
      totalTests++;
      const targetWiki = seededBDO.wiki;

      console.log(`Test ${totalTests}: ${sourceWiki.name} → ${targetWiki.name}`);
      console.log(`  Emojicode: ${seededBDO.emojicode}`);

      try {
        // Set baseURL to source wiki's BDO service
        const originalBaseURL = bdo.baseURL;
        bdo.baseURL = `${sourceWiki.url}/plugin/allyabase/bdo/`;

        // Use bdo.getBDOByEmojicode with the emojicode
        // The proxy should intercept and handle federation
        const result = await bdo.getBDOByEmojicode(seededBDO.emojicode);

        // Restore original baseURL
        bdo.baseURL = originalBaseURL;

        console.log('  [DEBUG] Result type:', typeof result);
        console.log('  [DEBUG] Result is null?', result === null);
        console.log('  [DEBUG] Result is undefined?', result === undefined);
        console.log('  [DEBUG] Result keys:', result ? Object.keys(result) : 'N/A');
        console.log('  [DEBUG] Result has uuid?', result && result.uuid ? 'YES' : 'NO');
        console.log('  [DEBUG] Full result:', JSON.stringify(result, null, 2));

        if (result && result.bdo) {
          console.log('  ✓ SUCCESS');
          console.log(`  📦 Retrieved BDO: ${result.uuid}`);
          successfulTests++;
        } else {
          console.log('  ✗ FAILED');
          console.log(`  Error: No BDO data returned`);
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
    await registerLocations();
    await testFederatedFetches(seededBDOs);
    displayResults();
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
