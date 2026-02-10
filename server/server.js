(function() {
const { exec, spawn } = require('child_process');
const path = require('path');
const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
const federationResolver = require('./federation-resolver');
const deployment = require('./deployment');
const bdoModule = require('bdo-js');
const bdo = bdoModule.default || bdoModule;

// Expected ports for all services based on allyabase_setup.sh
const SERVICE_PORTS = {
  julia: 3000,
  continuebee: 2999,
  fount: 3006,
  bdo: 3003,
  joan: 3004,
  addie: 3005,
  pref: 3002,
  dolores: 3007,
  prof: 3008,
  covenant: 3011,
  minnie: 2525,
  aretha: 7277,
  sanora: 7243
};

// PID file for tracking PM2 process
const PM2_PID_FILE = path.join(__dirname, 'allyabase-pm2.pid');

let baseStatus = {
  running: false,
  services: {},
  lastLaunch: null
};

let allyabaseProcess = null;

// Function to load wiki's owner.json for keypair and location emoji
function loadWikiKeypair() {
  try {
    const ownerPath = path.join(process.env.HOME || '/root', '.wiki/status/owner.json');
    if (fs.existsSync(ownerPath)) {
      const ownerData = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
      if (ownerData.sessionlessKeys) {
        return {
          pubKey: ownerData.sessionlessKeys.pubKey,
          privateKey: ownerData.sessionlessKeys.privateKey,
          locationEmoji: ownerData.locationEmoji,
          federationEmoji: ownerData.federationEmoji
        };
      }
    }
    console.warn('[wiki-plugin-allyabase] No owner.json or sessionlessKeys found');
    return null;
  } catch (err) {
    console.error('[wiki-plugin-allyabase] Error loading wiki keypair:', err);
    return null;
  }
}

// Function to kill process by PID
function killProcessByPid(pid) {
  try {
    // CRITICAL: Never kill PID 1 in Docker containers - it's the main container process
    if (pid === 1) {
      console.log(`[wiki-plugin-allyabase] ⚠️  Skipping PID 1 (init process) - this is likely the wiki server itself in Docker`);
      return false;
    }

    // Also don't kill our own process
    if (pid === process.pid) {
      console.log(`[wiki-plugin-allyabase] ⚠️  Skipping PID ${pid} (this is us!)`);
      return false;
    }

    console.log(`[wiki-plugin-allyabase] Attempting to kill process ${pid}...`);
    process.kill(pid, 'SIGTERM');

    // Wait a bit, then force kill if still running
    setTimeout(() => {
      try {
        process.kill(pid, 0); // Check if still alive
        console.log(`[wiki-plugin-allyabase] Process ${pid} still running, sending SIGKILL...`);
        process.kill(pid, 'SIGKILL');
      } catch (err) {
        // Process is dead, which is what we want
        console.log(`[wiki-plugin-allyabase] ✅ Process ${pid} terminated successfully`);
      }
    }, 2000);

    return true;
  } catch (err) {
    if (err.code === 'ESRCH') {
      console.log(`[wiki-plugin-allyabase] Process ${pid} does not exist`);
    } else {
      console.error(`[wiki-plugin-allyabase] Error killing process ${pid}:`, err.message);
    }
    return false;
  }
}

// Function to find and kill process using a specific port
function killProcessByPort(port) {
  return new Promise((resolve) => {
    // Use lsof to find process using the port
    exec(`lsof -ti tcp:${port}`, (err, stdout, stderr) => {
      if (err || !stdout.trim()) {
        console.log(`[wiki-plugin-allyabase] No process found using port ${port}`);
        resolve(false);
        return;
      }

      const pid = parseInt(stdout.trim(), 10);
      console.log(`[wiki-plugin-allyabase] Found process ${pid} using port ${port}`);

      const killed = killProcessByPid(pid);
      resolve(killed);
    });
  });
}

// Function to stop PM2 and all managed services
async function stopPM2() {
  console.log('[wiki-plugin-allyabase] Stopping PM2 and all services...');

  return new Promise((resolve) => {
    // Try to stop PM2 gracefully using pm2 kill
    exec('pm2 kill', (err, stdout, stderr) => {
      if (err) {
        console.log(`[wiki-plugin-allyabase] PM2 kill failed (might not be running): ${err.message}`);
      } else {
        console.log(`[wiki-plugin-allyabase] PM2 killed successfully`);
      }

      // Clean up PID file
      cleanupPidFile();
      resolve();
    });
  });
}

// Function to clean up orphaned processes from previous run
async function cleanupOrphanedProcesses() {
  console.log('[wiki-plugin-allyabase] Checking for orphaned allyabase processes...');

  // Check PID file for PM2 process
  if (fs.existsSync(PM2_PID_FILE)) {
    try {
      const pidString = fs.readFileSync(PM2_PID_FILE, 'utf8').trim();
      const pid = parseInt(pidString, 10);

      console.log(`[wiki-plugin-allyabase] Found PID file with PID ${pid}`);
      killProcessByPid(pid);

      // Wait for process to die
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Clean up PID file
      fs.unlinkSync(PM2_PID_FILE);
      console.log(`[wiki-plugin-allyabase] Cleaned up PID file`);
    } catch (err) {
      console.error(`[wiki-plugin-allyabase] Error reading PID file:`, err.message);
    }
  }

  // Stop PM2 if it's running (cleans up all managed services)
  await stopPM2();

  // Detect if we're in a Docker container
  // In Docker, services run in separate containers, so port cleanup is unnecessary and dangerous
  const isDocker = fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv');

  if (isDocker) {
    console.log('[wiki-plugin-allyabase] 🐳 Detected Docker environment - skipping port cleanup');
    console.log('[wiki-plugin-allyabase] In Docker, services should run in separate containers, not as processes on ports');
    console.log('[wiki-plugin-allyabase] Cleanup complete (Docker mode)');
    return;
  }

  // Fallback: kill any processes using our ports (only in non-Docker environments)
  console.log('[wiki-plugin-allyabase] Cleaning up any processes on service ports...');
  for (const [service, port] of Object.entries(SERVICE_PORTS)) {
    await killProcessByPort(port);
  }

  // Extra wait to ensure everything is dead
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('[wiki-plugin-allyabase] Cleanup complete');
}

// Function to write PID file
function writePidFile(pid) {
  try {
    fs.writeFileSync(PM2_PID_FILE, pid.toString(), 'utf8');
    console.log(`[wiki-plugin-allyabase] Wrote PID ${pid} to ${PM2_PID_FILE}`);
  } catch (err) {
    console.error(`[wiki-plugin-allyabase] Error writing PID file:`, err.message);
  }
}

// Function to clean up PID file
function cleanupPidFile() {
  try {
    if (fs.existsSync(PM2_PID_FILE)) {
      fs.unlinkSync(PM2_PID_FILE);
      console.log(`[wiki-plugin-allyabase] Cleaned up PID file`);
    }
  } catch (err) {
    console.error(`[wiki-plugin-allyabase] Error cleaning up PID file:`, err.message);
  }
}

// Function to gracefully shutdown allyabase
async function shutdownAllyabase() {
  console.log('[wiki-plugin-allyabase] Shutting down allyabase services...');

  if (allyabaseProcess && !allyabaseProcess.killed) {
    console.log(`[wiki-plugin-allyabase] Killing allyabase process ${allyabaseProcess.pid}...`);

    try {
      allyabaseProcess.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (allyabaseProcess && !allyabaseProcess.killed) {
          console.log(`[wiki-plugin-allyabase] Force killing allyabase process...`);
          allyabaseProcess.kill('SIGKILL');
        }
      }, 2000);
    } catch (err) {
      console.error(`[wiki-plugin-allyabase] Error killing allyabase:`, err.message);
    }
  }

  // Stop PM2
  await stopPM2();
  cleanupPidFile();
}

