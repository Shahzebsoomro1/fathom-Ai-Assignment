const authScreen = document.querySelector('#auth-screen');
const dashboardScreen = document.querySelector('#dashboard-screen');
const providerButtons = [...document.querySelectorAll('[data-provider]')];
let pendingAuth = null;

function resetLoading() {
  window.clearTimeout(pendingAuth);
  pendingAuth = null;
  providerButtons.forEach(button => {
    button.disabled = false;
    button.classList.remove('loading');
    button.removeAttribute('aria-busy');
    button.querySelector('.loading-spinner').hidden = true;
    button.querySelector('.provider-label').textContent = `Continue with ${button.dataset.provider === 'google' ? 'Google' : 'Microsoft'}`;
  });
}

function renderRoute() {
  resetLoading();
  const dashboard = ['/dashboard', '/app'].includes(window.location.pathname);
  const login = window.location.pathname === '/login';
  authScreen.hidden = dashboard;
  dashboardScreen.hidden = !dashboard;
  document.body.classList.toggle('workspace-mode', dashboard);
  document.title = dashboard ? 'My Calls — Fathom' : login ? 'Log in to Fathom' : 'Sign up for Fathom';
  document.querySelector('#auth-title').textContent = login ? 'Log in to Fathom' : 'Sign up for Fathom';
  document.querySelector('.auth-emoji').textContent = login ? '👋' : '🚀';
  document.querySelector('.auth-subtitle').textContent = login ? 'Welcome back! Continue with your work email' : 'Connect your work email to get started in minutes';
  document.querySelector('#auth-toggle-copy').textContent = login ? 'Don’t have a Fathom account?' : 'Already have a Fathom account?';
  const toggle = document.querySelector('#auth-toggle-link');
  toggle.href = login ? '/signup' : '/login';
  toggle.textContent = login ? 'Sign up' : 'Sign in';
  document.querySelector('#auth-status').textContent = '';
  const view = new URLSearchParams(window.location.search).get('view') || 'my-calls';
  document.querySelectorAll('[data-view]').forEach(link => {
    if (link.dataset.view === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const labels = { 'my-calls': 'No call recordings', 'team-calls': 'No team call recordings', playlists: 'No playlists', alerts: 'No alerts', deals: 'No deals' };
  document.querySelector('#calls-empty-label').textContent = labels[view] || labels['my-calls'];
  updateRecordings();
  if (dashboard) document.querySelector('.workspace-tabs [aria-current=page]')?.focus({ preventScroll: true });
}

// History-based routing swaps local screens without a page reload or OAuth request.
function navigate(path) {
  window.history.pushState({}, '', path);
  renderRoute();
  window.scrollTo(0, 0);
}

providerButtons.forEach(button => button.addEventListener('click', () => {
  if (pendingAuth !== null) return;
  const provider = button.dataset.provider;
  providerButtons.forEach(other => { other.disabled = true; });
  button.classList.add('loading');
  button.setAttribute('aria-busy', 'true');
  button.querySelector('.provider-label').textContent = 'Continuing…';
  button.querySelector('.loading-spinner').hidden = false;
  document.querySelector('#auth-status').textContent = `Continuing with ${provider === 'google' ? 'Google' : 'Microsoft'}…`;
  pendingAuth = window.setTimeout(() => {
    // This is a simulated frontend session, not a real SSO credential or token.
    try { window.sessionStorage.setItem('fathom.previewProvider', provider); } catch { /* Routing works even when browser storage is unavailable. */ }
    navigate('/dashboard');
  }, 500);
}));

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-route]');
  if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(link.getAttribute('href'));
});
window.addEventListener('popstate', renderRoute);

