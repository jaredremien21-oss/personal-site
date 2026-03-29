/* ═══════════════════════════════════════════════════
   PERSONAL SITE — script.js
═══════════════════════════════════════════════════ */

/* ─── 1. NAV: scroll state + active link ─────────── */
const navbar   = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 100) current = sec.getAttribute('id');
  });
  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}, { passive: true });


/* ─── 2. MOBILE MENU ──────────────────────────────── */
const navToggle   = document.getElementById('navToggle');
const mobileMenu  = document.getElementById('mobileMenu');
const mobileLinks = document.querySelectorAll('.mobile-link');

navToggle.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('open');
  navToggle.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
});

mobileLinks.forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    navToggle.classList.remove('open');
    document.body.style.overflow = '';
  });
});


/* ─── 3. SCROLL FADE-IN ───────────────────────────── */
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));


/* ─── 4. TRAVEL MAPS ─────────────────────────────── */

// ══ VISITED COUNTRIES (ISO 3166-1 numeric codes) ══
// Add more below — slug = /assets/travel/[slug].jpg
const VISITED_COUNTRIES = {
  392: { name: 'Japan',         slug: 'japan' },
  756: { name: 'Switzerland',   slug: 'switzerland' },
  352: { name: 'Iceland',       slug: 'iceland' },
  724: { name: 'Spain',         slug: 'spain' },
  380: { name: 'Italy',         slug: 'italy' },
  300: { name: 'Greece',        slug: 'greece' },
  152: { name: 'Chile',         slug: 'chile' },
  484: { name: 'Mexico',        slug: 'mexico' },
  620: { name: 'Portugal',      slug: 'portugal' },
  840: { name: 'United States', slug: null },   // USA → opens states modal
  // Add more: e.g. 826: { name: 'United Kingdom', slug: 'uk' }
};

// ══ US STATES (FIPS codes for unvisited) ══════════
const UNVISITED_FIPS = new Set([1, 5, 22, 28, 29, 45, 55]);
// Alabama(1) Arkansas(5) Louisiana(22) Mississippi(28)
// Missouri(29) South Carolina(45) Wisconsin(55)

const US_STATE_NAMES = {
  1:'Alabama', 2:'Alaska', 4:'Arizona', 5:'Arkansas', 6:'California',
  8:'Colorado', 9:'Connecticut', 10:'Delaware', 12:'Florida', 13:'Georgia',
  15:'Hawaii', 16:'Idaho', 17:'Illinois', 18:'Indiana', 19:'Iowa',
  20:'Kansas', 21:'Kentucky', 22:'Louisiana', 23:'Maine', 24:'Maryland',
  25:'Massachusetts', 26:'Michigan', 27:'Minnesota', 28:'Mississippi',
  29:'Missouri', 30:'Montana', 31:'Nebraska', 32:'Nevada', 33:'New Hampshire',
  34:'New Jersey', 35:'New Mexico', 36:'New York', 37:'North Carolina',
  38:'North Dakota', 39:'Ohio', 40:'Oklahoma', 41:'Oregon', 42:'Pennsylvania',
  44:'Rhode Island', 45:'South Carolina', 46:'South Dakota', 47:'Tennessee',
  48:'Texas', 49:'Utah', 50:'Vermont', 51:'Virginia', 53:'Washington',
  54:'West Virginia', 55:'Wisconsin', 56:'Wyoming'
};

const MAP_GREEN       = '#4E7A5E';
const MAP_GREEN_HOVER = '#3A5E47';
const MAP_UNVISITED   = '#DDD5C8';
const MAP_USA         = '#3A6EA5';
const MAP_USA_HOVER   = '#2A5285';

let statesGeoJSON = null;   // shared cache
let worldMapInst  = null;
let usaMapInst    = null;
let miniMapInst   = null;
let miniMapReady  = false;
let usaTabReady   = false;
let travelReady   = false;