// Function to check if a port is responding
function checkPort(port) {
  return new Promise((resolve) => {
    const options = {
      host: 'localhost',
      port: port,
      method: 'GET',
      path: '/',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      resolve({ port, status: 'running', httpCode: res.statusCode });
    });

    req.on('error', () => {
      resolve({ port, status: 'not running' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ port, status: 'timeout' });
    });

    req.end();
  });
}

// Function to run healthcheck on all services
async function healthcheck() {
  const results = {};

  for (const [service, port] of Object.entries(SERVICE_PORTS)) {
    const result = await checkPort(port);
    results[service] = {
      port,
      status: result.status,
      httpCode: result.httpCode
    };
  }

  // Update base status
  baseStatus.services = results;
  const runningServices = Object.values(results).filter(r => r.status === 'running').length;
  baseStatus.running = runningServices > 0;

  return {
    timestamp: new Date().toISOString(),
    totalServices: Object.keys(SERVICE_PORTS).length,
    runningServices,
    services: results
  };
}

async function startServer(params) {
  const app = params.app;

  console.log('🔗 wiki-plugin-allyabase starting...');

  // Clean up any orphaned allyabase/PM2 processes from previous run
  await cleanupOrphanedProcesses();

  // Owner middleware to protect state-changing endpoints
  const owner = function (req, res, next) {
    if (!app.securityhandler.isAuthorized(req)) {
      return res.status(401).send('must be owner')
    }
    return next()
  };

  // CORS middleware for federation endpoints
  // Allows cross-origin requests from other federated wikis
  // Use regex to match all federation paths (Express doesn't support * wildcard in newer versions)
  app.use(/^\/plugin\/allyabase\/federation\/.*/, function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  // CORS for base-emoji endpoint (needed for fork detection)
  app.use('/plugin/allyabase/base-emoji', function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  // Create proxy server
  const proxy = httpProxy.createProxyServer({});

  // Handle proxy errors
  proxy.on('error', function(err, req, res) {
    console.error('[PROXY ERROR]', err.message);
    console.error('[PROXY ERROR] Stack:', err.stack);

    // Return JSON error response for API compatibility
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Service not available',
      message: err.message
    }));
  });

  // Log proxy request and restream body if needed
  proxy.on('proxyReq', function(proxyReq, req, res, options) {
    console.log('[PROXY] Request sent to target:', proxyReq.path);

    // If body was parsed by Express, we need to restream it
    if (req.body && Object.keys(req.body).length > 0) {
      let bodyData = JSON.stringify(req.body);
      console.log('[PROXY] Restreaming body:', bodyData.substring(0, 200));
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
      proxyReq.end();
    }
  });

  // Log proxy response
  proxy.on('proxyRes', function(proxyRes, req, res) {
    console.log('[PROXY] Response received from target, status:', proxyRes.statusCode);
  });

  // Special handler for BDO service to intercept emojicode requests
  // Handles both BDO service emojicodes and federated emojicodes
  app.get('/plugin/allyabase/bdo/emoji/:emojicode', async function(req, res) {
    try {
      const emojicode = decodeURIComponent(req.params.emojicode);
      console.log(`[BDO EMOJI] GET /emoji/${emojicode}`);

      // Check if this is a federated shortcode (has a slash) or BDO service emojicode (no slash)
      // BDO service emojicode: 💚{3-location-emoji}{5-uuid-emoji} (9 emoji total, no slash)
      // Federated shortcode: 💚{location-emoji}/bdo/{uuid} (has slash and path)
      const hasSlash = emojicode.includes('/');

      if (hasSlash) {
        // This is a federated shortcode with a path - handle federation
        console.log('[BDO EMOJI] Detected federated shortcode format (contains /)');

        const parsed = federationResolver.parseFederatedShortcode(emojicode);
        if (!parsed || !parsed.resourcePath || !parsed.resourcePath.includes('/bdo/')) {
          return res.status(400).json({
            error: 'Invalid federated shortcode format'
          });
        }
        console.log('[BDO EMOJI] Parsed:', JSON.stringify(parsed, null, 2));

        // Extract UUID from resource path
        const uuidMatch = parsed.resourcePath.match(/\/bdo\/([a-f0-9-]+)/);
        if (!uuidMatch) {
          console.log('[BDO EMOJI] No UUID found in resource path');
          return res.status(400).json({
            error: 'Invalid BDO path in emojicode. Expected format: /bdo/{uuid}'
          });
        }
        const uuid = uuidMatch[1];
        console.log('[BDO EMOJI] UUID:', uuid);

        // Resolve location emoji to URL
        const currentWikiUrl = `http://localhost:${req.socket.localPort}`;
        const baseTargetUrl = await federationResolver.resolveFederatedShortcode(
          `💚${parsed.locationIdentifier}/`,
          currentWikiUrl
        );

        const targetWikiUrl = baseTargetUrl.replace(/\/$/, '');
        console.log('[BDO EMOJI] Target wiki:', targetWikiUrl);
        console.log('[BDO EMOJI] Current wiki:', currentWikiUrl);

        // Check if the target is this wiki (local request)
        if (targetWikiUrl === currentWikiUrl || targetWikiUrl.includes(`localhost:${req.socket.localPort}`)) {
          console.log('[BDO EMOJI] Local federated request - fetching from local BDO service');

          // Fetch from local BDO service by UUID
          const keypair = loadWikiKeypair();
          if (!keypair) {
            console.error('[BDO EMOJI] No keypair found for authentication');
            return res.status(500).json({
              error: 'Wiki keypair not found. Cannot authenticate request.'
            });
          }

          const originalBaseURL = bdo.baseURL;
          bdo.baseURL = 'http://localhost:3003/';

          const getKeys = async () => keypair;
          bdo.getKeys = getKeys;

          const bdoData = await bdo.getBDO(uuid, '', keypair.pubKey);
          bdo.baseURL = originalBaseURL;

          console.log('[BDO EMOJI] Successfully retrieved local BDO via federation');
          return res.json(bdoData);
        } else {
          // Remote federated request
          console.log('[BDO EMOJI] Remote federated request - fetching from remote wiki');
          const targetUrl = `${targetWikiUrl}/plugin/allyabase/bdo/emoji/${encodeURIComponent(emojicode)}`;
          console.log('[BDO EMOJI] Fetching from:', targetUrl);

          const response = await fetch(targetUrl);
          const bdoData = await response.json();

          console.log('[BDO EMOJI] Successfully retrieved remote federated BDO');
          return res.json(bdoData);
        }
      }

      // No slash - this is a BDO service emojicode
      // Format: {3-location-emoji}{5-uuid-emoji} (8 emoji total)
      // or with federation prefix: 💚{3-location-emoji}{5-uuid-emoji} (9 emoji total)
      // Example: ☮️🏴📢😂🎭🔮📣 or 💚☮️🏴📢😂🎭🔮📣
      console.log('[BDO EMOJI] Detected BDO service emojicode format (no slash)');

      // Extract the first 3 emoji as the location identifier
      // Use a more comprehensive emoji regex that handles all emoji including those without Emoji_Presentation
      // This includes emoji like 🏔 (U+1F3D4) which need variation selector FE0F
      const emojiRegex = /[\u{1F1E6}-\u{1F1FF}]{2}|(?:[\u{1F3F4}\u{1F3F3}][\u{FE0F}]?(?:\u{200D}[\u{2620}\u{2695}\u{2696}\u{2708}\u{1F308}][\u{FE0F}]?)?)|(?:\p{Emoji_Presentation}|\p{Emoji})[\u{FE0F}\u{200D}]?(?:\u{200D}(?:\p{Emoji_Presentation}|\p{Emoji})[\u{FE0F}]?)*/gu;
      const emojis = emojicode.match(emojiRegex) || [];
      console.log('[BDO EMOJI] Extracted emojis:', emojis);
      console.log('[BDO EMOJI] Emoji count:', emojis.length);

      // Determine location based on whether it starts with 💚
      // With 💚: 9 emoji total (💚 + 3 location + 5 UUID), location at indices 1, 2, 3
      // Without 💚: 8 emoji total (3 location + 5 UUID), location at indices 0, 1, 2
      let locationEmojis;
      let hasGreenHeart = emojis[0] === '💚';

      if (hasGreenHeart) {
        // Format: 💚 + 3 location + 5 UUID = 9 emoji
        if (emojis.length !== 9) {
          console.log('[BDO EMOJI] Invalid emoji count with 💚');
          return res.status(400).json({
            error: 'Invalid emojicode format',
            detail: `Expected 9 emoji (💚 + 3 location + 5 UUID), got ${emojis.length}`,
            emojicode,
            emojis
          });
        }
        // Skip the green heart (index 0), take indices 1, 2, 3
        locationEmojis = [emojis[1], emojis[2], emojis[3]];
        console.log('[BDO EMOJI] Format: 💚 + 3 location + 5 UUID (9 total)');
      } else {
        // Format: 3 location + 5 UUID = 8 emoji
        if (emojis.length !== 8) {
          console.log('[BDO EMOJI] Invalid emoji count without 💚');
          return res.status(400).json({
            error: 'Invalid emojicode format',
            detail: `Expected 8 emoji (3 location + 5 UUID), got ${emojis.length}`,
            emojicode,
            emojis
          });
        }
        // Take indices 0, 1, 2
        locationEmojis = [emojis[0], emojis[1], emojis[2]];
        console.log('[BDO EMOJI] Format: 3 location + 5 UUID (8 total, no 💚)');
      }

      const locationIdentifier = locationEmojis.join('');
      console.log('[BDO EMOJI] Location emoji (extracted):', locationEmojis);
      console.log('[BDO EMOJI] Location identifier (joined):', locationIdentifier);

      // Check if this location is registered (indicates cross-wiki request)
      const locations = federationResolver.getRegisteredLocations();
      console.log('[BDO EMOJI] Registered locations:', Object.keys(locations));

      const targetWikiUrls = locations[locationIdentifier];

      if (targetWikiUrls && targetWikiUrls.length > 0) {
        // This is a cross-wiki request - try all registered URLs
        const currentWikiUrl = `http://localhost:${req.socket.localPort}`;
        const wikiInfo = loadWikiKeypair();
        const thisWikiLocationEmoji = wikiInfo ? wikiInfo.locationEmoji : null;

        console.log('[BDO EMOJI] Cross-wiki request detected');
        console.log('[BDO EMOJI] Target wikis (${targetWikiUrls.length}): ${targetWikiUrls.join(', ')}');
        console.log('[BDO EMOJI] Current wiki:', currentWikiUrl);
        console.log('[BDO EMOJI] This wiki location emoji:', thisWikiLocationEmoji);

        // Try all URLs in parallel
        const fetchPromises = targetWikiUrls.map(async (targetUrl) => {
          const isLocalWiki = (targetUrl === currentWikiUrl ||
                              targetUrl.includes(`localhost:${req.socket.localPort}`) ||
                              (thisWikiLocationEmoji && locationIdentifier === thisWikiLocationEmoji));

          if (isLocalWiki) {
            console.log(`[BDO EMOJI] Fetching from local service for ${targetUrl}`);
            try {
              const localUrl = `http://localhost:3003/emoji/${encodeURIComponent(emojicode)}`;
              const response = await fetch(localUrl);
              const data = await response.json();
              return { url: targetUrl, success: !data.error, data };
            } catch (err) {
              return { url: targetUrl, success: false, error: err.message };
            }
          } else {
            console.log(`[BDO EMOJI] Forwarding to remote wiki: ${targetUrl}`);
            try {
              const forwardUrl = `${targetUrl}/plugin/allyabase/bdo/emoji/${encodeURIComponent(emojicode)}`;
              const response = await fetch(forwardUrl);
              const data = await response.json();
              return { url: targetUrl, success: !data.error, data };
            } catch (err) {
              return { url: targetUrl, success: false, error: err.message };
            }
          }
        });

        const results = await Promise.all(fetchPromises);
        console.log(`[BDO EMOJI] Fetched from ${results.length} URLs`);

        // Filter successful results
        const successfulResults = results.filter(r => r.success);
        console.log(`[BDO EMOJI] ${successfulResults.length}/${results.length} URLs returned BDOs`);

        if (successfulResults.length === 0) {
          // No wikis had this BDO
          return res.status(404).json({
            error: 'BDO not found',
            detail: `Tried ${results.length} wiki(s), none had this BDO`,
            locationIdentifier,
            emojicode,
            attempts: results.map(r => ({ url: r.url, error: r.error || 'Not found' }))
          });
        }

        // Return all successful results
        if (successfulResults.length === 1) {
          // Single result - return directly for backward compatibility
          console.log('[BDO EMOJI] Single BDO found, returning directly');
          return res.json(successfulResults[0].data);
        } else {
          // Multiple results - return as array with metadata
          console.log(`[BDO EMOJI] Multiple BDOs found (${successfulResults.length}), returning array`);
          return res.json({
            count: successfulResults.length,
            results: successfulResults.map(r => ({ source: r.url, bdo: r.data }))
          });
        }
      } else {
        console.log('[BDO EMOJI] Location not registered, assuming local BDO');
      }

      // Fetch from local BDO service
      console.log('[BDO EMOJI] Fetching from local BDO service');
      const bdoServiceUrl = `http://localhost:3003/emoji/${encodeURIComponent(emojicode)}`;
      console.log('[BDO EMOJI] Local BDO service URL:', bdoServiceUrl);

      const response = await fetch(bdoServiceUrl);
      const bdoData = await response.json();

      if (bdoData.error) {
        console.log('[BDO EMOJI] Local BDO service returned error:', bdoData.error);
        return res.status(response.status || 404).json({
          error: 'Local BDO not found',
          detail: bdoData.error,
          locationIdentifier,
          registeredLocations: Object.keys(locations),
          emojicode
        });
      }

      console.log('[BDO EMOJI] Successfully retrieved BDO from local service');
      console.log('[BDO EMOJI] BDO data type:', typeof bdoData);
      console.log('[BDO EMOJI] BDO data keys:', bdoData ? Object.keys(bdoData) : 'null');

      return res.json(bdoData);

    } catch (err) {
      console.error('[BDO EMOJI] Error:', err);
      res.status(500).json({
        error: 'Failed to fetch BDO by emojicode',
        message: err.message
      });
    }
  });

  // Create proxy routes for each service
  Object.entries(SERVICE_PORTS).forEach(([service, port]) => {
    // Proxy all methods (GET, POST, PUT, DELETE, etc.)
    // Use regex pattern instead of wildcard to avoid PathError in newer path-to-regexp
    app.all(new RegExp(`^\\/plugin\\/allyabase\\/${service}\\/.*`), function(req, res) {
      const targetPath = req.url.replace(`/plugin/allyabase/${service}`, '');
      console.log(`[PROXY] ${req.method} /plugin/allyabase/${service}${targetPath} -> http://localhost:${port}${targetPath}`);
      console.log(`[PROXY] Headers:`, JSON.stringify(req.headers, null, 2));
      req.url = targetPath;
      proxy.web(req, res, {
        target: `http://localhost:${port}`,
        changeOrigin: true
      });
    });

    // Also handle root service path
    app.all(`/plugin/allyabase/${service}`, function(req, res) {
      console.log(`[PROXY] ${req.method} /plugin/allyabase/${service} -> http://localhost:${port}/`);
      console.log(`[PROXY] Headers:`, JSON.stringify(req.headers, null, 2));
      req.url = '/';
      proxy.web(req, res, {
        target: `http://localhost:${port}`,
        changeOrigin: true
      });
    });
  });

  // Endpoint to launch the allyabase
  app.post('/plugin/allyabase/launch', owner, async function(req, res) {
    try {
      // Use script bundled with the plugin
      const scriptPath = path.join(__dirname, '../allyabase_setup.sh');

      console.log('='.repeat(80));
      console.log('🚀 LAUNCHING ALLYABASE');
      console.log('='.repeat(80));
      console.log('Script path:', scriptPath);
      console.log('Timestamp:', new Date().toISOString());
      console.log('-'.repeat(80));

      // Launch the setup script with spawn
      allyabaseProcess = spawn('bash', [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'], // Don't inherit stdio, capture it
        env: process.env,
        detached: false // Keep as child of this process
      });

      // Write PID file immediately after spawning
      writePidFile(allyabaseProcess.pid);

      // Log stdout
      allyabaseProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          console.log(`[allyabase:${allyabaseProcess.pid}] ${line}`);
        });
      });

      // Log stderr
      allyabaseProcess.stderr.on('data', (data) => {
        console.error(`[allyabase:${allyabaseProcess.pid}] ERROR: ${data.toString().trim()}`);
      });

      // Handle process exit
      allyabaseProcess.on('exit', (code, signal) => {
        console.log('-'.repeat(80));
        if (code === 0) {
          console.log('✅ Allyabase setup completed successfully');
        } else if (code) {
          console.log(`⚠️  Allyabase setup exited with code: ${code}`);
        } else if (signal) {
          console.log(`⚠️  Allyabase setup killed by signal: ${signal}`);
        }
        console.log('='.repeat(80));

        // Clean up PID file when process exits
        cleanupPidFile();
        allyabaseProcess = null;
      });

      allyabaseProcess.on('error', (error) => {
        console.error('❌ Error spawning allyabase process:', error);
        cleanupPidFile();
        allyabaseProcess = null;
      });

      baseStatus.lastLaunch = new Date().toISOString();

      res.send({
        success: true,
        message: 'Allyabase launch initiated',
        timestamp: baseStatus.lastLaunch,
        scriptPath: scriptPath,
        pid: allyabaseProcess.pid
      });
    } catch (err) {
      console.error('❌ Error launching allyabase:', err);
      console.error('Error stack:', err.stack);
      res.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Endpoint to get healthcheck
  app.get('/plugin/allyabase/healthcheck', async function(req, res) {
    try {
      const health = await healthcheck();
      res.send(health);
    } catch (err) {
      console.error('Error running healthcheck:', err);
      res.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Endpoint to get current status
  app.get('/plugin/allyabase/status', function(req, res) {
    res.send(baseStatus);
  });

  // Endpoint to get wiki's base emoji identifier
  app.get('/plugin/allyabase/base-emoji', function(req, res) {
    try {
      const ownerPath = path.join(process.env.HOME || '/root', '.wiki/status/owner.json');
      if (fs.existsSync(ownerPath)) {
        const ownerData = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));

        const response = {
          federationEmoji: ownerData.federationEmoji || '💚',
          locationEmoji: ownerData.locationEmoji || null,
          baseEmoji: (ownerData.federationEmoji || '💚') + (ownerData.locationEmoji || ''),
          warnings: []
        };

        // Validation warnings
        if (!ownerData.locationEmoji) {
          response.warnings.push({
            severity: 'error',
            message: 'Missing locationEmoji in owner.json',
            fix: 'Add "locationEmoji": "🔥💎🌟" (3 emoji) to your owner.json'
          });
        } else if (!ownerData.federationEmoji) {
          response.warnings.push({
            severity: 'warning',
            message: 'Missing federationEmoji in owner.json, using default 💚',
            fix: 'Add "federationEmoji": "💚" to your owner.json'
          });
        }

        if (!ownerData.sessionlessKeys) {
          response.warnings.push({
            severity: 'error',
            message: 'Missing sessionlessKeys in owner.json',
            fix: 'BDO operations will fail without sessionless keys'
          });
        }

        res.send(response);
      } else {
        res.status(404).send({
          error: 'Owner configuration not found',
          warnings: [{
            severity: 'error',
            message: 'owner.json file not found',
            fix: 'Create ~/.wiki/status/owner.json with locationEmoji and sessionlessKeys'
          }]
        });
      }
    } catch (err) {
      console.error('Error reading owner.json:', err);
      res.status(500).send({
        error: 'Failed to load base emoji',
        message: err.message
      });
    }
  });

  // ===== FEDERATION ENDPOINTS =====

  // Register this wiki's location identifier
  app.post('/plugin/allyabase/federation/register', owner, function(req, res) {
    try {
      const { locationIdentifier, url } = req.body;

      if (!locationIdentifier || !url) {
        return res.status(400).send({
          success: false,
          error: 'Missing locationIdentifier or url'
        });
      }

      const result = federationResolver.registerLocation(locationIdentifier, url);

      res.send({
        success: result.added,
        locationIdentifier,
        url,
        ...result
      });
    } catch (err) {
      console.error('Error registering location:', err);
      res.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Get a location URL by its identifier
  app.get('/plugin/allyabase/federation/location/:identifier', function(req, res) {
    try {
      const identifier = decodeURIComponent(req.params.identifier);
      const locations = federationResolver.getRegisteredLocations();

      if (locations[identifier]) {
        res.send({
          locationIdentifier: identifier,
          url: locations[identifier]
        });
      } else {
        res.status(404).send({
          success: false,
          error: `Location ${identifier} not found`
        });
      }
    } catch (err) {
      console.error('Error getting location:', err);
      res.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Get all registered locations
  app.get('/plugin/allyabase/federation/locations', function(req, res) {
    try {
      const locations = federationResolver.getRegisteredLocations();
      res.send(locations);
    } catch (err) {
      console.error('Error getting locations:', err);
      res.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Resolve a federated shortcode
  app.post('/plugin/allyabase/federation/resolve', async function(req, res) {
    try {
      const { shortcode, currentWikiUrl } = req.body;

      if (!shortcode) {
        return res.status(400).send({
          success: false,
          error: 'Missing shortcode'
        });
      }

      // Default to localhost if not provided
      const wikiUrl = currentWikiUrl || `http://localhost:${req.socket.localPort}`;

      const resolvedUrl = await federationResolver.resolveFederatedShortcode(shortcode, wikiUrl);

      res.send({
        success: true,
        shortcode,
        resolvedUrl
      });
    } catch (err) {
      console.error('Error resolving shortcode:', err);
      res.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Parse a federated shortcode without resolving
  app.post('/plugin/allyabase/federation/parse', function(req, res) {
    try {
      const { shortcode } = req.body;

      if (!shortcode) {
        return res.status(400).send({
          success: false,
          error: 'Missing shortcode'
        });
      }

      const parsed = federationResolver.parseFederatedShortcode(shortcode);

      if (!parsed) {
        return res.status(400).send({
          success: false,
          error: 'Invalid federated shortcode'
        });
      }

      res.send({
        success: true,
        ...parsed
      });
    } catch (err) {
      console.error('Error parsing shortcode:', err);
      res.status(500).send({
        success: false,
        error: err.message
      });
    }
  });

  // Fetch a federated BDO via emojicode using authenticated bdo-js request
  app.post('/plugin/allyabase/federation/fetch-bdo', async function(req, res) {
    try {
      const { emojicode, currentWikiUrl } = req.body;

      if (!emojicode) {
        return res.status(400).send({
          success: false,
          error: 'Missing emojicode'
        });
      }

      console.log('[federation/fetch-bdo] Fetching BDO:', emojicode);

      // Parse the emojicode to extract UUID
      // Expected format: 💚{emoji-location}/bdo/{uuid}
      const parsed = federationResolver.parseFederatedShortcode(emojicode);
      if (!parsed) {
        return res.status(400).send({
          success: false,
          error: 'Invalid emojicode format'
        });
      }

      // Extract UUID from resource path (e.g., /bdo/123 -> 123)
      const uuidMatch = parsed.resourcePath.match(/\/bdo\/([a-f0-9-]+)/);
      if (!uuidMatch) {
        return res.status(400).send({
          success: false,
          error: 'Invalid BDO path format. Expected /bdo/{uuid}'
        });
      }
      const uuid = uuidMatch[1];

      console.log('[federation/fetch-bdo] Extracted UUID:', uuid);

      // Resolve location emoji to URL
      const wikiUrl = currentWikiUrl || `http://localhost:${req.socket.localPort}`;
      const baseTargetUrl = await federationResolver.resolveFederatedShortcode(
        `💚${parsed.locationIdentifier}/`,
        wikiUrl
      );

      // Remove trailing slash
      const targetWikiUrl = baseTargetUrl.replace(/\/$/, '');
      console.log('[federation/fetch-bdo] Target wiki:', targetWikiUrl);

      // Load this wiki's keypair
      const keypair = loadWikiKeypair();
      if (!keypair) {
        return res.status(500).send({
          success: false,
          error: 'Wiki keypair not found. Cannot authenticate request.'
        });
      }

      // Initialize BDO - it's not a constructor, it's an object with methods
      // We need to use bdo-js methods directly

      // Make authenticated request to target wiki's BDO service
      // The target wiki has BDO service at /plugin/allyabase/bdo
      const bdoServiceUrl = `${targetWikiUrl}/plugin/allyabase/bdo`;

      console.log('[federation/fetch-bdo] Fetching from:', bdoServiceUrl);
      console.log('[federation/fetch-bdo] UUID:', uuid);

      // Temporarily set baseURL to target wiki's BDO service
      const originalBaseURL = bdo.baseURL;
      bdo.baseURL = bdoServiceUrl + '/';

      // Use bdo.getBDO to fetch the BDO
      // Provide getKeys function for this wiki's authentication
      const getKeys = async () => ({ pubKey: keypair.pubKey, privateKey: keypair.privateKey });
      const bdoData = await bdo.getBDO(uuid, getKeys);

      // Restore original baseURL
      bdo.baseURL = originalBaseURL;

      console.log('[federation/fetch-bdo] Successfully retrieved BDO');

      // Return the BDO to the client
      res.send({
        success: true,
        emojicode,
        uuid,
        targetWiki: targetWikiUrl,
        sourceWiki: wikiUrl,
        bdo: bdoData
      });

    } catch (err) {
      console.error('[federation/fetch-bdo] Error:', err);
      res.status(500).send({
        success: false,
        error: err.message,
        details: err.stack
      });
    }
  });

  // Add deployment routes
  deployment.addRoutes(params);

  console.log('✅ wiki-plugin-allyabase ready!');

  // Set up shutdown hooks to clean up allyabase/PM2 processes
  let isShuttingDown = false;

  const handleShutdown = async (signal) => {
    if (isShuttingDown) {
      return; // Already shutting down
    }
    isShuttingDown = true;

    console.log(`[wiki-plugin-allyabase] Received ${signal}, shutting down...`);
    await shutdownAllyabase();

    // Give it a moment to clean up
    setTimeout(() => {
      console.log('[wiki-plugin-allyabase] Shutdown complete');
      // Don't call process.exit() here - let the parent process handle that
    }, 3000);
  };

  // Register shutdown handlers (only once per process)
  if (!process.allyabaseShutdownRegistered) {
    process.allyabaseShutdownRegistered = true;

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('exit', () => {
      if (!isShuttingDown) {
        // Synchronous cleanup on exit
        console.log('[wiki-plugin-allyabase] Process exiting, cleaning up...');
        cleanupPidFile();
      }
    });

    console.log('[wiki-plugin-allyabase] Shutdown handlers registered');
  }
}

module.exports = { startServer };
}).call(this);
