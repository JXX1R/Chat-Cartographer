import routeData from '../data/routes.json';

const countries = [
  ['japan','Japan','🇯🇵','Tokyo, Kyoto, and the islands',36.2,138.3], ['italy','Italy','🇮🇹','Rome, Florence, and the coast',41.9,12.5],
  ['brazil','Brazil','🇧🇷','Rio, the Amazon, and beyond',-14.2,-51.9], ['new-zealand','New Zealand','🇳🇿','Aotearoa, mountains, and fjords',-40.9,174.9],
  ['morocco','Morocco','🇲🇦','Marrakech, Atlas peaks, and desert',31.8,-7.1], ['iceland','Iceland','🇮🇸','Waterfalls, hot springs, and auroras',64.9,-19.0],
  ['south-korea','South Korea','🇰🇷','Seoul, markets, and the coast',35.9,127.8], ['peru','Peru','🇵🇪','Andes, Cusco, and the Sacred Valley',-9.2,-75.0],
  ['kenya','Kenya','🇰🇪','Nairobi, savanna, and the Rift Valley',-0.02,37.9], ['greece','Greece','🇬🇷','Athens, islands, and ancient sites',39.1,21.8]
].map(([id,name,icon,description,lat,lon])=>({id,name,icon,description,lat,lon,x:(lon+180)/360*100,y:(90-lat)/180*100}));
const countryWorld = {name:'Where to?',start:'home',rounds:Array.from({length:3},(_,i)=>({prompt:['Pick a country for the next trip. Where should the streamer go?','The journey continues. Which country should be next?','One more destination: where should chat send the streamer?'][i],choices:countries.map(c=>({id:c.id,label:c.name,icon:c.icon,description:c.description,destination:c.id}))})),locations:{home:{name:'Earth',discovery:'A whole world of possibilities. Chat chooses the next country to visit.',coordinates:'PLANET EARTH',x:50,y:50},...Object.fromEntries(countries.map(c=>[c.id,{name:c.name,discovery:`${c.description}. Chat sent the streamer to ${c.name}!`,coordinates:`${c.lat.toFixed(1)}° · ${c.lon.toFixed(1)}°`,x:c.x,y:c.y}]))}};

