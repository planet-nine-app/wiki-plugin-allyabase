(function() {
const { exec } = require('child_process');
const path = require('path');
const http = require('http');
const httpProxy = require('http-proxy');
const federationResolver = require('./federation-resolver');

// Expected ports for all services based on allyabase_setup.sh
const SERVICE_PORTS = {
  julia: 3000,
  continuebee: 2999,
  fount: 3002,
  bdo: 3003,
  joan: 3004,
  addie: 3005,
  pref: 3006,
  dolores: 3007,
  prof: 3008,
  covenant: 3011,
  minnie: 2525,
  aretha: 7277,
  sanora: 7243,
  wiki: 3333
};

let baseStatus = {
  running: false,
  services: {},
  lastLaunch: null
};

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

  // Create proxy server
  const proxy = httpProxy.createProxyServer({});

  // Handle proxy errors
  proxy.on('error', function(err, req, res) {
    console.error('Proxy error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy error: ' + err.message);
  });

  // Create proxy routes for each service
  Object.entries(SERVICE_PORTS).forEach(([service, port]) => {
    // Proxy all methods (GET, POST, PUT, DELETE, etc.)
    app.all(`/plugin/allyabase/${service}/*`, function(req, res) {
      const targetPath = req.url.replace(`/plugin/allyabase/${service}`, '');
      req.url = targetPath;
      proxy.web(req, res, {
        target: `http://localhost:${port}`,
        changeOrigin: true
      });
    });

    // Also handle root service path
    app.all(`/plugin/allyabase/${service}`, function(req, res) {
      req.url = '/';
      proxy.web(req, res, {
        target: `http://localhost:${port}`,
        changeOrigin: true
      });
    });
  });

  // Endpoint to launch the allyabase
  app.post('/plugin/allyabase/launch', async function(req, res) {
    try {
      // Use script bundled with the plugin
      const scriptPath = path.join(__dirname, '../allyabase_setup.sh');

      console.log('='.repeat(80));
      console.log('🚀 LAUNCHING ALLYABASE');
      console.log('='.repeat(80));
      console.log('Script path:', scriptPath);
      console.log('Timestamp:', new Date().toISOString());
      console.log('-'.repeat(80));

      // Launch the setup script with spawn for better output streaming
      const { spawn } = require('child_process');
      const setupProcess = spawn('bash', [scriptPath], {
        stdio: 'inherit', // This will pipe stdout/stderr directly to the parent process
        env: process.env
      });

      setupProcess.on('error', (error) => {
        console.error('❌ Error spawning allyabase process:', error);
      });

      setupProcess.on('exit', (code, signal) => {
        console.log('-'.repeat(80));
        if (code === 0) {
          console.log('✅ Allyabase setup completed successfully');
        } else {
          console.log(`⚠️  Allyabase setup exited with code: ${code}, signal: ${signal}`);
        }
        console.log('='.repeat(80));
      });

      baseStatus.lastLaunch = new Date().toISOString();

      res.send({
        success: true,
        message: 'Allyabase launch initiated',
        timestamp: baseStatus.lastLaunch,
        scriptPath: scriptPath
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

  // ===== FEDERATION ENDPOINTS =====

  // Register this wiki's location identifier
  app.post('/plugin/allyabase/federation/register', function(req, res) {
    try {
      const { locationIdentifier, url } = req.body;

      if (!locationIdentifier || !url) {
        return res.status(400).send({
          success: false,
          error: 'Missing locationIdentifier or url'
        });
      }

      federationResolver.registerLocation(locationIdentifier, url);

      res.send({
        success: true,
        locationIdentifier,
        url
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
}

module.exports = { startServer };
}).call(this);
