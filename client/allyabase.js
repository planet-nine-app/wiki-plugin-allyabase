async function post(url, payload = {}) {
  return await fetch(url, {
    method: 'post',
    body: JSON.stringify(payload),
    headers: {'Content-Type': 'application/json'}
  });
}

async function get(url) {
  return await fetch(url, {
    method: 'get',
    headers: {'Content-Type': 'application/json'}
  });
}

function formatServiceStatus(service, details) {
  const emoji = details.status === 'running' ? '✅' : '❌';
  const portInfo = `port ${details.port}`;
  return `${emoji} ${service}: ${details.status} (${portInfo})`;
}

// Detect if this item was forked from another wiki
function detectFork(item) {
  if (!item.journal || !Array.isArray(item.journal)) {
    return null;
  }

  // Look for fork action in journal
  const forkAction = item.journal.find(entry => entry.type === 'fork');
  if (!forkAction) {
    return null;
  }

  // Extract source site from fork action
  // Fork actions have format: { type: 'fork', site: 'example.com', date: 123456789 }
  const sourceSite = forkAction.site;
  if (!sourceSite) {
    return null;
  }

  // Convert site to full URL
  // Sites in federated wiki are typically just the domain
  const protocol = window.location.protocol;
  const sourceUrl = sourceSite.startsWith('http') ? sourceSite : `${protocol}//${sourceSite}`;

  return {
    sourceUrl,
    sourceSite,
    forkDate: forkAction.date
  };
}

