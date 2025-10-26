#!/bin/bash

# Create "Join Allyabase Federation" page on all wikis
# This page explains the federation and can be forked by others to join

set -e

echo "🌐 Creating 'Join Allyabase Federation' pages"
echo "=============================================="
echo ""

CONTAINERS=("fedwiki-test-1" "fedwiki-test-2" "fedwiki-test-3" "fedwiki-test-4" "fedwiki-test-5")
WIKI_NAMES=("Wiki 1" "Wiki 2" "Wiki 3" "Wiki 4" "Wiki 5")
WIKI_URLS=("http://localhost:7070" "http://localhost:7071" "http://localhost:7072" "http://localhost:7073" "http://localhost:7074")
WIKI_EMOJIS=("☮️🏴‍☠️👽" "🌈🦄✨" "🔥💎🌟" "🌊🐬🎨" "🎭🎪🎡")

# Function to create the join federation page
create_join_page() {
  local container=$1
  local wiki_name=$2
  local wiki_url=$3
  local wiki_emoji=$4
  local index=$5

  echo "Creating join page on $wiki_name (container: $container)..."

  # Determine if this wiki has the plugin
  local has_plugin=""
  if [ $index -lt 3 ]; then
    has_plugin="true"
  else
    has_plugin="false"
  fi

  # Create the page content
  local page_data='{
  "title": "Join Allyabase Federation",
  "story": [
    {
      "type": "paragraph",
      "id": "intro",
      "text": "Welcome to the Allyabase Federation! This is a distributed network of Federated Wiki sites using emoji-based location identifiers for seamless cross-wiki resource resolution."
    },
    {
      "type": "markdown",
      "id": "what-is",
      "text": "# What is Allyabase Federation?\n\nAllyabase Federation combines traditional Federated Wiki neighborhood mechanics with a novel emoji-based shortcode system. Each wiki in the federation is identified by a unique 3-emoji sequence, enabling distributed resource discovery and resolution."
    },
    {
      "type": "markdown",
      "id": "how-it-works",
      "text": "# How It Works\n\n**Emoji Identifiers**: Each wiki has a unique 3-emoji location identifier (like '"$wiki_emoji"')\n\n**Federated Shortcodes**: Resources are referenced using the format `💚[3-emoji][/path]`\n\n**Discovery**: When you resolve a shortcode, the system searches across the federated network to find the location\n\n**Native Integration**: Works alongside traditional wiki roster and neighborhood features"
    },
    {
      "type": "markdown",
      "id": "this-wiki",
      "text": "# This Wiki\n\n**Location**: '"$wiki_url"'\n\n**Emoji ID**: '"$wiki_emoji"'\n\n**Example**: `💚'"$wiki_emoji"'/welcome-visitors` resolves to `'"$wiki_url"'/welcome-visitors`"
    },
    {
      "type": "markdown",
      "id": "federation-members",
      "text": "# Federation Members\n\n• ☮️🏴‍☠️👽 = http://localhost:7070 (Peace Pirate Alien)\n\n• 🌈🦄✨ = http://localhost:7071 (Rainbow Unicorn Sparkle)\n\n• 🔥💎🌟 = http://localhost:7072 (Fire Diamond Star)\n\n• 🌊🐬🎨 = http://localhost:7073 (Ocean Dolphin Art)\n\n• 🎭🎪🎡 = http://localhost:7074 (Theater Circus Ferris)\n\nSee [[Test Federation Roster]] for the complete network."
    },
    {
      "type": "paragraph",
      "id": "how-to-join",
      "text": "To join this federation, fork this page to your own wiki, choose your unique 3-emoji identifier, and register it with the network. See the Allyabase plugin below for management tools."
    }'

  # Add allyabase plugin item only if this wiki has it
  if [ "$has_plugin" = "true" ]; then
    page_data=$(echo "$page_data" | sed 's/}$/,\n    {\n      "type": "allyabase",\n      "id": "allyabase-management",\n      "text": "Allyabase Management"\n    }\n  ]/')
  else
    page_data=$(echo "$page_data" | sed 's/}$/\n  ]/')
  fi

  # Add journal
  page_data="$page_data"',
  "journal": [
    {
      "type": "create",
      "item": {
        "title": "Join Allyabase Federation"
      },
      "date": '$(date +%s)000'
    }
  ]
}'

  # Write the page
  echo "$page_data" | docker exec -i "$container" sh -c 'cat > /root/.wiki/pages/join-allyabase-federation'

  if [ $? -eq 0 ]; then
    echo "  ✓ Page created successfully"
    return 0
  else
    echo "  ✗ Failed to create page"
    return 1
  fi
}

# Create join pages on all wikis
for i in "${!CONTAINERS[@]}"; do
  container="${CONTAINERS[$i]}"
  name="${WIKI_NAMES[$i]}"
  url="${WIKI_URLS[$i]}"
  emoji="${WIKI_EMOJIS[$i]}"

  create_join_page "$container" "$name" "$url" "$emoji" "$i"
  echo ""
done

echo "=============================================="
echo "✅ Join Federation pages created!"
echo ""
echo "🔄 Triggering page loads..."
echo ""

for url in "${WIKI_URLS[@]}"; do
  echo "  Visiting $url/join-allyabase-federation..."
  curl -s "$url/join-allyabase-federation" > /dev/null
  sleep 0.3
done

echo ""
echo "✅ Pages activated!"
echo ""
echo "Visit any wiki to see the join page:"
echo "  http://localhost:7070/view/join-allyabase-federation"
echo "  http://localhost:7071/view/join-allyabase-federation"
echo "  http://localhost:7072/view/join-allyabase-federation"
echo "  http://localhost:7073/view/join-allyabase-federation"
echo "  http://localhost:7074/view/join-allyabase-federation"
echo ""
echo "People can fork this page to join the federation!"
echo ""
