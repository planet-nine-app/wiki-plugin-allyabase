// Current state
let currentlySignedIn = null;

// Initialize the UI
function init() {
  const grid = document.getElementById('wikiGrid');

  WIKI_KEYS.forEach((wiki, index) => {
    const card = document.createElement('div');
    card.className = 'wiki-card';
    card.id = `wiki-card-${index}`;

    card.innerHTML = `
      <div class="wiki-info">
        <div class="wiki-name">${wiki.name}</div>
        <div class="wiki-url">${wiki.url}</div>
        <div class="wiki-user">User: ${wiki.username}</div>
        <div class="wiki-user">PubKey: ${wiki.pubKey.substring(0, 12)}...</div>
      </div>
      <button class="wiki-button signin-btn" onclick="signIn(${index})">
        Sign In
      </button>
      <button class="wiki-button signout-btn" onclick="signOut(${index})" disabled>
        Sign Out
      </button>
    `;

    grid.appendChild(card);
  });

  // Check existing sessions
  checkSessions();
}

// Check which wikis have active sessions
function checkSessions() {
  WIKI_KEYS.forEach((wiki, index) => {
    const keys = localStorage.getItem(`wiki-${index}-keys`);
    if (keys) {
      updateUIForSignedIn(index);
    }
  });
}

// Sign in to a wiki
function signIn(index) {
  const wiki = WIKI_KEYS[index];

  // Sign out of all other wikis first
  WIKI_KEYS.forEach((_, i) => {
    if (i !== index) {
      signOut(i, true);
    }
  });

  // Store the keys in localStorage for this wiki
  const keys = {
    privateKey: wiki.privateKey,
    pubKey: wiki.pubKey,
    username: wiki.username
  };

  localStorage.setItem(`wiki-${index}-keys`, JSON.stringify(keys));

  // Set cookie for the wiki domain
  document.cookie = `sessionless_keys=${JSON.stringify(keys)}; path=/; max-age=86400; SameSite=Lax`;

  currentlySignedIn = index;
  updateUIForSignedIn(index);
  showStatus(`Signed in to ${wiki.name}`, 'signed-in');

  // Open the wiki in a new tab
  window.open(wiki.url, `wiki-${index}`);
}

// Sign out of a wiki
function signOut(index, silent = false) {
  const wiki = WIKI_KEYS[index];

  // Remove from localStorage
  localStorage.removeItem(`wiki-${index}-keys`);

  // Clear cookie
  document.cookie = `sessionless_keys=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;

  if (currentlySignedIn === index) {
    currentlySignedIn = null;
  }

  updateUIForSignedOut(index);

  if (!silent) {
    showStatus(`Signed out of ${wiki.name}`, 'signed-out');
  }
}

// Update UI when signed in
function updateUIForSignedIn(index) {
  const card = document.getElementById(`wiki-card-${index}`);
  card.classList.add('signed-in');

  const signinBtn = card.querySelector('.signin-btn');
  const signoutBtn = card.querySelector('.signout-btn');

  signinBtn.disabled = true;
  signoutBtn.disabled = false;
}

// Update UI when signed out
function updateUIForSignedOut(index) {
  const card = document.getElementById(`wiki-card-${index}`);
  card.classList.remove('signed-in');

  const signinBtn = card.querySelector('.signin-btn');
  const signoutBtn = card.querySelector('.signout-btn');

  signinBtn.disabled = false;
  signoutBtn.disabled = true;
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status active ${type}`;

  setTimeout(() => {
    status.classList.remove('active');
  }, 3000);
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
