#!/bin/bash

# Seed test BDOs on all wikis that have the allyabase plugin
# Creates one BDO per wiki for testing federated resource resolution

set -e

echo "🌱 Seeding test BDOs"
echo "===================="
echo ""

WIKI_URLS=("http://localhost:7070" "http://localhost:7071" "http://localhost:7072")
WIKI_NAMES=("Wiki 1" "Wiki 2" "Wiki 3")
WIKI_EMOJIS=("☮️🏴‍☠️👽" "🌈🦄✨" "🔥💎🌟")

# Counter for successful seeds
SUCCESSFUL_SEEDS=0
TOTAL_ATTEMPTS=0

# Function to create a test BDO
create_test_bdo() {
  local wiki_url=$1
  local wiki_name=$2
  local wiki_emoji=$3

  echo "Creating test BDO on $wiki_name ($wiki_url)..."

  # Create a simple test BDO
  local bdo_data='{
    "data": "Test BDO from '"$wiki_name"' ('"$wiki_emoji"')",
    "timestamp": '$(date +%s)000'
  }'

  # POST to BDO service via the plugin proxy
  local response=$(curl -s -X POST "$wiki_url/plugin/allyabase/bdo/put" \
    -H "Content-Type: application/json" \
    -d "$bdo_data")

  TOTAL_ATTEMPTS=$((TOTAL_ATTEMPTS + 1))

  # Check if BDO was created successfully
  if echo "$response" | grep -q '"uuid"'; then
    local uuid=$(echo "$response" | grep -o '"uuid":"[^"]*"' | cut -d'"' -f4)
    echo "  ✓ BDO created with UUID: $uuid"
    echo "    Emojicode: 💚$wiki_emoji/bdo/$uuid"
    SUCCESSFUL_SEEDS=$((SUCCESSFUL_SEEDS + 1))

    # Store the UUID for this wiki
    eval "BDO_UUID_${wiki_name// /_}='$uuid'"
    return 0
  else
    echo "  ✗ Failed to create BDO"
    echo "    Response: $response"
    return 1
  fi
}

# Create test BDOs on all wikis with plugin
for i in "${!WIKI_URLS[@]}"; do
  url="${WIKI_URLS[$i]}"
  name="${WIKI_NAMES[$i]}"
  emoji="${WIKI_EMOJIS[$i]}"

  create_test_bdo "$url" "$name" "$emoji"
  echo ""
done

echo "===================="
echo "✅ Seeding complete!"
echo ""
echo "Summary:"
echo "  Total attempts: $TOTAL_ATTEMPTS"
echo "  Successful: $SUCCESSFUL_SEEDS"
echo ""

if [ $SUCCESSFUL_SEEDS -eq $TOTAL_ATTEMPTS ]; then
  echo "🎉 All BDOs created successfully!"
else
  echo "⚠️  Some BDOs failed to create"
fi

echo ""
echo "Test emojicodes created:"
echo "  Wiki 1: 💚☮️🏴‍☠️👽/bdo/{uuid}"
echo "  Wiki 2: 💚🌈🦄✨/bdo/{uuid}"
echo "  Wiki 3: 💚🔥💎🌟/bdo/{uuid}"
echo ""