// Fetch base emoji from a wiki
async function fetchRemoteBaseEmoji(wikiUrl) {
  try {
    const response = await fetch(`${wikiUrl}/plugin/allyabase/base-emoji`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('[allyabase] Error fetching remote base emoji:', err);
    return null;
  }
}

// Establish mutual federation between this wiki and source wiki
async function establishFederation(sourceUrl, sourceBaseEmoji, targetBaseEmoji) {
  const results = {
    registerSourceHere: null,
    registerTargetThere: null,
    errors: []
  };

  try {
    // 1. Register source wiki on this wiki
    console.log('[allyabase] Registering source wiki here...');
    try {
      const registerHereResponse = await post('/plugin/allyabase/federation/register', {
        locationIdentifier: sourceBaseEmoji.locationEmoji,
        url: sourceUrl
      });
      results.registerSourceHere = await registerHereResponse.json();
      console.log('[allyabase] Source registration result:', results.registerSourceHere);
    } catch (err) {
      results.errors.push(`Failed to register source locally: ${err.message}`);
      console.error('[allyabase] Local registration error:', err);
    }

    // 2. Register this wiki on source wiki
    console.log('[allyabase] Registering this wiki on source...');
    const thisWikiUrl = window.location.protocol + '//' + window.location.host;

    try {
      const registerThereResponse = await fetch(`${sourceUrl}/plugin/allyabase/federation/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationIdentifier: targetBaseEmoji.locationEmoji,
          url: thisWikiUrl
        })
      });

      if (!registerThereResponse.ok) {
        throw new Error(`HTTP ${registerThereResponse.status}`);
      }

      results.registerTargetThere = await registerThereResponse.json();
      console.log('[allyabase] Remote registration result:', results.registerTargetThere);
    } catch (err) {
      results.errors.push(`Failed to register on remote wiki: ${err.message}`);
      console.error('[allyabase] Remote registration error:', err);
    }

    return results;
  } catch (err) {
    console.error('[allyabase] Error establishing federation:', err);
    results.errors.push(err.message);
    return results;
  }
}

function emit($item, item) {
  $item.empty();

  // Create main container
  const container = document.createElement('div');
  container.style.padding = '10px';

  // Add title
  const title = document.createElement('h3');
  title.textContent = 'Allyabase Management';
  container.appendChild(title);

  // Detect if this page was forked
  const forkInfo = detectFork(item);
  if (forkInfo) {
    console.log('[allyabase] Fork detected from:', forkInfo);
  }

  // Add base emoji identifier section
  const baseEmojiContainer = document.createElement('div');
  baseEmojiContainer.style.padding = '10px';
  baseEmojiContainer.style.marginBottom = '15px';
  baseEmojiContainer.style.backgroundColor = '#f5f5f5';
  baseEmojiContainer.style.borderRadius = '5px';
  baseEmojiContainer.style.border = '1px solid #ddd';

  const baseEmojiTitle = document.createElement('div');
  baseEmojiTitle.style.fontWeight = 'bold';
  baseEmojiTitle.style.marginBottom = '5px';
  baseEmojiTitle.textContent = 'Base Identifier:';
  baseEmojiContainer.appendChild(baseEmojiTitle);

  const baseEmojiDisplay = document.createElement('div');
  baseEmojiDisplay.id = 'base-emoji-display';
  baseEmojiDisplay.style.fontSize = '24px';
  baseEmojiDisplay.style.marginBottom = '5px';
  baseEmojiDisplay.textContent = 'Loading...';
  baseEmojiContainer.appendChild(baseEmojiDisplay);

  const baseEmojiCopyBtn = document.createElement('button');
  baseEmojiCopyBtn.textContent = 'Copy';
  baseEmojiCopyBtn.style.padding = '5px 10px';
  baseEmojiCopyBtn.style.fontSize = '11px';
  baseEmojiCopyBtn.style.cursor = 'pointer';
  baseEmojiCopyBtn.style.marginRight = '5px';
  baseEmojiContainer.appendChild(baseEmojiCopyBtn);

  const baseEmojiHelp = document.createElement('span');
  baseEmojiHelp.style.fontSize = '11px';
  baseEmojiHelp.style.color = '#666';
  baseEmojiHelp.textContent = '(federation prefix + location identifier)';
  baseEmojiContainer.appendChild(baseEmojiHelp);

  container.appendChild(baseEmojiContainer);

  // Add federation status section if forked
  let federationContainer = null;
  if (forkInfo) {
    federationContainer = document.createElement('div');
    federationContainer.style.padding = '10px';
    federationContainer.style.marginBottom = '15px';
    federationContainer.style.backgroundColor = '#e8f4f8';
    federationContainer.style.borderRadius = '5px';
    federationContainer.style.border = '1px solid #b3d9e6';

    const federationTitle = document.createElement('div');
    federationTitle.style.fontWeight = 'bold';
    federationTitle.style.marginBottom = '5px';
    federationTitle.textContent = '🔗 Federation Status';
    federationContainer.appendChild(federationTitle);

    const federationStatus = document.createElement('div');
    federationStatus.id = 'federation-status';
    federationStatus.style.fontSize = '13px';
    federationStatus.textContent = `Forked from: ${forkInfo.sourceSite}`;
    federationContainer.appendChild(federationStatus);

    const federationHelp = document.createElement('div');
    federationHelp.style.fontSize = '11px';
    federationHelp.style.color = '#666';
    federationHelp.style.marginTop = '5px';
    federationHelp.textContent = 'Federation will be established automatically when you launch';
    federationContainer.appendChild(federationHelp);

    container.appendChild(federationContainer);
  }

  // Fetch and display base emoji
  async function loadBaseEmoji() {
    try {
      const response = await get('/plugin/allyabase/base-emoji');
      const data = await response.json();
      const baseEmoji = data.baseEmoji;

      // Display warnings if any
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach(warning => {
          const warningDiv = document.createElement('div');
          warningDiv.style.padding = '8px';
          warningDiv.style.marginTop = '8px';
          warningDiv.style.borderRadius = '4px';
          warningDiv.style.fontSize = '12px';

          if (warning.severity === 'error') {
            warningDiv.style.backgroundColor = '#ffe6e6';
            warningDiv.style.border = '1px solid #ff9999';
            warningDiv.style.color = '#cc0000';
            warningDiv.innerHTML = `<strong>⚠️ ${warning.message}</strong><br/>${warning.fix}`;
          } else {
            warningDiv.style.backgroundColor = '#fff4e6';
            warningDiv.style.border = '1px solid #ffcc99';
            warningDiv.style.color = '#cc6600';
            warningDiv.innerHTML = `<strong>💡 ${warning.message}</strong><br/>${warning.fix}`;
          }

          baseEmojiContainer.appendChild(warningDiv);
        });
      }

      if (data.locationEmoji) {
        baseEmojiDisplay.textContent = baseEmoji;
        baseEmojiDisplay.style.cursor = 'pointer';
        baseEmojiDisplay.title = 'Click to copy';

        // Click to copy functionality
        const copyToClipboard = (text) => {
          navigator.clipboard.writeText(text).then(() => {
            const originalText = baseEmojiCopyBtn.textContent;
            baseEmojiCopyBtn.textContent = '✓ Copied!';
            baseEmojiCopyBtn.style.color = 'green';
            setTimeout(() => {
              baseEmojiCopyBtn.textContent = originalText;
              baseEmojiCopyBtn.style.color = '';
            }, 2000);
          });
        };

        baseEmojiDisplay.addEventListener('click', () => copyToClipboard(baseEmoji));
        baseEmojiCopyBtn.addEventListener('click', () => copyToClipboard(baseEmoji));
      } else {
        baseEmojiDisplay.textContent = 'Not configured';
        baseEmojiDisplay.style.fontSize = '14px';
        baseEmojiDisplay.style.color = '#999';
        baseEmojiCopyBtn.style.display = 'none';
      }
    } catch (err) {
      baseEmojiDisplay.textContent = 'Unable to load';
      baseEmojiDisplay.style.fontSize = '14px';
      baseEmojiDisplay.style.color = '#999';
      baseEmojiCopyBtn.style.display = 'none';
      console.error('Error loading base emoji:', err);
    }
  }

  loadBaseEmoji();

  // Add launch button
  const launchButton = document.createElement('button');
  launchButton.textContent = 'Launch a Base';
  launchButton.style.padding = '10px 20px';
  launchButton.style.marginBottom = '15px';
  launchButton.style.cursor = 'pointer';
  container.appendChild(launchButton);

  // Add status container
  const statusContainer = document.createElement('div');
  statusContainer.id = 'allyabase-status';
  statusContainer.style.marginTop = '15px';
  container.appendChild(statusContainer);

  // Add manual federation section
  const manualFederationContainer = document.createElement('details');
  manualFederationContainer.style.marginTop = '20px';
  manualFederationContainer.style.padding = '10px';
  manualFederationContainer.style.backgroundColor = '#f9f9f9';
  manualFederationContainer.style.borderRadius = '5px';
  manualFederationContainer.style.border = '1px solid #ddd';

  const manualFederationSummary = document.createElement('summary');
  manualFederationSummary.textContent = '🔧 Manual Federation';
  manualFederationSummary.style.cursor = 'pointer';
  manualFederationSummary.style.fontWeight = 'bold';
  manualFederationSummary.style.marginBottom = '10px';
  manualFederationContainer.appendChild(manualFederationSummary);

  const manualFederationHelp = document.createElement('div');
  manualFederationHelp.style.fontSize = '12px';
  manualFederationHelp.style.color = '#666';
  manualFederationHelp.style.marginBottom = '10px';
  manualFederationHelp.textContent = 'Register another wiki manually if auto-federation fails';
  manualFederationContainer.appendChild(manualFederationHelp);

  // Input for remote wiki URL
  const remoteUrlInput = document.createElement('input');
  remoteUrlInput.type = 'text';
  remoteUrlInput.placeholder = 'https://example.com';
  remoteUrlInput.style.width = '100%';
  remoteUrlInput.style.padding = '8px';
  remoteUrlInput.style.marginBottom = '10px';
  remoteUrlInput.style.border = '1px solid #ccc';
  remoteUrlInput.style.borderRadius = '4px';
  remoteUrlInput.style.boxSizing = 'border-box';
  manualFederationContainer.appendChild(remoteUrlInput);

  // Button to fetch and register
  const registerButton = document.createElement('button');
  registerButton.textContent = 'Register Wiki';
  registerButton.style.padding = '8px 16px';
  registerButton.style.cursor = 'pointer';
  registerButton.style.marginBottom = '10px';
  manualFederationContainer.appendChild(registerButton);

  // Status message
  const manualFederationStatus = document.createElement('div');
  manualFederationStatus.style.fontSize = '12px';
  manualFederationStatus.style.marginTop = '10px';
  manualFederationContainer.appendChild(manualFederationStatus);

  // Register button handler
  registerButton.addEventListener('click', async () => {
    const remoteUrl = remoteUrlInput.value.trim();
    if (!remoteUrl) {
      manualFederationStatus.style.color = 'red';
      manualFederationStatus.textContent = '❌ Please enter a wiki URL';
      return;
    }

    registerButton.disabled = true;
    registerButton.textContent = 'Registering...';
    manualFederationStatus.textContent = '🔄 Fetching remote wiki info...';
    manualFederationStatus.style.color = '#0066cc';

    try {
      // Fetch remote wiki's base emoji
      const remoteBaseEmoji = await fetchRemoteBaseEmoji(remoteUrl);

      if (!remoteBaseEmoji || !remoteBaseEmoji.locationEmoji) {
        throw new Error('Remote wiki does not have allyabase configured');
      }

      manualFederationStatus.textContent = `Found: ${remoteBaseEmoji.baseEmoji}. Registering...`;

      // Register remote wiki locally
      const registerResponse = await post('/plugin/allyabase/federation/register', {
        locationIdentifier: remoteBaseEmoji.locationEmoji,
        url: remoteUrl
      });
      const result = await registerResponse.json();

      if (result.success !== false && result.added !== false) {
        manualFederationStatus.style.color = 'green';
        manualFederationStatus.textContent = `✅ Registered ${remoteBaseEmoji.baseEmoji} (${result.urlCount}/${result.maxUrls} URLs)`;
        remoteUrlInput.value = '';
      } else {
        manualFederationStatus.style.color = 'orange';
        manualFederationStatus.textContent = `⚠️  ${result.reason || 'Registration failed'}`;
      }
    } catch (err) {
      manualFederationStatus.style.color = 'red';
      manualFederationStatus.textContent = `❌ ${err.message}`;
    } finally {
      registerButton.disabled = false;
      registerButton.textContent = 'Register Wiki';
    }
  });

  container.appendChild(manualFederationContainer);

  $item.append(container);

  // Function to update status display
  async function updateStatus() {
    try {
      const response = await get('/plugin/allyabase/healthcheck');
      const health = await response.json();

      statusContainer.innerHTML = '';

      // Add summary
      const summary = document.createElement('div');
      summary.style.marginBottom = '10px';
      summary.style.fontWeight = 'bold';
      summary.innerHTML = `<p>Services Running: ${health.runningServices} / ${health.totalServices}</p>`;
      statusContainer.appendChild(summary);

      // Add individual service statuses
      const serviceList = document.createElement('div');
      serviceList.style.fontFamily = 'monospace';
      serviceList.style.fontSize = '12px';

      for (const [service, details] of Object.entries(health.services)) {
        const serviceDiv = document.createElement('div');
        serviceDiv.textContent = formatServiceStatus(service, details);
        serviceDiv.style.padding = '2px 0';
        serviceList.appendChild(serviceDiv);
      }
      statusContainer.appendChild(serviceList);

      // Add timestamp
      const timestamp = document.createElement('div');
      timestamp.style.marginTop = '10px';
      timestamp.style.fontSize = '11px';
      timestamp.style.color = '#666';
      timestamp.textContent = `Last checked: ${new Date(health.timestamp).toLocaleString()}`;
      statusContainer.appendChild(timestamp);

    } catch (err) {
      statusContainer.innerHTML = `<p style="color: red;">Error fetching status: ${err.message}</p>`;
      console.error('Error fetching allyabase status:', err);
    }
  }

  // Launch button click handler
  launchButton.addEventListener('click', async () => {
    launchButton.disabled = true;
    launchButton.textContent = 'Launching...';

    try {
      const response = await post('/plugin/allyabase/launch');
      const result = await response.json();

      if (result.success) {
        const successMsg = document.createElement('div');
        successMsg.style.color = 'green';
        successMsg.style.marginTop = '10px';
        successMsg.textContent = `✓ ${result.message}`;
        container.insertBefore(successMsg, statusContainer);

        // If this was forked, establish federation automatically
        if (forkInfo && federationContainer) {
          const federationStatus = document.getElementById('federation-status');
          if (federationStatus) {
            federationStatus.textContent = '🔄 Establishing federation...';
            federationStatus.style.color = '#0066cc';
          }

          // Wait a moment for services to be ready
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Get this wiki's base emoji
          const thisBaseEmoji = await get('/plugin/allyabase/base-emoji').then(r => r.json());

          // Get source wiki's base emoji
          const sourceBaseEmoji = await fetchRemoteBaseEmoji(forkInfo.sourceUrl);

          if (sourceBaseEmoji && sourceBaseEmoji.locationEmoji && thisBaseEmoji.locationEmoji) {
            console.log('[allyabase] Both wikis have location identifiers, establishing federation...');
            console.log('[allyabase] Source:', sourceBaseEmoji.baseEmoji);
            console.log('[allyabase] Target:', thisBaseEmoji.baseEmoji);

            const federationResult = await establishFederation(
              forkInfo.sourceUrl,
              sourceBaseEmoji,
              thisBaseEmoji
            );

            if (federationResult) {
              const sourceSuccess = federationResult.registerSourceHere?.success !== false;
              const targetSuccess = federationResult.registerTargetThere?.success !== false;
              const hasErrors = federationResult.errors && federationResult.errors.length > 0;

              if (sourceSuccess && targetSuccess && !hasErrors) {
                federationStatus.textContent = `✅ Federated with ${forkInfo.sourceSite} (${sourceBaseEmoji.baseEmoji})`;
                federationStatus.style.color = 'green';
                console.log('[allyabase] Federation established successfully!');
              } else if (sourceSuccess || targetSuccess) {
                federationStatus.innerHTML = `⚠️ Partial federation<br/><small>${federationResult.errors.join('<br/>')}</small>`;
                federationStatus.style.color = 'orange';
                console.warn('[allyabase] Partial federation:', federationResult);
              } else {
                federationStatus.innerHTML = `❌ Federation failed<br/><small>${federationResult.errors.join('<br/>')}</small>`;
                federationStatus.style.color = 'red';
              }
            } else {
              federationStatus.textContent = `❌ Federation failed (check console)`;
              federationStatus.style.color = 'red';
            }
          } else {
            federationStatus.textContent = `⚠️ Source wiki doesn't have allyabase configured`;
            federationStatus.style.color = 'orange';
            console.warn('[allyabase] Cannot federate - source or target missing location emoji');
          }
        }

        // Wait a bit for services to start, then check status
        setTimeout(() => {
          successMsg.remove();
          updateStatus();
        }, 3000);
      } else {
        const errorMsg = document.createElement('div');
        errorMsg.style.color = 'red';
        errorMsg.style.marginTop = '10px';
        errorMsg.textContent = `✗ Launch failed: ${result.error}`;
        container.insertBefore(errorMsg, statusContainer);
      }
    } catch (err) {
      const errorMsg = document.createElement('div');
      errorMsg.style.color = 'red';
      errorMsg.style.marginTop = '10px';
      errorMsg.textContent = `✗ Error launching base: ${err.message}`;
      container.insertBefore(errorMsg, statusContainer);
      console.error('Error launching allyabase:', err);
    } finally {
      launchButton.disabled = false;
      launchButton.textContent = 'Launch a Base';
    }
  });

  // Initial status check
  updateStatus();

  // Auto-refresh status every 30 seconds
  const refreshInterval = setInterval(updateStatus, 30000);

  // Store interval ID so it can be cleared if needed
  item._statusRefreshInterval = refreshInterval;
}

function bind($item, item) {
  // Clean up interval when item is removed/rebound
  if (item._statusRefreshInterval) {
    clearInterval(item._statusRefreshInterval);
  }
}

if (window) {
  window.plugins['allyabase'] = { emit, bind };
}

export const allyabase = typeof window == 'undefined' ? { emit, bind } : undefined;
