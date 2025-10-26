#!/bin/bash

# Create roster pages on all wikis to enable native federation
# This integrates our emoji federation with Federated Wiki's roster/neighborhood system

set -e

echo "📋 Creating roster pages for native federation"
echo "==============================================="
echo ""

CONTAINERS=("fedwiki-test-1" "fedwiki-test-2" "fedwiki-test-3")
WIKI_NAMES=("Wiki 1" "Wiki 2" "Wiki 3")
WIKI_DOMAINS=("localhost:7070" "localhost:7071" "localhost:7072")

# Function to create a roster page
create_roster_page() {
  local container=$1
  local wiki_name=$2

  echo "Creating federation roster on $wiki_name (container: $container)..."

  # Create a roster page that includes all test wikis
  local page_data='{
  "title": "Test Federation Roster",
  "story": [
    {
      "type": "paragraph",
      "id": "intro",
      "text": "This roster connects all wikis in our test federation. Each wiki has an emoji identifier for distributed resolution."
    },
    {
      "type": "markdown",
      "id": "emoji-map",
      "text": "**Emoji Identifiers:**\n\n• ☮️🏴‍☠️👽 = localhost:7070\n\n• 🌈🦄✨ = localhost:7071\n\n• 🔥💎🌟 = localhost:7072\n\n• 🌊🐬🎨 = localhost:7073\n\n• 🎭🎪🎡 = localhost:7074"
    },
    {
      "type": "roster",
      "id": "roster-item",
      "text": "localhost:7070\nlocalhost:7071\nlocalhost:7072\nlocalhost:7073\nlocalhost:7074"
    },
    {
      "type": "paragraph",
      "id": "recent-changes",
      "text": "See [[Recent Changes]] to view activity across all wikis in this roster."
    }
  ],
  "journal": [
    {
      "type": "create",
      "item": {
        "title": "Test Federation Roster"
      },
      "date": '$(date +%s)000'
    },
    {
      "type": "add",
      "id": "intro",
      "item": {
        "type": "paragraph",
        "id": "intro",
        "text": "This roster connects all wikis in our test federation."
      },
      "date": '$(date +%s)001'
    },
    {
      "type": "add",
      "id": "emoji-map",
      "item": {
        "type": "paragraph",
        "id": "emoji-map",
        "text": "Emoji Identifiers..."
      },
      "after": "intro",
      "date": '$(date +%s)002'
    },
    {
      "type": "add",
      "id": "roster-item",
      "item": {
        "type": "roster",
        "id": "roster-item",
        "text": "localhost:7070\nlocalhost:7071\nlocalhost:7072"
      },
      "after": "emoji-map",
      "date": '$(date +%s)003'
    }
  ]
}'

  # Write the page directly to the container's filesystem
  echo "$page_data" | docker exec -i "$container" sh -c 'cat > /root/.wiki/pages/test-federation-roster'

  if [ $? -eq 0 ]; then
    echo "  ✓ Roster page created successfully"
    return 0
  else
    echo "  ✗ Failed to create roster page"
    return 1
  fi
}

# Create roster pages on all plugin wikis
for i in "${!CONTAINERS[@]}"; do
  container="${CONTAINERS[$i]}"
  name="${WIKI_NAMES[$i]}"

  create_roster_page "$container" "$name"
  echo ""
done

echo "==============================================="
echo "✅ Roster pages created!"
echo ""
echo "🔄 Triggering page loads to activate roster plugin..."
echo ""

WIKI_URLS=("http://localhost:7070" "http://localhost:7071" "http://localhost:7072")

for url in "${WIKI_URLS[@]}"; do
  echo "  Visiting $url/test-federation-roster..."
  curl -s "$url/test-federation-roster" > /dev/null
  sleep 0.5
done

echo ""
echo "✅ Roster federation activated!"
echo ""
echo "You can now:"
echo "  1. Visit any wiki's roster page"
echo "  2. Click Recent Changes to see cross-wiki activity"
echo "  3. Wikis will appear in each other's neighborhoods"
echo ""
echo "Try: http://localhost:7070/test-federation-roster"
echo ""
