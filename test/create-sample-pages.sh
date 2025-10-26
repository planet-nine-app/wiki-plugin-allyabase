#!/bin/bash

# Create sample pages on different wikis to generate Recent Changes activity

set -e

echo "📝 Creating sample pages to generate activity"
echo "=============================================="
echo ""

# Function to create a test page
create_test_page() {
  local container=$1
  local page_name=$2
  local content=$3
  local emoji=$4

  local page_data="{
  \"title\": \"$content\",
  \"story\": [
    {
      \"type\": \"paragraph\",
      \"id\": \"para1\",
      \"text\": \"$emoji This is a test page from $content.\"
    },
    {
      \"type\": \"paragraph\",
      \"id\": \"para2\",
      \"text\": \"Created to test federated wiki Recent Changes.\"
    }
  ],
  \"journal\": [
    {
      \"type\": \"create\",
      \"item\": {
        \"title\": \"$content\"
      },
      \"date\": $(date +%s)000
    }
  ]
}"

  echo "$page_data" | docker exec -i "$container" sh -c "cat > /root/.wiki/pages/$page_name"
  echo "  ✓ Created '$content' on $container"
}

# Create different pages on different wikis
echo "Creating test pages across wikis..."
echo ""

create_test_page "fedwiki-test-1" "hello-from-wiki-1" "Hello from Wiki 1" "☮️"
sleep 1
create_test_page "fedwiki-test-2" "hello-from-wiki-2" "Hello from Wiki 2" "🌈"
sleep 1
create_test_page "fedwiki-test-3" "hello-from-wiki-3" "Hello from Wiki 3" "🔥"
sleep 1
create_test_page "fedwiki-test-1" "another-page" "Another Page" "🏴‍☠️"
sleep 1
create_test_page "fedwiki-test-2" "testing-federation" "Testing Federation" "🦄"

echo ""
echo "=============================================="
echo "✅ Sample pages created!"
echo ""
echo "Now visit: http://localhost:7070/view/test-federation-roster"
echo "Click 'Recent Changes' to see activity across all wikis!"
echo ""
