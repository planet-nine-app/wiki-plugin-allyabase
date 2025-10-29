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

function emit($item, item) {
  $item.empty();

  // Create main container
  const container = document.createElement('div');
  container.style.padding = '10px';

  // Add title
  const title = document.createElement('h3');
  title.textContent = 'Allyabase Management';
  container.appendChild(title);

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

  // Fetch and display base emoji
  async function loadBaseEmoji() {
    try {
      const response = await get('/plugin/allyabase/base-emoji');
      const data = await response.json();
      const baseEmoji = data.baseEmoji;

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
