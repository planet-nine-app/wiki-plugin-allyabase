// Federation Dashboard Application

const WIKIS = [
  { name: 'Wiki 1', url: 'http://localhost:7070', emoji: '☮️🏴‍☠️👽', color: '#4CAF50' },
  { name: 'Wiki 2', url: 'http://localhost:7071', emoji: '🌈🦄✨', color: '#2196F3' },
  { name: 'Wiki 3', url: 'http://localhost:7072', emoji: '🔥💎🌟', color: '#FF9800' },
  { name: 'Wiki 4', url: 'http://localhost:7073', emoji: '🌊🐬🎨', color: '#00BCD4' },
  { name: 'Wiki 5', url: 'http://localhost:7074', emoji: '🎭🎪🎡', color: '#9C27B0' }
];

let allLocations = {};
let activityLog = [];
let stats = {
  wikiCount: 0,
  locationCount: 0,
  resolutionCount: 0,
  successCount: 0
};

// Initialize dashboard
async function init() {
  setupWikiSelect();
  setupEventListeners();
  await loadAllData();
  startAutoRefresh();
}

// Setup wiki selector
function setupWikiSelect() {
  const select = document.getElementById('wiki-select');
  WIKIS.forEach(wiki => {
    const option = document.createElement('option');
    option.value = wiki.url;
    option.textContent = `${wiki.name} (${wiki.emoji})`;
    select.appendChild(option);
  });
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('refresh-locations').addEventListener('click', loadAllData);
  document.getElementById('test-all').addEventListener('click', testAllResolutions);
  document.getElementById('resolve-btn').addEventListener('click', resolveShortcode);
  document.getElementById('clear-log').addEventListener('click', clearLog);

  // Allow Enter key to resolve
  document.getElementById('shortcode-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') resolveShortcode();
  });
}

// Load all federation data
async function loadAllData() {
  logActivity('🔄 Refreshing dashboard data...');

  const promises = WIKIS.map(wiki => loadWikiLocations(wiki));
  await Promise.all(promises);

  updateStats();
  renderNetwork();
  renderLocationsTable();
  renderHealth();

  logActivity('✅ Dashboard refreshed');
}

// Load locations from a specific wiki
async function loadWikiLocations(wiki) {
  try {
    const response = await fetch(`${wiki.url}/plugin/allyabase/federation/locations`);

    if (response.ok) {
      const locations = await response.json();
      allLocations[wiki.url] = { wiki, locations, online: true };
      return locations;
    } else {
      allLocations[wiki.url] = { wiki, locations: {}, online: false };
      return {};
    }
  } catch (err) {
    allLocations[wiki.url] = { wiki, locations: {}, online: false };
    return {};
  }
}

// Update statistics
function updateStats() {
  const onlineWikis = Object.values(allLocations).filter(w => w.online).length;
  const totalLocations = new Set();

  Object.values(allLocations).forEach(data => {
    Object.keys(data.locations).forEach(emoji => totalLocations.add(emoji));
  });

  stats.wikiCount = onlineWikis;
  stats.locationCount = totalLocations.size;

  document.getElementById('wiki-count').textContent = stats.wikiCount;
  document.getElementById('location-count').textContent = stats.locationCount;
  document.getElementById('resolution-count').textContent = stats.resolutionCount;

  const successRate = stats.resolutionCount > 0
    ? Math.round((stats.successCount / stats.resolutionCount) * 100)
    : 0;
  document.getElementById('success-rate').textContent = `${successRate}%`;
}

