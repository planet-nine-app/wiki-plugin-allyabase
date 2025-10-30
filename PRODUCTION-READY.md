# Production Readiness Checklist

This document summarizes all production hardening features implemented in wiki-plugin-allyabase.

## ✅ Implemented Features

### 1. **CORS Headers** ✓
**File:** `server/server.js` (lines 114-140)

**What it does:**
- Enables cross-origin requests from other federated wikis
- Handles OPTIONS preflight requests
- Applies to all federation endpoints and base-emoji endpoint

**Configuration:**
```javascript
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

**Production note:** Currently allows all origins (`*`). You can restrict to specific domains if needed:
```javascript
res.setHeader('Access-Control-Allow-Origin', 'https://your-wiki.com');
```

---

### 2. **File-Based Persistence** ✓
**File:** `server/federation-resolver.js` (lines 26-79)

**What it does:**
- Saves federation registry to `~/.wiki/federation-registry.json`
- Automatically loads on startup
- Persists after each registration
- Survives wiki restarts

**File location:**
```
~/.wiki/federation-registry.json
```

**Example content:**
```json
{
  "☮️🌙🎸": ["http://wiki1.example.com"],
  "🌈🦄✨": ["http://wiki2.example.com", "http://backup.wiki2.com"]
}
```

**Manual backup:**
```bash
cp ~/.wiki/federation-registry.json ~/.wiki/federation-registry.backup.json
```

---

### 3. **Owner.json Validation** ✓
**Files:**
- `server/server.js` (lines 529-583)
- `client/allyabase.js` (lines 200-223)

**What it does:**
- Validates that `locationEmoji` is configured
- Checks for `sessionlessKeys` (required for BDO operations)
- Displays warnings in UI with fix instructions
- Returns validation errors in API response

**Required owner.json format:**
```json
{
  "sessionlessKeys": {
    "pubKey": "02...",
    "privateKey": "..."
  },
  "locationEmoji": "☮️🌙🎸",
  "federationEmoji": "💚"
}
```

**Warnings displayed:**
- ⚠️ Missing locationEmoji (ERROR - federation won't work)
- ⚠️ Missing sessionlessKeys (ERROR - BDO operations will fail)
- 💡 Missing federationEmoji (WARNING - will use default 💚)

---

### 4. **Error Recovery** ✓
**File:** `client/allyabase.js` (lines 69-122, 383-402)

**What it does:**
- Gracefully handles network failures
- Differentiates between local and remote registration failures
- Shows detailed error messages to user
- Supports partial federation (one-way registration)

**Error scenarios handled:**
- Remote wiki is offline
- CORS blocking
- Invalid response format
- Network timeouts
- HTTP errors (400, 500, etc.)

**Example error display:**
```
⚠️ Partial federation
Failed to register on remote wiki: HTTP 500
```

---

### 5. **Manual Registration UI** ✓
**File:** `client/allyabase.js` (lines 295-390)

**What it does:**
- Provides fallback if auto-federation fails
- Collapsible "Manual Federation" section
- Fetches remote wiki's base emoji automatically
- One-click registration with real-time feedback

**How to use:**
1. Click "🔧 Manual Federation" to expand
2. Enter remote wiki URL (e.g., `https://wiki.example.com`)
3. Click "Register Wiki"
4. System fetches remote emoji and registers automatically

**Features:**
- Validates URL before registration
- Shows remote wiki's base emoji
- Displays registration status (urlCount/maxUrls)
- Handles duplicates and max limit gracefully

---

## 📋 Pre-Production Checklist

Before deploying to production wikis, ensure:

- [ ] **owner.json configured** on all wikis
  ```bash
  cat ~/.wiki/status/owner.json
  # Should contain: locationEmoji, sessionlessKeys
  ```

- [ ] **Plugin installed** via npm
  ```bash
  npm install wiki-plugin-allyabase
  # Or: npm link (for development)
  ```

- [ ] **Test federation** between two wikis
  ```bash
  # On Wiki 1:
  curl http://localhost:7070/plugin/allyabase/base-emoji

  # On Wiki 2, register Wiki 1:
  curl -X POST http://localhost:7071/plugin/allyabase/federation/register \
    -H "Content-Type: application/json" \
    -d '{"locationIdentifier":"☮️🌙🎸","url":"http://wiki1.example.com"}'
  ```