// ── Animated counter (shared) ──────────────────────
function animateCount(el, target, duration = 1200, { suffix = '', decimals = 0 } = {}) {
  const start = performance.now();
  const run = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const val = (1 - Math.pow(1 - p, 3)) * target;
    el.textContent = (decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString()) + suffix;
    if (p < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

// ── Tooltip elements ──────────────────────────────
const countryTooltip = document.getElementById('countryTooltip');
const ctImg          = document.getElementById('ctImg');
const ctName         = document.getElementById('ctName');
const stateTooltip   = document.getElementById('stateTooltip');

function positionElem(el, evt, offX, offY) {
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = evt.clientX + offX;
  let top  = evt.clientY + offY;
  if (left + w > window.innerWidth  - 8) left = evt.clientX - w - Math.abs(offX);
  if (top  < 8) top = 8;
  if (top  + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
  el.style.left = left + 'px';
  el.style.top  = top  + 'px';
}

function showCountryTooltip(mouseEvt, isoCode) {
  const c = VISITED_COUNTRIES[isoCode];
  if (!c) return;
  ctName.textContent = c.name;
  if (c.slug) {
    ctImg.src = `assets/travel/${c.slug}.jpg`;
    ctImg.style.display = 'block';
    ctImg.onerror = () => { ctImg.style.display = 'none'; };
  } else {
    ctImg.style.display = 'none';
  }
  countryTooltip.classList.add('ct-visible');
  positionElem(countryTooltip, mouseEvt, 16, -countryTooltip.offsetHeight / 2);
}

function hideCountryTooltip() {
  countryTooltip.classList.remove('ct-visible');
}

function showStateTooltip(evt, name) {
  stateTooltip.textContent = name;
  stateTooltip.classList.add('st-visible');
  stateTooltip.style.left = (evt.clientX + 12) + 'px';
  stateTooltip.style.top  = (evt.clientY - 30) + 'px';
}

function hideStateTooltip() {
  stateTooltip.classList.remove('st-visible');
}

// ── Map tab switching ─────────────────────────────
document.querySelectorAll('.map-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.map-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const panelWorld = document.getElementById('panel-world');
    const panelUSA   = document.getElementById('panel-usa');
    if (btn.dataset.tab === 'world') {
      panelWorld.classList.remove('map-panel-hidden');
      panelUSA.classList.add('map-panel-hidden');
      worldMapInst?.invalidateSize();
    } else {
      panelWorld.classList.add('map-panel-hidden');
      panelUSA.classList.remove('map-panel-hidden');
      if (!usaTabReady) { usaTabReady = true; initUSAMap(); }
      else usaMapInst?.invalidateSize();
    }
  });
});

// ── USA Modal ─────────────────────────────────────
const usaModal         = document.getElementById('usaModal');
const usaModalClose    = document.getElementById('usaModalClose');
const usaModalBackdrop = document.getElementById('usaModalBackdrop');

function openUSAModal() {
  usaModal.classList.add('modal-open');
  usaModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (!miniMapReady) { miniMapReady = true; setTimeout(initMiniUSAMap, 60); }
  else miniMapInst?.invalidateSize();
}
function closeUSAModal() {
  usaModal.classList.remove('modal-open');
  usaModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
usaModalClose?.addEventListener('click', closeUSAModal);
usaModalBackdrop?.addEventListener('click', closeUSAModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeUSAModal(); });

// ── Tile helper ───────────────────────────────────
function addTiles(map) {
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    { subdomains: 'abcd', maxZoom: 19 }).addTo(map);
}

// ── Antimeridian normalization ────────────────────
// Prevents horizontal streak lines for countries crossing ±180° (e.g. Russia)
function normalizeRing(ring) {
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    let lng = ring[i][0];
    const prev = out[i - 1][0];   // use already-normalized previous point
    while (lng - prev >  180) lng -= 360;
    while (prev - lng >  180) lng += 360;
    out.push([lng, ring[i][1]]);
  }
  return out;
}
function normalizeFeature(f) {
  const g = f.geometry;
  if (g.type === 'Polygon') {
    return { ...f, geometry: { ...g, coordinates: g.coordinates.map(normalizeRing) } };
  }
  if (g.type === 'MultiPolygon') {
    return { ...f, geometry: { ...g, coordinates: g.coordinates.map(p => p.map(normalizeRing)) } };
  }
  return f;
}