// Render network graph
function renderNetwork() {
  const container = document.getElementById('network-graph');
  container.innerHTML = '';

  const svg = `
    <svg width="100%" height="400" viewBox="0 0 800 400">
      ${WIKIS.map((wiki, i) => {
        const angle = (i / WIKIS.length) * 2 * Math.PI - Math.PI / 2;
        const x = 400 + Math.cos(angle) * 150;
        const y = 200 + Math.sin(angle) * 150;
        const data = allLocations[wiki.url];
        const status = data && data.online ? 'online' : 'offline';

        return `
          <g class="wiki-node ${status}">
            <circle cx="${x}" cy="${y}" r="40" fill="${wiki.color}" opacity="0.2"/>
            <circle cx="${x}" cy="${y}" r="30" fill="${wiki.color}"/>
            <text x="${x}" y="${y}" text-anchor="middle" dy="5" font-size="20" fill="white">
              ${wiki.emoji.split('').slice(0, 1).join('')}
            </text>
            <text x="${x}" y="${y + 60}" text-anchor="middle" font-size="12" fill="#333">
              ${wiki.name}
            </text>
            <circle cx="${x + 25}" cy="${y - 25}" r="8"
              fill="${status === 'online' ? '#4CAF50' : '#f44336'}"
              stroke="white" stroke-width="2"/>
          </g>
        `;
      }).join('')}

      ${WIKIS.flatMap((wiki1, i) =>
        WIKIS.slice(i + 1).map((wiki2, j) => {
          const angle1 = (i / WIKIS.length) * 2 * Math.PI - Math.PI / 2;
          const x1 = 400 + Math.cos(angle1) * 150;
          const y1 = 200 + Math.sin(angle1) * 150;

          const angle2 = ((i + j + 1) / WIKIS.length) * 2 * Math.PI - Math.PI / 2;
          const x2 = 400 + Math.cos(angle2) * 150;
          const y2 = 200 + Math.sin(angle2) * 150;

          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
            stroke="#ddd" stroke-width="1" opacity="0.5"/>`;
        })
      ).join('')}
    </svg>
  `;

  container.innerHTML = svg;
}

// Render locations table
function renderLocationsTable() {
  const container = document.getElementById('locations-table');

  const locationMap = new Map();

  Object.values(allLocations).forEach(data => {
    if (data.online) {
      Object.entries(data.locations).forEach(([emoji, url]) => {
        if (!locationMap.has(emoji)) {
          locationMap.set(emoji, []);
        }
        locationMap.get(emoji).push({ wiki: data.wiki, url });
      });
    }
  });

  if (locationMap.size === 0) {
    container.innerHTML = '<p class="empty-state">No locations registered yet</p>';
    return;
  }

  let html = '<table class="data-table"><thead><tr>';
  html += '<th>Emoji ID</th><th>Target URL</th><th>Known By</th><th>Actions</th>';
  html += '</tr></thead><tbody>';

  locationMap.forEach((instances, emoji) => {
    const firstInstance = instances[0];
    const knownByCount = instances.length;

    html += '<tr>';
    html += `<td class="emoji-cell">${emoji}</td>`;
    html += `<td><code>${firstInstance.url}</code></td>`;
    html += `<td><span class="badge">${knownByCount}/${WIKIS.length} wikis</span></td>`;
    html += `<td><button class="btn btn-small" onclick="testLocation('${emoji}')">Test</button></td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// Render health status
function renderHealth() {
  const container = document.getElementById('health-status');

  let html = '<div class="health-grid">';

  WIKIS.forEach(wiki => {
    const data = allLocations[wiki.url];
    const online = data && data.online;
    const locationCount = online ? Object.keys(data.locations).length : 0;

    html += `
      <div class="health-card ${online ? 'online' : 'offline'}">
        <div class="health-header">
          <span class="health-emoji">${wiki.emoji}</span>
          <span class="health-name">${wiki.name}</span>
          <span class="health-status">${online ? '●' : '○'}</span>
        </div>
        <div class="health-body">
          <div class="health-stat">
            <span class="health-label">URL:</span>
            <span class="health-value"><code>${wiki.url}</code></span>
          </div>
          <div class="health-stat">
            <span class="health-label">Locations:</span>
            <span class="health-value">${locationCount}</span>
          </div>
          <div class="health-stat">
            <span class="health-label">Status:</span>
            <span class="health-value ${online ? 'text-success' : 'text-error'}">
              ${online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// Test a specific location
async function testLocation(emoji) {
  const shortcode = `💚${emoji}/test`;
  const wikiUrl = WIKIS[0].url;

  logActivity(`🧪 Testing location: ${emoji}`);

  try {
    const response = await fetch(`${wikiUrl}/plugin/allyabase/federation/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortcode, currentWikiUrl: wikiUrl })
    });

    const result = await response.json();

    stats.resolutionCount++;
    if (result.success) {
      stats.successCount++;
      logActivity(`✅ ${emoji} → ${result.resolvedUrl}`);
    } else {
      logActivity(`❌ ${emoji} failed: ${result.error}`);
    }

    updateStats();
  } catch (err) {
    stats.resolutionCount++;
    logActivity(`❌ ${emoji} error: ${err.message}`);
    updateStats();
  }
}

