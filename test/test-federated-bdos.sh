#!/bin/bash

# Test federated BDO resolution across all wiki permutations
# Tests that each wiki can fetch BDOs from every other wiki via emojicodes

set -e

echo "🧪 Testing Federated BDO Resolution"
echo "===================================="
echo ""

WIKI_URLS=("http://localhost:7070" "http://localhost:7071" "http://localhost:7072")
WIKI_NAMES=("Wiki 1" "Wiki 2" "Wiki 3")
WIKI_EMOJIS=("☮️🏴‍☠️👽" "🌈🦄✨" "🔥💎🌟")

# First, seed the BDOs if not already done
echo "📋 Step 1: Seeding test BDOs..."
echo ""

# Use regular arrays instead of associative arrays for bash 3.2 compatibility
BDO_UUID_0=""
BDO_UUID_1=""
BDO_UUID_2=""

for i in "${!WIKI_URLS[@]}"; do
  url="${WIKI_URLS[$i]}"
  name="${WIKI_NAMES[$i]}"
  emoji="${WIKI_EMOJIS[$i]}"

  echo "Seeding BDO on $name ($emoji)..."

  bdo_data='{
    "data": "Test BDO from '"$name"' ('"$emoji"')",
    "timestamp": '$(date +%s)000'
  }'

  response=$(curl -s -X POST "$url/plugin/allyabase/bdo/put" \
    -H "Content-Type: application/json" \
    -d "$bdo_data")

  if echo "$response" | grep -q '"uuid"'; then
    uuid=$(echo "$response" | grep -o '"uuid":"[^"]*"' | cut -d'"' -f4)
    # Store in indexed variables instead of associative array
    case $i in
      0) BDO_UUID_0=$uuid ;;
      1) BDO_UUID_1=$uuid ;;
      2) BDO_UUID_2=$uuid ;;
    esac
    echo "  ✓ BDO created with UUID: $uuid"
  else
    echo "  ✗ Failed to create BDO on $name"
    echo "    Response: $response"
    exit 1
  fi
done

echo ""
echo "===================================="
echo "📊 Step 2: Testing all wiki-to-wiki permutations..."
echo ""

# Counters
TOTAL_TESTS=0
SUCCESSFUL_TESTS=0
FAILED_TESTS=0

# Test function
test_federated_fetch() {
  local source_url=$1
  local source_name=$2
  local target_idx=$3
  local target_name=$4
  local target_emoji=$5
  local target_uuid=$6

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  # Build the emojicode
  local emojicode="💚${target_emoji}/bdo/${target_uuid}"

  echo "Test $TOTAL_TESTS: $source_name → $target_name"
  echo "  Emojicode: $emojicode"

  # Make federated fetch request
  local fetch_response=$(curl -s -X POST "$source_url/plugin/allyabase/federation/fetch-bdo" \
    -H "Content-Type: application/json" \
    -d '{
      "emojicode": "'"$emojicode"'",
      "currentWikiUrl": "'"$source_url"'"
    }')

  # Check if successful
  if echo "$fetch_response" | grep -q '"success":true'; then
    echo "  ✓ SUCCESS"
    SUCCESSFUL_TESTS=$((SUCCESSFUL_TESTS + 1))

    # Show what was fetched
    if echo "$fetch_response" | grep -q '"bdo"'; then
      local bdo_data=$(echo "$fetch_response" | grep -o '"bdo":{[^}]*}' || echo "")
      echo "  📦 Retrieved BDO data"
    fi
  else
    echo "  ✗ FAILED"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo "  Response: $fetch_response" | head -c 200
    echo "..."
  fi

  echo ""
}

# Function to get UUID by index
get_uuid() {
  case $1 in
    0) echo "$BDO_UUID_0" ;;
    1) echo "$BDO_UUID_1" ;;
    2) echo "$BDO_UUID_2" ;;
  esac
}

# Test all permutations
for source_idx in "${!WIKI_URLS[@]}"; do
  source_url="${WIKI_URLS[$source_idx]}"
  source_name="${WIKI_NAMES[$source_idx]}"

  for target_idx in "${!WIKI_URLS[@]}"; do
    target_name="${WIKI_NAMES[$target_idx]}"
    target_emoji="${WIKI_EMOJIS[$target_idx]}"
    target_uuid=$(get_uuid $target_idx)

    test_federated_fetch "$source_url" "$source_name" "$target_idx" "$target_name" "$target_emoji" "$target_uuid"
  done
done

echo "===================================="
echo "📈 Test Results"
echo "===================================="
echo ""
echo "Total tests: $TOTAL_TESTS"
echo "Successful: $SUCCESSFUL_TESTS"
echo "Failed: $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo "✅ All tests passed!"
  echo ""
  echo "🎉 Federated BDO resolution is working correctly!"
  echo ""
  echo "Matrix:"
  echo "       → Wiki 1  Wiki 2  Wiki 3"
  echo "Wiki 1    ✓       ✓       ✓"
  echo "Wiki 2    ✓       ✓       ✓"
  echo "Wiki 3    ✓       ✓       ✓"
  echo ""
  exit 0
else
  echo "❌ Some tests failed"
  echo ""
  echo "Success rate: $(echo "scale=2; $SUCCESSFUL_TESTS * 100 / $TOTAL_TESTS" | bc)%"
  echo ""
  exit 1
fi