// ── World choropleth map ──────────────────────────
async function initWorldMap() {
  worldMapInst = L.map('worldMap', {
    center: [20, 10], zoom: 2, minZoom: 1, maxZoom: 6,
    scrollWheelZoom: false, attributionControl: false,
  });
  addTiles(worldMapInst);

  try {
    const res   = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    const world = await res.json();
    const countries = topojson.feature(world, world.objects.countries);
    countries.features = countries.features.map(normalizeFeature);

    L.geoJSON(countries, {
      style: f => {
        const id = parseInt(f.id);
        const v  = id in VISITED_COUNTRIES;
        const fillColor = id === 840 ? MAP_USA : v ? MAP_GREEN : MAP_UNVISITED;
        return { fillColor, fillOpacity: v ? 0.65 : 0.25, color: '#C8C0B4', weight: 0.5 };
      },
      onEachFeature: (f, layer) => {
        const id = parseInt(f.id);
        if (!(id in VISITED_COUNTRIES)) return;

        if (id === 840) {
          layer.on('click', openUSAModal);
          layer.on('mouseover', e => {
            layer.setStyle({ fillColor: MAP_USA_HOVER, fillOpacity: 0.8 });
            ctName.textContent = '🇺🇸 United States — click to explore states';
            ctImg.style.display = 'none';
            countryTooltip.classList.add('ct-visible');
            positionElem(countryTooltip, e.originalEvent, 16, -40);
          });
          layer.on('mousemove', e => positionElem(countryTooltip, e.originalEvent, 16, -40));
          layer.on('mouseout', () => {
            layer.setStyle({ fillColor: MAP_USA, fillOpacity: 0.65 });
            hideCountryTooltip();
          });
        } else {
          layer.on('mouseover', e => {
            layer.setStyle({ fillColor: MAP_GREEN_HOVER, fillOpacity: 0.85 });
            showCountryTooltip(e.originalEvent, id);
          });
          layer.on('mousemove', e => positionElem(countryTooltip, e.originalEvent, 16, -40));
          layer.on('mouseout', () => {
            layer.setStyle({ fillColor: MAP_GREEN, fillOpacity: 0.65 });
            hideCountryTooltip();
          });
        }
      }
    }).addTo(worldMapInst);

    // USA click badge — always visible hint
    const usaBadgeIcon = L.divIcon({
      className: 'usa-map-badge',
      html: '🗺️ Explore 43 States',
      iconAnchor: [70, 10],
    });
    L.marker([40, -98], { icon: usaBadgeIcon, interactive: true })
      .on('click', openUSAModal)
      .addTo(worldMapInst);

  } catch (err) {
    console.error('World map error:', err);
  }
}

// ── States GeoJSON (cached) ───────────────────────
async function loadStates() {
  if (!statesGeoJSON) {
    const res = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
    const us  = await res.json();
    statesGeoJSON = topojson.feature(us, us.objects.states);
  }
  return statesGeoJSON;
}

async function addStatesLayer(mapInst, isMini = false) {
  const data = await loadStates();
  L.geoJSON(data, {
    style: f => {
      const fips = parseInt(f.id);
      const v    = !UNVISITED_FIPS.has(fips);
      return { fillColor: v ? MAP_GREEN : '#E8E2DA', fillOpacity: v ? 0.65 : 0.35,
               color: '#BFB8AF', weight: 0.8 };
    },
    onEachFeature: isMini ? null : (f, layer) => {
      const fips = parseInt(f.id);
      const name = US_STATE_NAMES[fips] || '';
      const v    = !UNVISITED_FIPS.has(fips);
      layer.on('mouseover', e => {
        layer.setStyle({ fillOpacity: 0.9 });
        showStateTooltip(e.originalEvent, (v ? '✓ ' : '') + name);
      });
      layer.on('mousemove', e => {
        stateTooltip.style.left = (e.originalEvent.clientX + 12) + 'px';
        stateTooltip.style.top  = (e.originalEvent.clientY - 30) + 'px';
      });
      layer.on('mouseout', () => {
        layer.setStyle({ fillOpacity: v ? 0.65 : 0.35 });
        hideStateTooltip();
      });
    }
  }).addTo(mapInst);
}