// Test all resolutions
async function testAllResolutions() {
  logActivity('🧪 Testing all locations...');

  const locationMap = new Map();
  Object.values(allLocations).forEach(data => {
    if (data.online) {
      Object.keys(data.locations).forEach(emoji => locationMap.add(emoji));
    }
  });

  for (const emoji of locationMap) {
    await testLocation(emoji);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  logActivity('✅ All tests complete');
}

// Resolve a shortcode
async function resolveShortcode() {
  const shortcode = document.getElementById('shortcode-input').value.trim();
  const wikiUrl = document.getElementById('wiki-select').value;
  const resultDiv = document.getElementById('resolution-result');

  if (!shortcode) {
    resultDiv.innerHTML = '<div class="alert alert-error">Please enter a shortcode</div>';
    return;
  }

  resultDiv.innerHTML = '<div class="alert alert-info">Resolving...</div>';
  logActivity(`🔍 Resolving: ${shortcode}`);

  try {
    const response = await fetch(`${wikiUrl}/plugin/allyabase/federation/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortcode, currentWikiUrl: wikiUrl })
    });

    const result = await response.json();

    stats.resolutionCount++;

    if (result.success) {
      stats.successCount++;
      resultDiv.innerHTML = `
        <div class="alert alert-success">
          <h3>✅ Resolved Successfully</h3>
          <p><strong>Shortcode:</strong> <code>${shortcode}</code></p>
          <p><strong>Resolved URL:</strong> <a href="${result.resolvedUrl}" target="_blank">${result.resolvedUrl}</a></p>
        </div>
      `;
      logActivity(`✅ ${shortcode} → ${result.resolvedUrl}`);
    } else {
      resultDiv.innerHTML = `
        <div class="alert alert-error">
          <h3>❌ Resolution Failed</h3>
          <p><strong>Error:</strong> ${result.error}</p>
        </div>
      `;
      logActivity(`❌ ${shortcode} failed: ${result.error}`);
    }

    updateStats();
  } catch (err) {
    stats.resolutionCount++;
    resultDiv.innerHTML = `
      <div class="alert alert-error">
        <h3>❌ Error</h3>
        <p>${err.message}</p>
      </div>
    `;
    logActivity(`❌ ${shortcode} error: ${err.message}`);
    updateStats();
  }
}

// Log activity
function logActivity(message) {
  const timestamp = new Date().toLocaleTimeString();
  activityLog.unshift({ timestamp, message });

  if (activityLog.length > 50) {
    activityLog = activityLog.slice(0, 50);
  }

  renderActivityLog();
}

// Render activity log
function renderActivityLog() {
  const container = document.getElementById('activity-log');

  if (activityLog.length === 0) {
    container.innerHTML = '<p class="empty-state">No activity yet</p>';
    return;
  }

  let html = '<div class="log-entries">';
  activityLog.forEach(entry => {
    html += `
      <div class="log-entry">
        <span class="log-time">${entry.timestamp}</span>
        <span class="log-message">${entry.message}</span>
      </div>
    `;
  });
  html += '</div>';

  container.innerHTML = html;
}

// Clear log
function clearLog() {
  activityLog = [];
  renderActivityLog();
  logActivity('🗑️ Log cleared');
}

// Auto-refresh
function startAutoRefresh() {
  setInterval(async () => {
    await loadAllData();
  }, 30000); // Refresh every 30 seconds
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
