#!/usr/bin/env node

/**
 * Test Multi-Value Storage and Parallel Fetching
 *
 * This test demonstrates:
 * 1. Registering multiple URLs for the same location identifier
 * 2. Verifying the array storage
 * 3. Testing parallel fetching (would test with real BDOs if services were running)
 */

const wikis = [
  { name: 'Wiki 1', url: 'http://localhost:7070', emoji: '☮️🌙🎸' },
  { name: 'Wiki 2', url: 'http://localhost:7071', emoji: '🌈🦄✨' },
  { name: 'Wiki 3', url: 'http://localhost:7072', emoji: '🔥💎🌟' }
];

console.log('========================================');
console.log('🧪 Multi-Value Storage Test');
console.log('========================================\n');

async function registerLocation(wikiUrl, locationEmoji, targetUrl) {
  const response = await fetch(`${wikiUrl}/plugin/allyabase/federation/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locationIdentifier: locationEmoji,
      url: targetUrl
    })
  });
  return await response.json();
}

async function getLocations(wikiUrl) {
  const response = await fetch(`${wikiUrl}/plugin/allyabase/federation/locations`);
  return await response.json();
}

async function runTests() {
  // Test 1: Register same location identifier from multiple wikis
  console.log('📝 Test 1: Register Multiple URLs for Same Location');
  console.log('--------------------------------------------------\n');

  const testLocation = '🎯🎪🎡'; // Test location identifier
  const testUrls = [
    'http://test1.example.com',
    'http://test2.example.com',
    'http://test3.example.com'
  ];

  let registrationCount = 0;
  for (let i = 0; i < testUrls.length; i++) {
    console.log(`Registering: ${testLocation} → ${testUrls[i]}`);
    const result = await registerLocation(wikis[0].url, testLocation, testUrls[i]);

    if (result.added) {
      console.log(`  ✓ Success! urlCount: ${result.urlCount}/${result.maxUrls}`);
      registrationCount++;
    } else if (result.reason === 'already_exists') {
      console.log(`  ⚠️  Already exists (urlCount: ${result.urlCount})`);
    } else if (result.reason === 'max_reached') {
      console.log(`  ❌ Max URLs reached (${result.maxUrls})`);
    }
  }

  console.log(`\nRegistrations: ${registrationCount}/${testUrls.length}\n`);

  // Test 2: Verify array storage
  console.log('📋 Test 2: Verify Array Storage');
  console.log('--------------------------------------------------\n');

  const locations = await getLocations(wikis[0].url);
  console.log('Registered locations:');
  console.log(JSON.stringify(locations, null, 2));
  console.log();

  // Check if test location is stored as array
  if (Array.isArray(locations[testLocation])) {
    console.log(`✓ Location ${testLocation} stored as array with ${locations[testLocation].length} URLs:`);
    locations[testLocation].forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`);
    });
  } else {
    console.log(`❌ Location ${testLocation} not stored as array`);
  }
  console.log();

  // Test 3: Test duplicate detection
  console.log('🔍 Test 3: Duplicate Detection');
  console.log('--------------------------------------------------\n');

  console.log(`Attempting to register duplicate: ${testUrls[0]}`);
  const dupResult = await registerLocation(wikis[0].url, testLocation, testUrls[0]);

  if (!dupResult.added && dupResult.reason === 'already_exists') {
    console.log('✓ Duplicate correctly rejected');
    console.log(`  Reason: ${dupResult.reason}`);
    console.log(`  Current URL count: ${dupResult.urlCount}`);
  } else {
    console.log('❌ Duplicate was not detected');
  }
  console.log();

  // Test 4: Test maximum limit
  console.log('🔢 Test 4: Maximum URL Limit (9)');
  console.log('--------------------------------------------------\n');

  const maxLocation = '🚀🌙⭐';
  console.log(`Testing max limit by registering 10 URLs for ${maxLocation}`);

  let maxTestResults = { added: 0, rejected: 0 };
  for (let i = 0; i < 10; i++) {
    const result = await registerLocation(
      wikis[0].url,
      maxLocation,
      `http://max-test-${i}.example.com`
    );

    if (result.added) {
      maxTestResults.added++;
    } else if (result.reason === 'max_reached') {
      maxTestResults.rejected++;
      console.log(`  ⚠️  URL ${i + 1} rejected: max reached at ${result.urlCount} URLs`);
    }
  }

  console.log(`\nResults:`);
  console.log(`  Added: ${maxTestResults.added}`);
  console.log(`  Rejected: ${maxTestResults.rejected}`);

  if (maxTestResults.added === 9 && maxTestResults.rejected === 1) {
    console.log('✓ Maximum limit correctly enforced at 9 URLs');
  } else {
    console.log('❌ Maximum limit not working correctly');
  }
  console.log();

  // Summary
  console.log('========================================');
  console.log('📊 Test Summary');
  console.log('========================================\n');

  const allTests = [
    { name: 'Multi-URL Registration', passed: registrationCount === 3 },
    { name: 'Array Storage', passed: Array.isArray(locations[testLocation]) },
    { name: 'Duplicate Detection', passed: !dupResult.added && dupResult.reason === 'already_exists' },
    { name: 'Maximum Limit (9)', passed: maxTestResults.added === 9 && maxTestResults.rejected === 1 }
  ];

  const passedTests = allTests.filter(t => t.passed).length;

  allTests.forEach(test => {
    console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
  });

  console.log(`\n${passedTests}/${allTests.length} tests passed`);

  if (passedTests === allTests.length) {
    console.log('\n🎉 All multi-value storage tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed');
  }
}

runTests().catch(err => {
  console.error('Error running tests:', err);
  process.exit(1);
});