async function initUSAMap() {
  usaMapInst = L.map('usaMap', {
    center: [38, -96], zoom: 4,
    scrollWheelZoom: false, attributionControl: false,
  });
  addTiles(usaMapInst);
  await addStatesLayer(usaMapInst, false);
}

async function initMiniUSAMap() {
  miniMapInst = L.map('usaMiniMap', {
    center: [38, -96], zoom: 3,
    zoomControl: false, scrollWheelZoom: false, attributionControl: false,
    dragging: false, doubleClickZoom: false, keyboard: false,
  });
  addTiles(miniMapInst);
  await addStatesLayer(miniMapInst, true);
}

// ── Init on scroll into view ──────────────────────
new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !travelReady) {
    travelReady = true;
    initWorldMap();
    const el = document.querySelector('.t-stat-num[data-target]');
    if (el) animateCount(el, parseInt(el.dataset.target), 1200);
  }
}, { threshold: 0.15 }).observe(document.getElementById('travel'));


/* ─── 5. PROJECT FILTER ──────────────────────────── */
const filterBtns    = document.querySelectorAll('.filter-btn');
const projectCards  = document.querySelectorAll('.project-card');
const projectsEmpty = document.getElementById('projectsEmpty');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    let visible = 0;
    projectCards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('hidden', !match);
      if (match) visible++;
    });
    if (projectsEmpty) projectsEmpty.style.display = visible === 0 ? 'block' : 'none';
  });
});


/* ─── 6. NUMBER COUNTERS ─────────────────────────── */
const numberSection = document.getElementById('numbers');
let numbersAnimated = false;

new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !numbersAnimated) {
    numbersAnimated = true;
    document.querySelectorAll('.number-val[data-target]').forEach(el => {
      const target   = parseFloat(el.dataset.target);
      const suffix   = el.dataset.suffix   || '';
      const decimals = parseInt(el.dataset.decimals || '0');
      animateCount(el, target, 1600, { suffix, decimals });
    });
  }
}, { threshold: 0.3 }).observe(numberSection);


/* ─── 7. AMA CHAT ────────────────────────────────── */
const chatWindow = document.getElementById('chatWindow');
const chatInput  = document.getElementById('chatInput');
const chatSend   = document.getElementById('chatSend');
let chatHistory  = [];

function appendBubble(role, content) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.textContent = role === 'assistant' ? 'AI' : 'You';
  const msg = document.createElement('div');
  msg.className = 'chat-msg';
  msg.textContent = content;
  bubble.appendChild(avatar);
  bubble.appendChild(msg);
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showTyping() {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble assistant typing-bubble';
  bubble.innerHTML = `<div class="chat-avatar">AI</div>
    <div class="chat-msg"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  chatSend.disabled = true;
  appendBubble('user', text);
  chatHistory.push({ role: 'user', content: text });
  const typingEl = showTyping();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: chatHistory }),
    });
    typingEl.remove();
    if (!res.ok) throw new Error('Request failed');
    const data  = await res.json();
    const reply = data.reply || "Hmm, something went quiet. Try again?";
    appendBubble('assistant', reply);
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    typingEl.remove();
    appendBubble('assistant', "Something went sideways — or the API isn't connected yet. Try emailing me directly!");
    console.error('Chat error:', err);
  }
  chatSend.disabled = false;
  chatInput.focus();
}

chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});


/* ─── 8. SMOOTH SCROLL ───────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