const dialog = document.querySelector('#workspace-dialog');
function showDialog(title, content) {
  document.querySelector('#workspace-dialog-title').textContent = title;
  document.querySelector('#workspace-dialog-content').innerHTML = content;
  dialog.showModal();
}
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => {
  const panels = {
    profile: ['Your account', '<p>Shahzeb Soomro</p><p>Local preview workspace</p><button class="dialog-button" id="sign-out">Sign out</button>'],
    settings: ['Meeting preferences', '<p>Your calendar is not connected in this preview. Calendar and recording setup will be available in the next step.</p>'],
    help: ['Help & Feedback', '<p>Explore your meeting workspace and learn how Fathom captures conversations.</p><button class="dialog-button" id="start-onboarding">Start onboarding</button>'],
    refer: ['Invite your team', '<p>Team invitations are not sent from this local preview.</p>'],
  };
  const [title, content] = panels[button.dataset.panel];
  showDialog(title, content);
  document.querySelector('#sign-out')?.addEventListener('click', () => { dialog.close(); try { sessionStorage.removeItem('fathom.previewProvider'); } catch {} navigate('/login'); });
  document.querySelector('#start-onboarding')?.addEventListener('click', () => { dialog.close(); showLearning(); });
}));
function showLearning() { document.querySelector('#learning-panel').hidden = false; document.querySelector('#onboarding-guide').hidden = true; }
document.querySelector('#onboarding-guide').addEventListener('click', showLearning);
document.querySelectorAll('[data-lesson]').forEach(button => button.addEventListener('click', () => showDialog(button.querySelector('.lesson-label').textContent.trim(), '<p>This onboarding flow will be available in the next build step.</p>')));
const askPanel = document.querySelector('.ask-panel');
const workspaceLayout = document.querySelector('.workspace-layout');
const expandAsk = document.querySelector('#expand-ask');
document.querySelector('#collapse-ask').addEventListener('click', () => { askPanel.hidden = true; workspaceLayout.classList.add('ask-collapsed'); workspaceLayout.classList.remove('mobile-ask'); expandAsk.hidden = false; });
expandAsk.addEventListener('click', () => { askPanel.hidden = false; workspaceLayout.classList.remove('ask-collapsed'); workspaceLayout.classList.add('mobile-ask'); expandAsk.hidden = true; });
function updateAskButton() { if (window.innerWidth <= 800 && !workspaceLayout.classList.contains('mobile-ask')) expandAsk.hidden = false; else if (!askPanel.hidden) expandAsk.hidden = true; }
window.addEventListener('resize', updateAskButton);
updateAskButton();
const askInput = document.querySelector('#ask-input');
document.querySelectorAll('.ask-suggestions button').forEach(button => button.addEventListener('click', () => { askInput.value = button.textContent; askInput.focus(); }));
document.querySelector('.ask-composer').addEventListener('submit', event => {
  event.preventDefault();
  const question = askInput.value.trim();
  if (!question) return;
  const conversation = document.querySelector('.ask-conversation');
  const prompt = document.createElement('p'); prompt.className = 'ask-message'; prompt.textContent = question;
  const answer = document.createElement('p'); answer.className = 'ask-message answer'; answer.textContent = 'There are no recorded meetings in this workspace yet. Record your first call to explore summaries and insights.';
  conversation.append(prompt, answer); askInput.value = ''; conversation.scrollTop = conversation.scrollHeight;
});
function updateRecordings() {
  const view = new URLSearchParams(location.search).get('view') || 'my-calls';
  const myCalls = view === 'my-calls';
  const query = document.querySelector('.workspace-search input').value.trim().toLowerCase();
  let matches = 0;
  document.querySelectorAll('.recording-card').forEach(card => { card.hidden = !card.textContent.toLowerCase().includes(query); if (!card.hidden) matches++; });
  document.querySelector('.meeting-recordings').hidden = !myCalls;
  document.querySelector('.calls-empty').hidden = myCalls && matches > 0;
  if (myCalls) document.querySelector('#calls-empty-label').textContent = query ? 'No matching call recordings' : 'No call recordings';
}
document.querySelector('.workspace-search input').addEventListener('input', updateRecordings);
renderRoute();
