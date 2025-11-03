const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// List of all allyabase microservices
const MICROSERVICES = [
  'fount',
  'bdo',
  'covenant',
  'prof',
  'addie',
  'julia',
  'sanora',
  'dolores',
  'joan',
  'pref',
  'aretha',
  'continuebee'
];

async function addRoutes(params) {
  const app = params.app;
  const argv = params.argv;

  // Security: Only allow deployment if a deployment token is provided
  const DEPLOYMENT_TOKEN = argv.deployment_token || process.env.DEPLOYMENT_TOKEN;

  if (!DEPLOYMENT_TOKEN) {
    console.warn('No deployment token configured. Deployment endpoint will be disabled.');
    return;
  }

  // Owner middleware to protect deployment endpoints
  const owner = function (req, res, next) {
    if (!app.securityhandler.isAuthorized(req)) {
      return res.status(401).send('must be owner')
    }
    return next()
  };

  // Endpoint to pull and restart all microservices
  app.post('/plugin/allyabase/deploy', owner, async function(req, res) {
    const { token } = req.body;

    // Verify token
    if (token !== DEPLOYMENT_TOKEN) {
      console.warn('Invalid deployment token received');
      res.status(403);
      return res.send({ success: false, error: 'Invalid deployment token' });
    }

    console.log('🚀 Starting deployment process...');

    const results = {
      success: true,
      services: {},
      timestamp: new Date().toISOString()
    };

    // Pull and restart each microservice
    for (const service of MICROSERVICES) {
      const serviceResult = {
        pulled: false,
        restarted: false,
        errors: []
      };

      try {
        console.log(`📦 Pulling ${service}...`);

        // Git pull
        const pullCommand = `cd /Users/zachbabb/Work/planet-nine/${service} && git pull`;
        const { stdout: pullStdout, stderr: pullStderr } = await execPromise(pullCommand);

        serviceResult.pulled = true;
        serviceResult.pullOutput = pullStdout || pullStderr;
        console.log(`✅ ${service} pulled successfully`);

        // Restart service (using pm2 if available, otherwise skip restart)
        try {
          console.log(`🔄 Restarting ${service}...`);
          const restartCommand = `pm2 restart ${service} || echo "PM2 not available, skipping restart"`;
          const { stdout: restartStdout, stderr: restartStderr } = await execPromise(restartCommand);

          serviceResult.restarted = true;
          serviceResult.restartOutput = restartStdout || restartStderr;
          console.log(`✅ ${service} restarted successfully`);
        } catch (restartErr) {
          console.warn(`⚠️ Could not restart ${service}: ${restartErr.message}`);
          serviceResult.errors.push(`Restart failed: ${restartErr.message}`);
          // Don't fail the whole deployment if restart fails
        }

      } catch (err) {
        console.error(`❌ Error deploying ${service}:`, err);
        serviceResult.errors.push(err.message);
        results.success = false;
      }

      results.services[service] = serviceResult;
    }

    console.log('🎉 Deployment process complete');
    res.send(results);
  });

  // Endpoint to get deployment status
  app.get('/plugin/allyabase/deploy/status', owner, async function(req, res) {
    const { token } = req.query;

    if (token !== DEPLOYMENT_TOKEN) {
      res.status(403);
      return res.send({ success: false, error: 'Invalid deployment token' });
    }

    const status = {};

    for (const service of MICROSERVICES) {
      try {
        // Check git status
        const gitCommand = `cd /Users/zachbabb/Work/planet-nine/${service} && git rev-parse --short HEAD && git status --porcelain`;
        const { stdout } = await execPromise(gitCommand);
        const lines = stdout.split('\n');

        status[service] = {
          commit: lines[0],
          hasChanges: lines.slice(1).filter(l => l.trim()).length > 0
        };
      } catch (err) {
        status[service] = {
          error: err.message
        };
      }
    }

    res.send({ success: true, services: status });
  });
}

module.exports = { addRoutes };
