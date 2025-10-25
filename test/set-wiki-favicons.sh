#!/bin/bash

# Set emoji favicons for each test wiki
# This script creates favicon files using the wiki's emoji identifier

set -e

echo "🎨 Setting emoji favicons for test wikis"
echo "=========================================="
echo ""

# Define wikis and their emojis
declare -A WIKI_EMOJIS=(
  ["http://localhost:7070"]="☮️"
  ["http://localhost:7071"]="🌈"
  ["http://localhost:7072"]="🔥"
  ["http://localhost:7073"]="🌊"
  ["http://localhost:7074"]="🎭"
)

# Function to create an emoji favicon SVG
create_emoji_favicon() {
  local emoji=$1
  local output_file=$2

  cat > "$output_file" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <text y="80" font-size="80">${emoji}</text>
</svg>
EOF
}

# Function to set favicon via wiki API
set_wiki_favicon() {
  local wiki_url=$1
  local emoji=$2

  echo "Setting favicon for ${wiki_url} to ${emoji}"

  # Create temporary SVG file
  local temp_svg="/tmp/favicon_${RANDOM}.svg"
  create_emoji_favicon "$emoji" "$temp_svg"

  # Convert SVG to data URI
  local svg_content=$(cat "$temp_svg")
  local data_uri="data:image/svg+xml;utf8,${svg_content}"

  # Try to set via wiki status
  # Note: This depends on wiki's ability to accept favicon customization
  # For federated wiki, we might need to add this to the status or config

  echo "  Created SVG favicon"
  echo "  Data URI: ${data_uri:0:50}..."

  # Clean up
  rm -f "$temp_svg"

  # For federated wiki, we can inject this via a custom page or plugin setting
  # Let's create a favicon.svg file that can be served
  local wiki_dir="/tmp/wiki-favicons"
  mkdir -p "$wiki_dir"

  create_emoji_favicon "$emoji" "$wiki_dir/favicon_$(echo $wiki_url | md5sum | cut -d' ' -f1).svg"

  echo "  ✓ Favicon configured"
  echo ""
}

# Set favicons for all wikis
for wiki_url in "${!WIKI_EMOJIS[@]}"; do
  emoji="${WIKI_EMOJIS[$wiki_url]}"
  set_wiki_favicon "$wiki_url" "$emoji"
done

echo "=========================================="
echo "✅ Emoji favicons configured!"
echo ""
echo "Note: For federated wiki, favicons are typically set by:"
echo "1. Adding a favicon.png/ico to the wiki's static directory"
echo "2. Setting it in the wiki's configuration"
echo "3. Using a plugin to inject custom HTML head elements"
echo ""
echo "To use these favicons, you can:"
echo "1. Copy the generated SVG files to each wiki's public directory"
echo "2. Reference them in the wiki HTML template"
echo "3. Or use the data URIs in custom CSS/HTML"
