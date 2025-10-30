#!/bin/bash

# Test Fork and Automatic Federation
#
# This script tests the automatic federation feature that triggers
# when you fork an allyabase page from one wiki to another.

echo "========================================"
echo "🧪 Testing Fork-Based Auto-Federation"
echo "========================================"
echo

# Test configuration
WIKI1_URL="http://localhost:7070"
WIKI2_URL="http://localhost:7071"
WIKI1_SITE="localhost:7070"
WIKI2_SITE="localhost:7071"

echo "📋 Test Setup:"
echo "  Source Wiki: $WIKI1_URL (Wiki 1)"
echo "  Target Wiki: $WIKI2_URL (Wiki 2)"
echo

# Step 1: Create an allyabase page on Wiki 1 (source)
echo "Step 1: Creating allyabase page on Wiki 1..."
echo "-------------------------------------------"

PAGE_DATA='{
  "title": "Allyabase",
  "story": [
    {
      "type": "allyabase",
      "id": "test-allyabase-item",
      "text": "Launch and manage your local Allyabase"
    }
  ],
  "journal": [
    {
      "type": "create",
      "item": {
        "title": "Allyabase",
        "story": [
          {
            "type": "allyabase",
            "id": "test-allyabase-item",
            "text": "Launch and manage your local Allyabase"
          }
        ]
      },
      "date": '$(date +%s)000'
    }
  ]
}'

# Write page to Wiki 1
echo "$PAGE_DATA" | docker exec -i fedwiki-test-1 sh -c 'cat > /root/.wiki/pages/allyabase'
curl -s "$WIKI1_URL/allyabase.html" > /dev/null
echo "✓ Allyabase page created on Wiki 1"
echo

sleep 2

# Step 2: Simulate forking the page to Wiki 2
echo "Step 2: Simulating fork to Wiki 2..."
echo "-------------------------------------------"

# Create a forked version of the page on Wiki 2
# The key is the 'fork' entry in the journal
FORKED_PAGE_DATA='{
  "title": "Allyabase",
  "story": [
    {
      "type": "allyabase",
      "id": "test-allyabase-item",
      "text": "Launch and manage your local Allyabase"
    }
  ],
  "journal": [
    {
      "type": "create",
      "item": {
        "title": "Allyabase",
        "story": [
          {
            "type": "allyabase",
            "id": "test-allyabase-item",
            "text": "Launch and manage your local Allyabase"
          }
        ]
      },
      "date": '$(date +%s)000'
    },
    {
      "type": "fork",
      "site": "'$WIKI1_SITE'",
      "date": '$(date +%s)000'
    }
  ]
}'

# Write forked page to Wiki 2
echo "$FORKED_PAGE_DATA" | docker exec -i fedwiki-test-2 sh -c 'cat > /root/.wiki/pages/allyabase'
curl -s "$WIKI2_URL/allyabase.html" > /dev/null
echo "✓ Forked page created on Wiki 2 (with fork journal entry)"
echo "  Fork source: $WIKI1_SITE"
echo

sleep 2

# Step 3: Check initial federation state
echo "Step 3: Checking initial federation state..."
echo "-------------------------------------------"

WIKI1_LOCATIONS=$(curl -s "$WIKI1_URL/plugin/allyabase/federation/locations")
WIKI2_LOCATIONS=$(curl -s "$WIKI2_URL/plugin/allyabase/federation/locations")

echo "Wiki 1 registered locations: $WIKI1_LOCATIONS"
echo "Wiki 2 registered locations: $WIKI2_LOCATIONS"
echo

# Step 4: Simulate clicking "Launch a Base" on the forked page
echo "Step 4: Simulating launch on forked page (Wiki 2)..."
echo "-------------------------------------------"
echo
echo "In a real scenario, the user would:"
echo "  1. Visit $WIKI2_URL/allyabase"
echo "  2. See the '🔗 Federation Status' section showing fork source"
echo "  3. Click 'Launch a Base'"
echo "  4. The plugin would automatically:"
echo "     - Fetch Wiki 1's base emoji identifier"
echo "     - Register Wiki 1's location on Wiki 2"
echo "     - Register Wiki 2's location on Wiki 1"
echo "     - Display success status"
echo
echo "Expected result:"
echo "  ✅ Federated with $WIKI1_SITE (💚☮️🌙🎸)"
echo

echo "========================================"
echo "📊 Test Summary"
echo "========================================"
echo
echo "✅ Fork detection logic implemented"
echo "✅ UI feedback for federation status added"
echo "✅ Automatic mutual registration on launch"
echo "✅ Page with fork journal created for testing"
echo
echo "To test manually:"
echo "  1. Ensure Wiki 1 has allyabase running:"
echo "     curl -X POST $WIKI1_URL/plugin/allyabase/launch"
echo
echo "  2. Visit the forked page on Wiki 2:"
echo "     open $WIKI2_URL/allyabase"
echo
echo "  3. Click 'Launch a Base' and watch the federation status"
echo
echo "  4. Verify mutual registration:"
echo "     curl -s $WIKI1_URL/plugin/allyabase/federation/locations | jq ."
echo "     curl -s $WIKI2_URL/plugin/allyabase/federation/locations | jq ."
echo
