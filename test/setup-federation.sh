#!/bin/bash

# Setup Federation Test
# Registers emojicodes for all test wikis and verifies federation works

set -e

echo "🌐 Setting up Federation Test Environment"
echo "=========================================="
echo ""

# Define wikis using simple arrays
WIKI_URLS=("http://localhost:7070" "http://localhost:7071" "http://localhost:7072" "http://localhost:7073" "http://localhost:7074")
WIKI_EMOJIS=("☮️🏴‍☠️👽" "🌈🦄✨" "🔥💎🌟" "🌊🐬🎨" "🎭🎪🎡")
WIKI_NAMES=("Wiki 1" "Wiki 2" "Wiki 3" "Wiki 4" "Wiki 5")

# Only test on wikis that have the plugin (1-3)
PLUGIN_WIKI_URLS=("http://localhost:7070" "http://localhost:7071" "http://localhost:7072")

# Function to check if a wiki is running
check_wiki() {
  local url=$1
  # Accept 200, 302 (redirect), or 404 as healthy responses
  if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|302\|404"; then
    return 0
  else
    return 1
  fi
}

# Function to register a location on a wiki
register_location() {
  local wiki_url=$1
  local emoji=$2
  local target_url=$3

  echo "  Registering $emoji → $target_url"

  response=$(curl -s -X POST "$wiki_url/plugin/allyabase/federation/register" \
    -H "Content-Type: application/json" \
    -d "{\"locationIdentifier\":\"$emoji\",\"url\":\"$target_url\"}" 2>&1)

  if echo "$response" | grep -q "\"success\":true"; then
    echo "    ✓ Success"
    return 0
  else
    echo "    ✗ Failed (this is expected for wikis without the plugin)"
    return 1
  fi
}

# Function to verify a location on a wiki
verify_location() {
  local wiki_url=$1
  local emoji=$2
  local expected_url=$3

  # URL encode the emoji properly
  encoded_emoji=$(printf %s "$emoji" | jq -sRr @uri 2>/dev/null || echo "$emoji")
  response=$(curl -s "$wiki_url/plugin/allyabase/federation/location/$encoded_emoji" 2>&1)

  if echo "$response" | grep -q "\"url\":\"$expected_url\""; then
    return 0
  else
    return 1
  fi
}

# Function to test shortcode resolution
test_resolve() {
  local wiki_url=$1
  local shortcode=$2
  local expected_url=$3

  echo "  Testing: $shortcode"
  echo "  Expected: $expected_url"

  response=$(curl -s -X POST "$wiki_url/plugin/allyabase/federation/resolve" \
    -H "Content-Type: application/json" \
    -d "{\"shortcode\":\"$shortcode\",\"currentWikiUrl\":\"$wiki_url\"}" 2>&1)

  if echo "$response" | grep -q "\"success\":true"; then
    resolved=$(echo "$response" | grep -o '"resolvedUrl":"[^"]*"' | cut -d'"' -f4)
    if [ "$resolved" = "$expected_url" ]; then
      echo "    ✓ Resolved correctly: $resolved"
      return 0
    else
      echo "    ✗ Wrong URL: $resolved"
      return 1
    fi
  else
    echo "    ✗ Resolution failed"
    echo "    Response: $response"
    return 1
  fi
}

# Check if all wikis are running with retry
echo "🔍 Waiting for all wikis to be fully ready..."
echo "   (This may take a few minutes for plugin installation)"
echo ""

MAX_WAIT=180  # 3 minutes max
ELAPSED=0
CHECK_INTERVAL=5

while [ $ELAPSED -lt $MAX_WAIT ]; do
  all_running=true

  for i in "${!WIKI_URLS[@]}"; do
    url="${WIKI_URLS[$i]}"
    name="${WIKI_NAMES[$i]}"

    if ! check_wiki "$url"; then
      all_running=false
      if [ $ELAPSED -eq 0 ]; then
        echo "  ⏳ Waiting for $name ($url)..."
      fi
    fi
  done

  if [ "$all_running" = true ]; then
    echo ""
    echo "✅ All wikis are running and ready!"
    break
  fi

  if [ $ELAPSED -gt 0 ]; then
    echo "  Still waiting... ($ELAPSED seconds elapsed)"
  fi

  sleep $CHECK_INTERVAL
  ELAPSED=$((ELAPSED + CHECK_INTERVAL))
done

