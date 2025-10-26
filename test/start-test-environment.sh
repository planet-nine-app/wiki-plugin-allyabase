#!/bin/bash

set -e

FEDERATE=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --federate)
      FEDERATE=true
      shift
      ;;
    --clean)
      CLEAN=true
      shift
      ;;
  esac
done

echo "🚀 Starting Federated Wiki Test Environment"
echo "==========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# Clean up existing containers if requested
if [ "$CLEAN" = true ]; then
  echo "🧹 Cleaning up existing containers and volumes..."
  docker-compose down -v
  echo "✅ Cleanup completed"
  echo ""
fi

# Build and start the containers
echo "🔨 Building Docker images..."
docker-compose build

echo ""
echo "🏗️  Starting wiki instances..."
docker-compose up -d

echo ""
echo "⏳ Waiting for wikis to start..."
sleep 5

# Check if containers are running
echo ""
echo "📊 Container Status:"
docker-compose ps

echo ""

# Function to check if a wiki is responding
check_wiki_health() {
  local url=$1
  # Accept 200, 302 (redirect), or 404 as healthy responses
  if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|302\|404"; then
    return 0
  else
    return 1
  fi
}

# Wait for wikis to be ready if we're going to federate
if [ "$FEDERATE" = true ]; then
  echo "⏳ Waiting for wikis to be ready..."
  echo ""

  WIKI_URLS=("http://localhost:7070" "http://localhost:7071" "http://localhost:7072" "http://localhost:7073" "http://localhost:7074")
  WIKI_NAMES=("Wiki 1" "Wiki 2" "Wiki 3" "Wiki 4" "Wiki 5")

  MAX_WAIT=120  # Maximum 2 minutes
  ELAPSED=0

  while [ $ELAPSED -lt $MAX_WAIT ]; do
    all_ready=true

    for i in "${!WIKI_URLS[@]}"; do
      url="${WIKI_URLS[$i]}"
      name="${WIKI_NAMES[$i]}"

      if ! check_wiki_health "$url"; then
        all_ready=false
        echo "  Waiting for $name ($url)..."
      fi
    done

    if [ "$all_ready" = true ]; then
      echo ""
      echo "✅ All wikis are ready!"
      break
    fi

    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done

  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo ""
    echo "⚠️  Timeout waiting for wikis to be ready"
    echo "   Some wikis may not have started properly"
    echo "   Check logs: docker-compose logs -f"
    echo ""
  fi
fi

echo ""
echo "🎉 Test environment is ready!"
echo ""
echo "📋 Wiki URLs:"
echo "  Wiki 1 (with plugin): http://localhost:7070"
echo "  Wiki 2 (with plugin): http://localhost:7071"
echo "  Wiki 3 (with plugin): http://localhost:7072"
echo "  Wiki 4 (plain):       http://localhost:7073"
echo "  Wiki 5 (plain):       http://localhost:7074"
echo ""
echo "ℹ️  Wikis 1-3 have the allyabase plugin installed"
echo "ℹ️  Wikis 4-5 are plain wikis without the plugin"
echo ""
echo "🔧 Useful Commands:"
echo "  View logs (all):    docker-compose logs -f"
echo "  View logs (wiki1):  docker-compose logs -f wiki1"
echo "  View logs (wiki2):  docker-compose logs -f wiki2"
echo "  View logs (wiki3):  docker-compose logs -f wiki3"
echo "  View logs (wiki4):  docker-compose logs -f wiki4"
echo "  View logs (wiki5):  docker-compose logs -f wiki5"
echo "  Stop all:           docker-compose down"
echo "  Stop and clean:     docker-compose down -v"
echo "  Restart:            docker-compose restart"
echo ""

# Setup federation if requested
if [ "$FEDERATE" = true ]; then
  echo "🌐 Setting up federation..."
  echo ""

  # First, create allyabase pages to load the plugin
  echo "📄 Creating allyabase pages to activate plugin..."
  ./create-allyabase-pages.sh

  echo ""
  echo "📋 Creating roster pages for native federation..."
  ./create-roster-pages.sh

  echo ""
  echo "👋 Creating welcome and join federation pages..."
  ./create-welcome-pages.sh

  echo ""
  echo "⏳ Waiting 5 seconds for plugins to load..."
  sleep 5
  echo ""

  # Run the federation setup script
  ./setup-federation.sh

  echo ""
fi

if [ "$FEDERATE" = false ]; then
  echo "💡 To test federation, create a page on one wiki and reference it from another!"
  echo "💡 Or run with --federate flag to automatically set up federation:"
  echo "   ./start-test-environment.sh --federate"
fi
