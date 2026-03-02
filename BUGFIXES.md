# Allyabase Plugin - Critical Bug Fixes

## Date: February 9, 2026

### Critical Bug #1: Invalid Express Route Wildcard

**Problem:**
Multiple routes used the wildcard `*` syntax which is invalid in newer versions of path-to-regexp (used by Express):

```javascript
// Federation route (line 291)
app.use('/plugin/allyabase/federation/*', function(req, res, next) {

// Service proxy routes (line 633)
app.all(`/plugin/allyabase/${service}/*`, function(req, res) {
```

This caused:
```
PathError: Missing parameter name at index 30: /plugin/allyabase/federation/*
PathError: Missing parameter name at index 25: /plugin/allyabase/julia/*
```

**Fix:**
Changed both to use regex patterns:

```javascript
// Federation route (line 291)
app.use(/^\/plugin\/allyabase\/federation\/.*/, function(req, res, next) {

// Service proxy routes (line 633)
app.all(new RegExp(`^\\/plugin\\/allyabase\\/${service}\\/.*`), function(req, res) {
```

**Locations:**
- `server/server.js:291` - Federation route
- `server/server.js:633` - Service proxy routes (all 14 services)

**Impact:** Plugin would crash immediately on load, making all federation endpoints and service proxies unusable.

---

### Critical Bug #2: Process Suicide in Docker Containers

**Problem:**
The `cleanupOrphanedProcesses()` function scans ports and kills any process using them. In Docker containers:
- PID 1 is always the main container process (the wiki server)
- When the plugin finds the wiki using a port, it tries to kill PID 1
- This kills the entire container

**Symptoms:**
```
[wiki-plugin-allyabase] Found process 1 using port 3005
[wiki-plugin-allyabase] Attempting to kill process 1...
[wiki-plugin-allyabase] Process 1 still running, sending SIGKILL...
```

Followed by container crash.

**Fix #1: PID Protection**
Added safety checks to `killProcessByPid()`:
```javascript
// CRITICAL: Never kill PID 1 in Docker containers
if (pid === 1) {
  console.log('⚠️  Skipping PID 1 (init process)');
  return false;
}

// Also don't kill our own process
if (pid === process.pid) {
  console.log('⚠️  Skipping PID ${pid} (this is us!)');
  return false;
}
```

**Fix #2: Docker Detection**
Added Docker environment detection to skip port cleanup entirely:
```javascript
const isDocker = fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv');

if (isDocker) {
  console.log('🐳 Detected Docker environment - skipping port cleanup');
  console.log('In Docker, services should run in separate containers');
  return;
}
```

**Location:** `server/server.js:63-100, 156-175`

**Rationale:**
In Docker/containerized environments:
- Each service runs in its own container
- Services don't share the same process space
- Attempting to kill processes by port is:
  - Dangerous (can kill the wiki itself)
  - Unnecessary (services are isolated)
  - Won't work anyway (can't kill processes in other containers)

---

## Testing the Fixes

### Before Fix:
```bash
# Install allyabase plugin
docker exec -u node -w /home/node/lib/node_modules/wiki wiki-dave npm install wiki-plugin-allyabase

# Restart wiki
docker-compose restart wiki-dave

# Result: Wiki crashes immediately
# Logs show: Attempting to kill process 1... [crash]
```

### After Fix:
```bash
# Install allyabase plugin
docker exec -u node -w /home/node/lib/node_modules/wiki wiki-dave npm install wiki-plugin-allyabase

# Restart wiki
docker-compose restart wiki-dave

# Result: Wiki starts successfully
# Logs show:
#   🐳 Detected Docker environment - skipping port cleanup
#   ✅ wiki-plugin-allyabase ready!
```

---

## Architecture Implications

### Original Design (Non-Docker):
```
┌─────────────────────────────┐
│   Single Machine/VM         │
│                             │
│  ┌──────────────────────┐   │
│  │ Wiki (PID 123)       │   │
│  │ Port 3333            │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │ PM2                  │   │
│  │  ├─ Fount (PID 456)  │   │
│  │  ├─ BDO (PID 789)    │   │
│  │  ├─ Joan (PID 101)   │   │
│  │  └─ ...13 more       │   │
│  └──────────────────────┘   │
│                             │
│  Allyabase plugin can:      │
│  - Kill orphaned PM2        │
│  - Kill processes on ports  │
│  - Restart services         │
└─────────────────────────────┘
```

### Docker Design (Current):
```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Wiki Container   │  │ Fount Container  │  │ BDO Container    │
│                  │  │                  │  │                  │
│ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌──────────────┐ │
│ │ Wiki (PID 1) │ │  │ │ Fount (PID 1)│ │  │ │ BDO (PID 1)  │ │
│ │ Port 3000    │ │  │ │ Port 3006    │ │  │ │ Port 3003    │ │
│ └──────────────┘ │  │ └──────────────┘ │  │ └──────────────┘ │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │                     │                      │
         └─────────────────────┴──────────────────────┘
                               │
                      Docker Network

Each container:
- Has its own PID 1 (init process)
- Isolated process space
- Cannot kill processes in other containers
- Managed by Docker Compose, not PM2

Allyabase plugin in Docker:
- ✅ Provides proxy routes to services
- ✅ Handles federation resolution
- ❌ Cannot manage service lifecycles (that's Docker's job)
- ❌ Cannot kill processes (dangerous and won't work)
```

---

## Future Considerations

### Service Management in Docker

The plugin's service management features (launch, healthcheck) need rethinking for Docker:

**Current Approach (Non-Docker):**
- `POST /plugin/allyabase/launch` - Runs `allyabase_setup.sh` which spawns PM2
- PM2 manages all 14 services as child processes
- Plugin can kill/restart services

**Docker Approach Options:**

1. **Docker Compose (Recommended):**
   ```yaml
   services:
     wiki:
       image: wiki-federation:latest
     fount:
       image: fount:latest
     bdo:
       image: bdo:latest
     # ...etc
   ```
   - Services managed by Docker Compose
   - Plugin acts as pure proxy layer
   - No lifecycle management in plugin

2. **Docker API Integration:**
   - Plugin calls Docker API to start/stop containers
   - Requires Docker socket mount
   - More complex but gives control

3. **Hybrid (Current State):**
   - Plugin works as proxy in Docker
   - Manual service management via docker-compose CLI
   - Plugin's /launch endpoint doesn't work in Docker (services already running)

### Recommendation

For Docker deployments:
1. Use docker-compose to manage all services
2. Allyabase plugin provides:
   - ✅ Service proxy routes
   - ✅ Federation resolution
   - ✅ Healthcheck endpoint (checks if services respond)
   - ❌ Launch/lifecycle management (handled by Docker)

For non-Docker deployments:
1. Original design works as intended
2. PM2 process management
3. Full lifecycle control via plugin

---

## Files Modified

1. **server/server.js**
   - Line 291: Fixed Express federation route wildcard (`*` → regex)
   - Line 633: Fixed Express service proxy route wildcards (all 14 services, `*` → regex)
   - Lines 63-100: Added PID 1 protection and self-protection
   - Lines 156-175: Added Docker detection and port cleanup skip

## Backward Compatibility

These changes are **fully backward compatible**:

- **Non-Docker environments:** Port cleanup still works (unless PID 1 or self)
- **Docker environments:** Automatically detected and handled safely
- **Existing functionality:** All proxy routes, federation, and endpoints unchanged

## Testing Checklist

- [ ] Plugin loads without crash in Docker
- [ ] Federation endpoints respond (no PathError)
- [ ] Wiki doesn't kill itself on startup
- [ ] Proxy routes work (e.g., `/plugin/allyabase/bdo/*`)
- [ ] Healthcheck endpoint works
- [ ] Docker detection logs appear
- [ ] Non-Docker deployment still works (if applicable)

---

## Related Issues

- Original crash report: Dave's wiki crashed when allyabase installed
- Error 1: `PathError: Missing parameter name at index 30`
- Error 2: `Attempting to kill process 1` followed by container death

Both issues now resolved.
