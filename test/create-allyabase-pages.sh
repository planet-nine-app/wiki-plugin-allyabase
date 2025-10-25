#!/bin/bash

# Create allyabase pages on all wikis
# This ensures the plugin gets loaded by creating a page that uses it

set -e

echo "📄 Creating allyabase pages on all wikis"
echo "=========================================="
echo ""

CONTAINERS=("fedwiki-test-1" "fedwiki-test-2" "fedwiki-test-3")
WIKI_NAMES=("Wiki 1" "Wiki 2" "Wiki 3")

# Function to create a page with an allyabase item
create_allyabase_page() {
  local container=$1
  local wiki_name=$2

  echo "Creating page on $wiki_name (container: $container)..."

  # Create a simple page with an allyabase item
  local page_data='{
  "title": "Allyabase",
  "story": [
    {
      "type": "paragraph",
      "id": "intro",
      "text": "This page contains the Allyabase plugin which provides federation and base management capabilities."
    },
    {
      "type": "allyabase",
      "id": "allyabase-item",
      "text": "Allyabase Management"
    }
  ],
  "journal": [
    {
      "type": "create",
      "item": {
        "title": "Allyabase"
      },
      "date": '$(date +%s)000'
    }
  ]
}'

  # Write the page directly to the container's filesystem
  echo "$page_data" | docker exec -i "$container" sh -c 'cat > /root/.wiki/pages/allyabase'

  if [ $? -eq 0 ]; then
    echo "  ✓ Page created successfully"
    return 0
  else
    echo "  ✗ Failed to create page"
    return 1
  fi
}

# Create pages on all plugin wikis
for i in "${!CONTAINERS[@]}"; do
  container="${CONTAINERS[$i]}"
  name="${WIKI_NAMES[$i]}"

  create_allyabase_page "$container" "$name"
  echo ""
done

echo "=========================================="
echo "✅ Allyabase pages created!"
echo ""

# Now visit each page to trigger plugin loading
echo "🔄 Triggering plugin load by visiting pages..."
echo ""

WIKI_URLS=("http://localhost:7070" "http://localhost:7071" "http://localhost:7072")

for url in "${WIKI_URLS[@]}"; do
  echo "  Visiting $url/allyabase..."
  curl -s "$url/allyabase" > /dev/null
  sleep 0.5
done

echo ""
echo "✅ Plugin load triggered on all wikis"
echo ""