const configuredClientId = import.meta.env.VITE_TWITCH_CLIENT_ID || '';
const params = new URLSearchParams(location.search);
const overlayMode = params.has('overlay');
const saved = loadState();
const validHistory = (saved.history || []).filter(item => countries.some(c => c.id === item.id)).slice(-3);
const state = { theme: saved.theme || 'archive', title: saved.title === 'The Sunken Archive' ? '' : (saved.title || ''), round: Math.min(validHistory.length, 2), votes: {}, voters: new Map(), history: validHistory, duration: saved.duration || 30, seconds: 0, resolved: false, accessToken: '', broadcasterId: '', userId: '', ws: null, socketSession: '', timer: null, activity: [] };
const $ = (s) => document.querySelector(s);
const el = (tag, cls, content) => { const n = document.createElement(tag); if (cls) n.className = cls; if (content !== undefined) n.textContent = content; return n; };
const world = () => countryWorld;
const currentLocation = () => world().locations[state.history.at(-1)?.id || world().start];
const roundData = () => world().rounds[Math.min(state.round, world().rounds.length - 1)];
function loadState() { try { return JSON.parse(localStorage.getItem('cartographer-state') || '{}'); } catch { return {}; } }
function persist() { localStorage.setItem('cartographer-state', JSON.stringify({ theme: state.theme, title: state.title, round: state.round, history: state.history, duration: state.duration })); }
function setToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); }
function totalVotes() { return Object.values(state.votes).reduce((a, b) => a + b, 0); }
function chatLine(name, text, accent = '') { const row = el('div', 'chat-line'); const dot = el('span', `chat-dot ${accent}`); dot.textContent = name.slice(0, 1).toUpperCase(); row.append(dot, el('strong', '', name), el('span', '', text)); const feed = $('#chat-feed'); if (!feed) return; feed.append(row); while (feed.children.length > 5) feed.firstElementChild.remove(); feed.scrollTop = feed.scrollHeight; }
function setDemoVoteMode(enabled) { const form = $('#vote-form'); const hint = $('.chat-hint'); if (form) { form.hidden = !enabled; form.style.display = enabled ? '' : 'none'; } if (hint) { hint.hidden = !enabled; hint.style.display = enabled ? '' : 'none'; } }
function vote(user, choice, source = 'demo') {
  if (state.resolved) return;
  const options = roundData().choices;
  let selected = options.find(c => c.id === choice || c.id.startsWith(choice));
  if (!selected) { const n = Number(String(choice).replace(/\D/g, '')); if (n > 0) selected = options[n - 1]; }
  if (!selected) return;
  const previous = state.voters.get(user);
  if (previous === selected.id) return;
  if (previous) state.votes[previous] = Math.max(0, (state.votes[previous] || 0) - 1);
  state.voters.set(user, selected.id); state.votes[selected.id] = (state.votes[selected.id] || 0) + 1;
  chatLine(user, `voted for ${selected.label}`, source === 'twitch' ? 'green' : ''); renderChoices();
}
function renderChoices() {
  const list = $('#choice-list'); if (!list) return; list.replaceChildren();
  const options = roundData().choices; const total = totalVotes();
  options.forEach((choice, i) => {
    const count = state.votes[choice.id] || 0; const card = el('div', `choice-card ${state.resolved && state.history.at(-1)?.choice === choice.id ? 'winning' : ''}`);
    const icon = el('span', 'choice-icon', choice.icon); const info = el('span', 'choice-info'); info.append(el('strong', '', choice.label), el('small', '', choice.description));
    const tally = el('span', 'choice-tally'); tally.append(el('strong', '', String(count)), el('small', '', 'VOTES'));
    card.append(el('span', 'choice-number', `0${i + 1}`), icon, info, tally); const meter = el('span', 'choice-meter'); meter.style.width = `${total ? (count / total) * 100 : 0}%`; card.append(meter); list.append(card);
  });
  if ($('#voter-count')) $('#voter-count').textContent = `${total} ${total === 1 ? 'explorer has' : 'explorers have'} voted`;
  const button = $('#resolve-button'); if (button) button.innerHTML = state.resolved ? 'Open next round <span>↗</span>' : 'Reveal the route <span>↗</span>';
}
function renderMap() {
  const stage = $('#map-stage'); if (!stage) return; stage.replaceChildren(); const loc = currentLocation();
  const globe = el('div','world-globe'); globe.setAttribute('role','img'); globe.setAttribute('aria-label','Three-dimensional globe showing country destinations');
  globe.innerHTML = `<div class="globe-grid"></div><svg class="globe-land" viewBox="0 0 360 180" aria-hidden="true"><path d="M22 38l17-13 28 3 12 12-8 13-14 1-5 13-14 2-4 18-10 8-8-13 3-16-10-11 5-17zm54 46 15 7 9 18-4 22-12 24-8-13 2-21-9-15zm47-62 22-11 20 4 9 12-12 8-16-3-11 11-14-4zm32 38 17-7 17 8 9 23-8 20-3 26-13 23-11-10 1-22-11-13-4-20-12-13zm43-46 29-8 30 5 19 12 33 3 17 16-9 14-25-4-15 12-22-4-12 13-23-2-13 14-14-7 3-21-16-11 7-18zm42 74 17 7 8 17-9 19-15-6-9-15z"/></svg><div class="globe-shine"></div>`;
  const markers=el('div','globe-markers'); countries.forEach(c=>{const m=el('span',`globe-marker ${state.history.some(h=>h.id===c.id)?'visited':''} ${state.history.at(-1)?.id===c.id?'current':''}`);m.style.left=`${c.x}%`;m.style.top=`${c.y}%`;m.title=c.name;markers.append(m);}); globe.append(markers); stage.append(globe);
  const trail = state.history.slice(-3); if(trail.length){const path=trail.map(h=>h.label).join(' → ');stage.append(el('div','globe-journey',`✦ ${path}`));}
  if ($('#map-caption-text')) $('#map-caption-text').textContent = loc.discovery;
  if ($('#map-coordinates')) $('#map-coordinates').textContent = loc.coordinates;
  const title = state.title || world().name;
  if ($('#expedition-title')) $('#expedition-title').textContent = title;
  if ($('#crumb-name')) $('#crumb-name').textContent = title.toUpperCase();
  if ($('#round-number')) $('#round-number').textContent = String(Math.min(state.round + 1, 3)).padStart(2, '0');
  if ($('#round-prompt')) $('#round-prompt').textContent = state.round >= 3 && state.resolved ? 'Trip complete! Chat chose the destinations.' : roundData().prompt;
}
function addMapNode(stage, x, y, label, active, discovered, you = false) { const node = el('div', `map-node ${active ? 'active' : ''} ${discovered ? 'discovered' : ''} ${you ? 'you-are-here' : ''}`); node.style.left = `${x}%`; node.style.top = `${y}%`; node.append(el('span', 'node-pin', you ? '✳' : '')); const text = el('span', 'node-label', label); node.append(text); if (you) node.append(el('span', 'node-you', 'YOU ARE HERE')); stage.append(node); }
function render() {
  renderMap(); renderChoices(); if ($('#connection-label')) $('#connection-label').textContent = state.ws?.readyState === WebSocket.OPEN ? 'TWITCH CONNECTED' : 'DEMO MODE';
  if ($('#voting-open')) $('#voting-open').textContent = state.resolved ? 'ROUTE REVEALED' : 'VOTING OPEN';
  if ($('#route-preview')) $('#route-preview').innerHTML = countries.map((c, i) => `<div class="route-row"><span>${String(i + 1).padStart(2, '0')}</span><strong>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</strong><small>${escapeHtml(c.description)}</small></div>`).join('');
  if ($('#overlay-url')) $('#overlay-url').textContent = `${location.origin}${location.pathname}?overlay`;
  if ($('#setup-title')) $('#setup-title').value = state.title || world().name;
  if ($('#theme-select')) $('#theme-select').value = state.theme;
  if (overlayMode) document.body.classList.add('overlay-mode');
}
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
function resolveRound() {
  if (state.resolved) { if (state.history.length >= 3) { state.round = 0; state.history = []; } else state.round++; state.votes = {}; state.voters.clear(); state.resolved = false; state.seconds = 0; persist(); render(); startTimer(); return; }
  const choices = roundData().choices; const top = Math.max(...choices.map(c => state.votes[c.id] || 0));
  const winner = top > 0 ? choices.filter(c => (state.votes[c.id] || 0) === top)[Math.floor(Math.random() * choices.filter(c => (state.votes[c.id] || 0) === top).length)] : choices[Math.floor(Math.random() * choices.length)];
  state.history.push({ id: winner.destination, choice: winner.id, label: winner.label, votes: state.votes[winner.id] || 0 }); state.resolved = true; clearInterval(state.timer); persist(); render();
}
function startTimer() { clearInterval(state.timer); state.seconds = 0; state.timer = setInterval(() => { if (state.resolved) return; state.seconds++; const left = Math.max(0, state.duration - state.seconds); const t = $('#countdown'); if (t) t.textContent = `00:${String(left).padStart(2, '0')}`; const bar = $('#timer-progress'); if (bar) bar.style.width = `${100 * left / state.duration}%`; if (!left) resolveRound(); }, 1000); }
function reset() { state.round = 0; state.history = []; state.votes = {}; state.voters.clear(); state.resolved = false; state.activity = []; $('#chat-feed')?.replaceChildren(); persist(); render(); startTimer(); }
function connectTwitch() {
  const clientId = configuredClientId || $('#client-id').value.trim(); const channel = $('#channel-name').value.trim().replace(/^@/, '').toLowerCase();
  if (!clientId || !channel) { setToast('Add your Twitch Client ID and channel login first.'); return; }
  localStorage.setItem('cartographer-client-id', clientId); localStorage.setItem('cartographer-channel', channel);
  const redirect = location.origin + location.pathname; const url = new URL('https://id.twitch.tv/oauth2/authorize'); url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'token', scope: 'user:read:chat', force_verify: 'true' }); location.href = url.toString();
}
async function startTwitch(token) {
  setDemoVoteMode(false);
  state.accessToken = token; const clientId = configuredClientId || localStorage.getItem('cartographer-client-id'); const channel = localStorage.getItem('cartographer-channel');
  $('#client-id') && ($('#client-id').value = clientId || ''); $('#channel-name') && ($('#channel-name').value = channel || '');
  const status = $('#twitch-status'); if (status) status.innerHTML = '<i></i><span>Connecting to Twitch…</span>';
  try {
    const headers = { Authorization: `Bearer ${token}`, 'Client-Id': clientId };
    const me = await fetch('https://api.twitch.tv/helix/users', { headers }); if (!me.ok) throw new Error('Twitch sign-in could not be verified. Check the Client ID and sign in again.'); const meData = await me.json(); state.userId = meData.data[0].id;
    const channelRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`, { headers }); if (!channelRes.ok) throw new Error('Could not look up the channel.'); const channelData = await channelRes.json(); if (!channelData.data.length) throw new Error('Channel not found.'); state.broadcasterId = channelData.data[0].id;
    const ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws'); state.ws = ws;
    ws.addEventListener('message', async event => { const msg = JSON.parse(event.data); const type = msg.metadata?.message_type;
      if (type === 'session_welcome') { state.socketSession = msg.payload.session.id; try { const sub = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: state.broadcasterId, user_id: state.userId }, transport: { method: 'websocket', session_id: state.socketSession } }) }); if (!sub.ok) { const err = await sub.json(); throw new Error(err.message || 'EventSub subscription failed.'); } if (status) status.innerHTML = '<i class="connected"></i><span>Connected — votes from Twitch chat are live.</span>'; $('#connection-label').textContent = 'TWITCH CONNECTED'; setDemoVoteMode(false); setToast(`Listening to ${channel}'s chat`); } catch (e) { setDemoVoteMode(true); if (status) status.innerHTML = `<i></i><span>${escapeHtml(e.message)}</span>`; }
      } else if (type === 'notification' && msg.payload.subscription.type === 'channel.chat.message') { const e = msg.payload.event; const text = e.message.text.trim(); const match = text.match(/^!vote\s+(\S+)/i); if (match) vote(e.chatter_user_name, match[1], 'twitch'); }
      else if (type === 'session_reconnect') { const next = new WebSocket(msg.payload.session.reconnect_url); state.ws = next; }
    });
    ws.addEventListener('close', () => { if (status) status.innerHTML = '<i></i><span>Twitch connection closed. Reconnect from setup.</span>'; $('#connection-label').textContent = 'DEMO MODE'; setDemoVoteMode(true); });
  } catch (e) { setDemoVoteMode(true); if (status) status.innerHTML = `<i></i><span>${escapeHtml(e.message)}</span>`; }
}
function handleOAuth() { const hash = new URLSearchParams(location.hash.slice(1)); const token = hash.get('access_token'); if (token) { history.replaceState(null, '', location.pathname + location.search); startTwitch(token); } }
function bind() {
  document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.nav-item,.view').forEach(n => n.classList.remove('active')); b.classList.add('active'); $(`#${b.dataset.view}-view`).classList.add('active'); }));
  $('#vote-form').addEventListener('submit', e => { e.preventDefault(); const text = $('#vote-input').value.trim(); const match = text.match(/^!vote\s+(\S+)/i); if (match) vote('you', match[1]); else setToast('Vote with !vote followed by a number from 1 to 10'); $('#vote-input').value = ''; });
  $('#resolve-button').addEventListener('click', resolveRound); $('#reset-button').addEventListener('click', reset);
  $('#save-setup').addEventListener('click', () => { state.title = $('#setup-title').value.trim() || world().name; state.duration = Number($('#round-duration').value); reset(); setToast('Trip settings saved'); });
  $('#connect-twitch').addEventListener('click', connectTwitch);
  $('#overlay-link').addEventListener('click', () => window.open(`${location.pathname}?overlay`, 'cartographer-overlay', 'width=1200,height=760'));
  $('#preview-overlay').addEventListener('click', () => window.open(`${location.pathname}?overlay`, 'cartographer-overlay', 'width=1200,height=760'));
  $('#copy-overlay').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#overlay-url').textContent); setToast('Overlay URL copied'); } catch { setToast('Copy the overlay URL above'); } });
  $('#download-routes').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({title:world().name,countries,rounds:world().rounds.map(r=>({prompt:r.prompt,choices:r.choices}))}, null, 2)], { type: 'application/json' })); a.download = 'countries.json'; a.click(); URL.revokeObjectURL(a.href); });
}
function init() {
  const savedClientId = localStorage.getItem('cartographer-client-id'); if ($('#client-id')) { $('#client-id').value = configuredClientId || savedClientId || ''; if (configuredClientId) { $('#client-id').readOnly = true; $('#client-id').title = 'Configured by the app owner'; } }
  if (overlayMode) { document.querySelector('.sidebar')?.remove(); document.querySelector('.topbar')?.remove(); document.querySelectorAll('.page-heading,.map-caption,.page-footer').forEach(n => n.remove()); document.querySelector('.map-card')?.classList.add('overlay-map-card'); document.querySelector('.content-grid')?.classList.add('overlay-grid'); $('#map-view')?.classList.add('active'); }
  else { bind(); }
  render(); startTimer(); handleOAuth();
}
init();