if [ "$all_running" = false ]; then
  echo ""
  echo "❌ Timeout! Not all wikis are running after ${MAX_WAIT} seconds"
  echo ""
  echo "Check which wikis failed:"
  for i in "${!WIKI_URLS[@]}"; do
    url="${WIKI_URLS[$i]}"
    name="${WIKI_NAMES[$i]}"
    if check_wiki "$url"; then
      echo "  ✓ $name ($url) is running"
    else
      echo "  ✗ $name ($url) is not running"
    fi
  done
  echo ""
  echo "Check logs with: docker-compose logs -f"
  exit 1
fi

echo ""
echo "✅ All wikis are running"
echo ""

# Register locations only on wikis that have the plugin (1-3)
echo "📝 Registering location identifiers..."
echo "   (Only on wikis 1-3 which have the allyabase plugin)"
echo ""

success_count=0
total_count=0

for source_url in "${PLUGIN_WIKI_URLS[@]}"; do
  # Find which wiki this is
  for i in "${!WIKI_URLS[@]}"; do
    if [ "${WIKI_URLS[$i]}" = "$source_url" ]; then
      echo "On ${WIKI_NAMES[$i]} ($source_url):"
      break
    fi
  done

  # Register all 5 locations on this wiki
  for i in "${!WIKI_EMOJIS[@]}"; do
    emoji="${WIKI_EMOJIS[$i]}"
    target_url="${WIKI_URLS[$i]}"
    total_count=$((total_count + 1))

    if register_location "$source_url" "$emoji" "$target_url"; then
      success_count=$((success_count + 1))
    fi

    sleep 0.1
  done

  echo ""
done

echo "Registration Summary: $success_count/$total_count successful"
echo ""

# Verify registrations only on plugin wikis
echo "🔎 Verifying registrations..."
echo ""

verify_count=0
verify_total=0

for source_url in "${PLUGIN_WIKI_URLS[@]}"; do
  # Find which wiki this is
  for i in "${!WIKI_URLS[@]}"; do
    if [ "${WIKI_URLS[$i]}" = "$source_url" ]; then
      echo "Checking ${WIKI_NAMES[$i]} ($source_url):"
      break
    fi
  done

  for i in "${!WIKI_EMOJIS[@]}"; do
    emoji="${WIKI_EMOJIS[$i]}"
    expected_url="${WIKI_URLS[$i]}"
    verify_total=$((verify_total + 1))

    if verify_location "$source_url" "$emoji" "$expected_url"; then
      echo "  ✓ $emoji → $expected_url"
      verify_count=$((verify_count + 1))
    else
      echo "  ✗ $emoji verification failed"
    fi
  done

  echo ""
done

echo "Verification Summary: $verify_count/$verify_total successful"
echo ""

# Test shortcode resolution
echo "🧪 Testing shortcode resolution..."
echo ""

test_count=0
test_total=0

# Test from Wiki 1
echo "Testing from Wiki 1 (http://localhost:7070):"

# Test each emoji location
for i in "${!WIKI_EMOJIS[@]}"; do
  emoji="${WIKI_EMOJIS[$i]}"
  expected_url="${WIKI_URLS[$i]}/test"
  shortcode="💚${emoji}/test"
  test_total=$((test_total + 1))

  if test_resolve "http://localhost:7070" "$shortcode" "$expected_url"; then
    test_count=$((test_count + 1))
  fi

  echo ""
  sleep 0.2
done

echo ""
echo "Resolution Summary: $test_count/$test_total successful"
echo ""

# Final summary
echo "=================================================="
echo "🎉 Federation Test Complete!"
echo "=================================================="
echo ""
echo "Summary:"
echo "  Registrations: $success_count/$total_count"
echo "  Verifications: $verify_count/$verify_total"
echo "  Resolutions:   $test_count/$test_total"
echo ""

if [ $success_count -eq $total_count ] && [ $verify_count -eq $verify_total ] && [ $test_count -eq $test_total ]; then
  echo "✅ All tests passed!"
  echo ""
  echo "🌐 Federation is working correctly!"
  echo ""
  echo "You can now use emojicodes like:"
  for i in "${!WIKI_EMOJIS[@]}"; do
    echo "  💚${WIKI_EMOJIS[$i]}/resource → ${WIKI_URLS[$i]}/resource"
  done
  exit 0
else
  echo "⚠️  Some tests failed!"
  echo ""
  echo "Note: Wikis 4-5 don't have the allyabase plugin,"
  echo "so they can't register or resolve federation codes."
  echo "This is expected - only wikis 1-3 support federation."
  echo ""
  echo "Check the output above for other issues."
  exit 1
fi
