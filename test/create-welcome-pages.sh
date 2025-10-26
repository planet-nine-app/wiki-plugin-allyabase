#!/bin/bash

# Create Welcome Visitors pages with links to federation resources

set -e

echo "👋 Creating Welcome Visitors pages"
echo "==================================="
echo ""

CONTAINERS=("fedwiki-test-1" "fedwiki-test-2" "fedwiki-test-3" "fedwiki-test-4" "fedwiki-test-5")
WIKI_NAMES=("Wiki 1" "Wiki 2" "Wiki 3" "Wiki 4" "Wiki 5")
WIKI_EMOJIS=("☮️🏴‍☠️👽" "🌈🦄✨" "🔥💎🌟" "🌊🐬🎨" "🎭🎪🎡")

# Function to create welcome page
create_welcome_page() {
  local container=$1
  local wiki_name=$2
  local wiki_emoji=$3
  local index=$4

  echo "Creating Welcome Visitors on $wiki_name..."

  local has_plugin=""
  if [ $index -lt 3 ]; then
    has_plugin="yes"
  else
    has_plugin="no"
  fi

  local page_data='{
  "title": "Welcome Visitors",
  "story": [
    {
      "type": "paragraph",
      "id": "intro",
      "text": "Welcome to '"$wiki_emoji"' - a member of the Allyabase Federation."
    },
    {
      "type": "paragraph",
      "id": "what-is-allyabase",
      "text": "This wiki is part of a federated network using emoji-based location identifiers. Each wiki has a unique 3-emoji ID that enables distributed resource discovery across the network."
    },
    {
      "type": "paragraph",
      "id": "links",
      "text": "Learn more about the federation:"
    },
    {
      "type": "paragraph",
      "id": "link-join",
      "text": "[[Join Allyabase Federation]]"
    },
    {
      "type": "paragraph",
      "id": "link-roster",
      "text": "[[Federation Roster]]"
    }'

  # Add allyabase item only for wikis with plugin
  if [ "$has_plugin" = "yes" ]; then
    page_data="$page_data"',
    {
      "type": "paragraph",
      "id": "manage",
      "text": "Manage this wiki'"'"'s Allyabase installation:"
    },
    {
      "type": "paragraph",
      "id": "link-allyabase",
      "text": "[[Allyabase]]"
    }'
  fi

  page_data="$page_data"'
  ],
  "journal": [
    {
      "type": "create",
      "item": {
        "title": "Welcome Visitors"
      },
      "date": '$(date +%s)000'
    }
  ]
}'

  # Write to temp file then copy to container
  echo "$page_data" | docker exec -i "$container" sh -c 'cat > /root/.wiki/pages/welcome-visitors'

  if [ $? -eq 0 ]; then
    echo "  ✓ Welcome page created"
  else
    echo "  ✗ Failed to create welcome page"
  fi
}

# Function to create join federation page (simpler version)
create_join_page() {
  local container=$1
  local wiki_name=$2
  local wiki_emoji=$3
  local index=$4

  echo "Creating Join Federation page on $wiki_name..."

  local has_plugin=""
  if [ $index -lt 3 ]; then
    has_plugin="yes"
  else
    has_plugin="no"
  fi

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
      "text": "# How It Works\n\n**Emoji Identifiers**: Each wiki has a unique 3-emoji location identifier (like '"$wiki_emoji"')\n\n**Federated Shortcodes**: Resources are referenced using `💚[3-emoji][/path]`\n\n**Discovery**: The system searches across the federated network to find locations\n\n**Native Integration**: Works with traditional wiki roster and neighborhood features"
    },
    {
      "type": "markdown",
      "id": "federation-members",
      "text": "# Federation Members\n\n• ☮️🏴‍☠️👽 = http://localhost:7070\n\n• 🌈🦄✨ = http://localhost:7071\n\n• 🔥💎🌟 = http://localhost:7072\n\n• 🌊🐬🎨 = http://localhost:7073\n\n• 🎭🎪🎡 = http://localhost:7074"
    },
    {
      "type": "paragraph",
      "id": "roster-link",
      "text": "See [[Federation Roster]] for the complete network and recent changes."
    }'

  # Add allyabase plugin for wikis that have it
  if [ "$has_plugin" = "yes" ]; then
    page_data="$page_data"',
    {
      "type": "paragraph",
      "id": "management",
      "text": "Use the Allyabase plugin below to manage your base and register your location:"
    },
    {
      "type": "allyabase",
      "id": "allyabase-item",
      "text": "Allyabase Management"
    }'
  fi

  page_data="$page_data"'
  ],
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

  # Write to temp file then copy to container
  echo "$page_data" | docker exec -i "$container" sh -c 'cat > /root/.wiki/pages/join-allyabase-federation'

  if [ $? -eq 0 ]; then
    echo "  ✓ Join page created"
  else
    echo "  ✗ Failed to create join page"
  fi
}

# Function to rename roster page
rename_roster_page() {
  local container=$1
  local wiki_name=$2

  echo "Renaming roster page on $wiki_name..."

  # Read the existing page, update title, and save as new name
  docker exec "$container" sh -c 'cat /root/.wiki/pages/test-federation-roster | sed "s/Test Federation Roster/Federation Roster/g" > /root/.wiki/pages/federation-roster'

  if [ $? -eq 0 ]; then
    echo "  ✓ Roster renamed to 'Federation Roster'"
  else
    echo "  ✗ Failed to rename roster"
  fi
}

# Create pages on all wikis
for i in "${!CONTAINERS[@]}"; do
  container="${CONTAINERS[$i]}"
  name="${WIKI_NAMES[$i]}"
  emoji="${WIKI_EMOJIS[$i]}"

  create_welcome_page "$container" "$name" "$emoji" "$i"
  create_join_page "$container" "$name" "$emoji" "$i"
  rename_roster_page "$container" "$name"
  echo ""
done

echo "==================================="
echo "✅ All pages created!"
echo ""
echo "Visit: http://localhost:7070/view/welcome-visitors"
echo ""