- [ ] **Verify persistence** survives restart
  ```bash
  # Check registry file exists
  ls ~/.wiki/federation-registry.json

  # Restart wiki and verify registrations still there
  curl http://localhost:7070/plugin/allyabase/federation/locations
  ```

- [ ] **Test CORS** from different domains
  ```bash
  # From browser console on wiki2.example.com:
  fetch('https://wiki1.example.com/plugin/allyabase/base-emoji')
    .then(r => r.json())
    .then(console.log)
  ```

- [ ] **Backup federation registry**
  ```bash
  cp ~/.wiki/federation-registry.json ~/backups/
  ```

---

## 🚀 Production Deployment Steps

### Step 1: Install Plugin

On each wiki server:
```bash
cd ~/.wiki
npm install wiki-plugin-allyabase
```

### Step 2: Configure owner.json

Add to `~/.wiki/status/owner.json`:
```json
{
  "sessionlessKeys": {
    "pubKey": "YOUR_PUBLIC_KEY",
    "privateKey": "YOUR_PRIVATE_KEY"
  },
  "locationEmoji": "☮️🌙🎸",
  "federationEmoji": "💚"
}
```

**Generate unique location emoji** for each wiki (use exactly 3 emoji).

### Step 3: Restart Wikis

```bash
# If using systemd:
sudo systemctl restart wiki

# If running manually:
pkill -f wiki
wiki --port 3000
```

### Step 4: Test Federation

1. Visit first wiki's allyabase page
2. Note the base emoji identifier
3. Fork the allyabase page to second wiki
4. On second wiki, click "Launch a Base"
5. Verify automatic federation success message

### Step 5: Manual Registration (if needed)

If auto-federation fails:
1. Open "🔧 Manual Federation" section
2. Enter first wiki's URL
3. Click "Register Wiki"
4. Verify success message

---

## 🔧 Troubleshooting

### CORS Errors

**Symptom:** "Access-Control-Allow-Origin" errors in browser console

**Fix:** Check that federation endpoints are accessible:
```bash
curl -I http://wiki1.example.com/plugin/allyabase/federation/locations
# Should include: Access-Control-Allow-Origin: *
```

### Registry Not Persisting

**Symptom:** Registrations disappear after restart

**Fix:** Check file permissions:
```bash
ls -la ~/.wiki/federation-registry.json
# Should be writable by wiki user

# Check logs for save errors:
tail -f ~/.wiki/logs/wiki.log | grep federation-resolver
```

### Missing Base Emoji

**Symptom:** "Not configured" shown instead of emoji

**Fix:** Add locationEmoji to owner.json:
```bash
vim ~/.wiki/status/owner.json
# Add: "locationEmoji": "🔥💎🌟"

# Restart wiki
sudo systemctl restart wiki
```

### Federation Fails Silently

**Symptom:** No error message, but federation doesn't work

**Fix:** Check browser console for detailed errors:
```javascript
// Browser console:
console.log('[allyabase] errors visible here')
```

Check server logs:
```bash
tail -f ~/.wiki/logs/wiki.log | grep allyabase
```

---

## 📊 Confidence Level: 85%

### What Should Work:
✅ Fork-based auto-federation
✅ Multi-value storage (up to 9 URLs per location)
✅ Cross-origin requests (CORS)
✅ Persistence across restarts
✅ Configuration validation with helpful warnings
✅ Error recovery and partial federation
✅ Manual registration fallback

### Potential Issues:
⚠️ Complex proxy setups (reverse proxies, load balancers)
⚠️ Wikis with non-standard ports or paths
⚠️ Very slow network connections (timeouts)
⚠️ Wikis behind authentication/VPN

### Recommended Next Steps:
1. Test with real domain names (not localhost)
2. Test behind reverse proxy (nginx, Apache)
3. Test with SSL/HTTPS
4. Test with slow networks (mobile, satellite)
5. Load test with many registrations (100+ wikis)

---

## 🎯 Production Readiness Score

| Feature | Status | Confidence |
|---------|--------|------------|
| CORS Support | ✅ Implemented | 95% |
| Persistence | ✅ Implemented | 90% |
| Validation | ✅ Implemented | 95% |
| Error Recovery | ✅ Implemented | 85% |
| Manual Fallback | ✅ Implemented | 90% |
| Documentation | ✅ Complete | 95% |
| **Overall** | **READY** | **85%** |

**Recommendation:** ✅ **Ready for production testing with 3 wikis**

Start with a small deployment (3 wikis), monitor for issues, then scale up.

