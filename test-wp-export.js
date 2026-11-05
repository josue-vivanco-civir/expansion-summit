import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ESG data preset and base CSS
const esgData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'presets', 'esg-summit.json'), 'utf-8'));
const baseCss = fs.readFileSync(path.join(__dirname, 'public', 'css', 'landing.css'), 'utf-8');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseLinks(text) {
  if (!text) return '';
  return escapeHtml(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const isInternal = url.startsWith('#');
    const target = isInternal ? '' : ' target="_blank" rel="noopener noreferrer"';
    return `<a href="${url}"${target}>${label}</a>`;
  });
}

function cleanYoutubeId(input) {
  if (!input) return '';
  const str = input.trim();
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|live\/))([\w-]{11})/);
  return match ? match[1] : str;
}

const app = esgData.appearance;
const colors = app.colors;
const fonts = app.fonts;
const fontModule = fonts.moduleTitleFont || 'Outfit';
const fontTalk = fonts.talkTitleFont || 'Plus Jakarta Sans';
const fontBody = fonts.bodyFont || 'Inter';

const uniqueFonts = [...new Set([fontModule, fontTalk, fontBody])];
const fontQuery = uniqueFonts.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`).join('&');

// 1. Header
const headerHtml = `
  <!-- 1. HEADER (LOGO Y MENÚ DE ANCLAS INTERNAS) -->
  <header class="site-header" id="main-header">
    <div class="container header-container">
      <a href="#hero" class="header-logo-link" aria-label="Inicio">
        <img src="${app.headerLogo}" alt="${escapeHtml(app.eventTitle)}" class="header-logo-img">
      </a>
      <nav class="header-nav" id="summit-header-nav" aria-label="Navegación Principal">
        <ul class="header-nav-list">
          ${esgData.header.navigation.map(item => `
            <li><a href="${item.anchor}" class="header-nav-link">${escapeHtml(item.label)}</a></li>
          `).join('')}
        </ul>
      </nav>
      <div class="header-actions">
        <a href="${esgData.header.cta.url || '#agenda'}" class="btn btn-primary btn-sm">${escapeHtml(esgData.header.cta.label || 'Registro')}</a>
        <button class="mobile-menu-btn" id="summit-mobile-menu-toggle" aria-label="Abrir menú">☰</button>
      </div>
    </div>
  </header>`;

// 2. Hero (Desktop + Mobile Cover, Overlay Opacity & Color, Hide Content support)
const hero = esgData.hero;
const heroHtml = `
  <!-- 2. PORTADA / HERO (1920 x 938 Y RESPONSIVE MOBILE) -->
  <section class="hero-section ${hero.hideContent ? 'hero-cover-only' : ''}" id="hero">
    <div class="hero-bg-wrapper">
      <picture>
        <source media="(max-width: 768px)" srcset="${hero.coverImageMobile || hero.coverImage}">
        <img src="${hero.coverImage}" alt="${escapeHtml(hero.title)}" class="hero-cover-img" width="1920" height="938" fetchpriority="high">
      </picture>
      <div class="hero-overlay"></div>
    </div>
    <div class="container">
      <div class="hero-content">
        ${hero.badge ? `<div class="hero-badge"><span class="pulse-dot"></span>${escapeHtml(hero.badge)}</div>` : ''}
        <h1 class="hero-title">${escapeHtml(hero.title)}</h1>
        <p class="hero-subtitle">${escapeHtml(hero.subtitle)}</p>
        <div class="hero-buttons">
          <a href="${hero.ctaPrimary.anchor}" class="btn btn-primary">${escapeHtml(hero.ctaPrimary.label)}</a>
          <a href="${hero.ctaSecondary.anchor}" class="btn btn-secondary">▶ ${escapeHtml(hero.ctaSecondary.label)}</a>
        </div>
        <div class="hero-stats">
          ${hero.stats.map(s => `
            <div class="stat-item">
              <span class="stat-value">${escapeHtml(s.value)}</span>
              <span class="stat-label">${escapeHtml(s.label)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  </section>`;

// 3. Patrocinadores / Sponsors (Desktop & Mobile Picture)
const spSec = esgData.sponsors || {};
const sponsorsHtml = (spSec.enabled !== false) ? `
  <!-- PATROCINADORES Y ALIADOS -->
  <section class="section sponsors" id="sponsors">
    <div class="container">
      ${spSec.label ? `<div class="sponsors-label">${escapeHtml(spSec.label)}</div>` : ''}
      ${spSec.subtitle ? `<p class="sponsors-subtitle">${escapeHtml(spSec.subtitle)}</p>` : ''}
      <div class="sponsors-img-wrapper">
        <picture>
          <source media="(max-width: 768px)" srcset="${spSec.imageMobile || spSec.imageDesktop}">
          <img src="${spSec.imageDesktop}" alt="Patrocinadores y Aliados" class="sponsors-img" loading="lazy">
        </picture>
      </div>
    </div>
  </section>` : '';

// 4. Video Oficial
const video = esgData.videoSection;
const videoHtml = `
  <!-- VIDEO OFICIAL -->
  <section class="section-padding section-alt" id="video">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Tráiler Oficial</span>
        <h2 class="section-title">${escapeHtml(video.title)}</h2>
        <p class="section-subtitle">${escapeHtml(video.subtitle)}</p>
      </div>
      <div class="video-card-container">
        <iframe class="video-iframe" src="https://www.youtube-nocookie.com/embed/${cleanYoutubeId(video.youtubeId)}?rel=0" title="Video Promocional" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
    </div>
  </section>`;

// 5. Agenda (Expansión Zigzag Timeline con Barra Continua de Progreso)
const agenda = esgData.agenda;
const agendaHtml = `
  <!-- AGENDA / TIMELINE (ZIGZAG EDITORIAL) -->
  <section class="section-padding" id="agenda">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Cronograma</span>
        <h2 class="section-title">${escapeHtml(agenda.title)}</h2>
        <p class="section-subtitle">${escapeHtml(agenda.subtitle)}</p>
      </div>
      <div class="agenda-filters" id="summit-agenda-filters">
        ${agenda.categories.map((cat, i) => `
          <button class="filter-btn ${i === 0 ? 'active' : ''}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
        `).join('')}
      </div>

      <div class="timeline__solo-card">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span>08:30 - 09:00 hrs • Registro &amp; Ceremonia de Inauguración</span>
      </div>

      <div class="timeline_progress_wrapper">
        <div class="timeline_progress">
          <div class="timeline_progress_fill" id="summit-timeline-progress"></div>
        </div>
        <div class="timeline_items_wrap" id="summit-timeline-items">
          ${agenda.items.map((item, idx) => {
            const isOdd = idx % 2 === 0;
            const alignClass = isOdd ? 'item-left-image' : 'item-right-image';
            const spk = Array.isArray(item.speakers) ? item.speakers.join(', ') : item.speakers;
            const mod = Array.isArray(item.moderators) ? item.moderators.join(', ') : item.moderators;
            return `
            <div class="timeline_item ${alignClass} ${idx === 0 ? 'active' : ''}" data-category="${escapeHtml(item.category || '')}" data-index="${idx}">
              <div class="_2-column_item_component">
                <div class="_2-column_image-wrapper">
                  ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.title)}" class="_2-column_image" loading="lazy">` : ''}
                </div>
                <div class="dot_interaction_wrapper">
                  <div class="dot"></div>
                </div>
                <div class="_2-column_content">
                  <div class="date-title">
                    <span class="date">
                      <svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>
                      ${escapeHtml(item.time || '')}
                    </span>
                    ${item.category ? `<span class="type-heading">${escapeHtml(item.category)}</span>` : ''}
                  </div>
                  <h3>${escapeHtml(item.title)}</h3>
                  <p class="text-size-medium">${escapeHtml(item.description || '')}</p>
                  ${(spk || mod) ? `
                    <ul class="ponentes">
                      ${spk ? `<li><strong>Ponente(s):</strong> <span>${escapeHtml(spk)}</span></li>` : ''}
                      ${mod ? `<li><strong>Moderador(es):</strong> <span>${escapeHtml(mod)}</span></li>` : ''}
                    </ul>
                  ` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  </section>`;

// 6. Speakers (Expansión Organic Floating Circular Portraits)
const spkSec = esgData.speakers;
const speakersHtml = `
  <!-- PONENTES / SPEAKERS -->
  <section class="section-padding section-alt" id="speakers">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Keynote &amp; Expertos</span>
        <h2 class="section-title">${escapeHtml(spkSec.title)}</h2>
        <p class="section-subtitle">${escapeHtml(spkSec.subtitle)}</p>
      </div>
      <div class="team-grid">
        ${spkSec.items.map((spk, idx) => `
          <div class="team-card team" onclick="window.summitOpenSpeakerBio('${escapeHtml(spk.id || 'spk-' + idx)}')" role="button" tabindex="0">
            <div class="team__img">
              <img src="${spk.image}" alt="${escapeHtml(spk.name)}" loading="lazy">
              <div class="team-hover">
                <span>Ver Bio</span>
              </div>
            </div>
            <div class="team__info">
              <h3 class="team__card-name">${escapeHtml(spk.name)}</h3>
              <p class="team__card-cargo">${escapeHtml(spk.role || '')}${spk.company ? ' • ' + escapeHtml(spk.company) : ''}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </section>`;

// 7. Broadcast (Expansión Signature Circular Stage con Gradiente Dinámico)
const bcSec = esgData.broadcast;
const bcItems = bcSec.items || [];
const firstBc = bcItems[0] || {};
const bcBackground = bcSec.bgGradient || 'radial-gradient(ellipse at 65% 50%, #004ecc 0%, #00237d 45%, #001040 85%, #000824 100%)';

const broadcastHtml = `
  <!-- BROADCAST (EXPANSIÓN SIGNATURE CIRCULAR STAGE) -->
  <section class="broadcast-section" id="broadcast" style="background: ${bcBackground};">
    <div class="container">
      <h2 class="broadcast-heading">${escapeHtml(bcSec.title || 'Broadcast')}</h2>
      
      <div class="broadcast-stage-grid">
        <!-- Columna 1: Info activa -->
        <div class="broadcast-info-col">
          <h3 class="broadcast-talk-title" id="summit-wp-bc-title">${escapeHtml(firstBc.title || '')}</h3>
          <div class="broadcast-talk-time" id="summit-wp-bc-time">${escapeHtml(firstBc.time || '')}</div>
          <div class="broadcast-talk-speaker" id="summit-wp-bc-speaker">${escapeHtml(firstBc.speakers || '')}</div>
          <div class="broadcast-talk-moderator" id="summit-wp-bc-moderator">${firstBc.moderators ? '<strong>Moderador(es):</strong> ' + escapeHtml(firstBc.moderators) : ''}</div>
          <button class="broadcast-play-btn" id="summit-wp-bc-play" onclick="window.summitPlayLiveVideo('${escapeHtml(cleanYoutubeId(firstBc.youtubeId || ''))}', '${escapeHtml(firstBc.title || '')}')" title="Reproducir Transmisión" aria-label="Reproducir Transmisión">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
              <polygon points="10,8 16,12 10,16"/>
            </svg>
          </button>
        </div>

        <!-- Columna 2: Círculo central ponente y flechas -->
        <div class="broadcast-center-col">
          <div class="broadcast-avatar-wrap">
            <img src="${firstBc.image || '/uploads/broadcast-1.jpg'}" alt="Ponente Activo" class="broadcast-avatar-img" id="summit-wp-bc-avatar">
          </div>
          <div class="broadcast-arrows-wrap">
            <button class="broadcast-nav-arrow" onclick="window.summitBroadcastPrev()" aria-label="Ponencia anterior">←</button>
            <button class="broadcast-nav-arrow" onclick="window.summitBroadcastNext()" aria-label="Ponencia siguiente">→</button>
          </div>
        </div>

        <!-- Columna 3: Bandeja de próximas ponencias abajo a la derecha -->
        <div class="broadcast-preview-col">
          <div class="broadcast-preview-tray" id="summit-wp-bc-tray">
            ${bcItems.length > 1 ? bcItems.slice(1, 3).map((item, i) => {
              const peeking = (i === 1 && bcItems.length > 2) ? ' peeking' : '';
              return `
                <div class="broadcast-preview-circle${peeking}" onclick="window.summitBroadcastGoTo(${i + 1})" title="Ver: ${escapeHtml(item.title)}">
                  <img src="${item.image || '/uploads/broadcast-1.jpg'}" alt="${escapeHtml(item.title)}">
                </div>
              `;
            }).join('') : ''}
          </div>
        </div>
      </div>
    </div>
  </section>`;

// 8. FAQ
const faqSec = esgData.faq;
const faqHtml = `
  <!-- PREGUNTAS FRECUENTES (FAQ) -->
  <section class="section-padding section-alt" id="faq">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Dudas y Respuestas</span>
        <h2 class="section-title">${escapeHtml(faqSec.title)}</h2>
        <p class="section-subtitle">${escapeHtml(faqSec.subtitle)}</p>
      </div>
      <div class="faq-container" id="summit-faq-accordion">
        ${faqSec.items.map((item, idx) => `
          <div class="faq-item ${idx === 0 ? 'open' : ''}">
            <button class="faq-question-btn" onclick="this.closest('.faq-item').classList.toggle('open');">
              <span>${escapeHtml(item.question)}</span>
              <span class="faq-icon">▼</span>
            </button>
            <div class="faq-answer-content">
              <p>${parseLinks(item.answer)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </section>`;

// 9. Footer
const footerSec = esgData.footer;
const footerHtml = `
  <!-- FOOTER -->
  <footer class="site-footer" id="footer">
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand">
          <img src="${app.footerLogo}" alt="${escapeHtml(app.eventTitle)}" class="footer-logo-img">
          <p class="footer-desc">${escapeHtml(footerSec.description)}</p>
        </div>
        <div>
          <h4 class="footer-col-title">Enlaces Rápidos</h4>
          <ul class="footer-links-list">
            <li><a href="#hero" class="footer-link">Inicio</a></li>
            <li><a href="#agenda" class="footer-link">Agenda</a></li>
            <li><a href="#broadcast" class="footer-link">Transmisión</a></li>
            <li><a href="#faq" class="footer-link">Preguntas Frecuentes</a></li>
          </ul>
        </div>
        <div>
          <h4 class="footer-col-title">Síguenos</h4>
          <div class="footer-socials">
            ${footerSec.socials.map(s => `
              <a href="${s.url}" target="_blank" rel="noopener" class="footer-social-btn"><span>${escapeHtml(s.name)}</span></a>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>${escapeHtml(footerSec.copyright)}</p>
        <p>${escapeHtml(app.eventTitle)}</p>
      </div>
    </div>
  </footer>`;

// Movable Sections Assembly
const movableSectionsMap = {
  sponsors: sponsorsHtml,
  agenda: agendaHtml,
  speakers: speakersHtml,
  broadcast: broadcastHtml,
  video: videoHtml
};
const activeOrder = esgData.sectionOrder || ['sponsors', 'agenda', 'speakers', 'broadcast', 'video'];
const orderedMovableHtml = activeOrder.map(key => movableSectionsMap[key] || '').join('\n');

// Compiled CSS
const compiledCss = `
  :root, #summit-wp-root {
    --color-primary: ${colors.primaryColor};
    --color-primary-hover: ${colors.primaryHover};
    --color-accent: ${colors.accentColor};
    --color-bg: ${colors.backgroundColor};
    --color-surface: ${colors.surfaceColor};
    --color-surface-card: #ffffff;
    --color-border: #e2e8f0;
    --color-module-title: ${colors.moduleTitleColor};
    --color-talk-title: ${colors.talkTitleColor};
    --color-desc: ${colors.descriptionColor};
    --header-bg: ${colors.headerBg};
    --footer-bg: ${colors.footerBg};
    --footer-text: ${colors.footerTextColor};

    --bg-section-header: ${app.sectionBgs?.header || colors.headerBg};
    --bg-section-hero: ${app.sectionBgs?.hero || '#0a100d'};
    --bg-section-sponsors: ${app.sectionBgs?.sponsors || '#ffffff'};
    --bg-section-video: ${app.sectionBgs?.video || colors.backgroundColor};
    --bg-section-agenda: ${app.sectionBgs?.agenda || colors.backgroundColor};
    --bg-section-speakers: ${app.sectionBgs?.speakers || '#f8f9fa'};
    --bg-section-broadcast: ${app.sectionBgs?.broadcast || colors.backgroundColor};
    --bg-section-faq: ${app.sectionBgs?.faq || '#f8f9fa'};
    --bg-section-footer: ${app.sectionBgs?.footer || colors.footerBg};

    --hero-overlay-opacity: ${(hero.overlayOpacity !== undefined ? hero.overlayOpacity : 70) / 100};
    --hero-overlay-color: ${hero.overlayColor || '#0a100d'};

    --font-module-title: '${fontModule}', sans-serif;
    --font-talk-title: '${fontTalk}', sans-serif;
    --font-body: '${fontBody}', sans-serif;
  }
  ${baseCss}

  ${app.customCss || ''}
`;

// Compiled JS (Expansión Signature Engine: Slide-in Drawer, Circular Broadcast Rotator, Zigzag Timeline)
const compiledJs = `
(function() {
  var speakersData = ${JSON.stringify(spkSec.items.map((s, idx) => ({
    id: s.id || ('spk-' + idx),
    name: s.name,
    role: s.role || '',
    company: s.company || '',
    bio: s.bio || '',
    image: s.image || '/uploads/speaker-1.jpg'
  })))};

  var broadcastData = ${JSON.stringify(bcItems.map(b => ({
    title: b.title,
    time: b.time || '',
    speakers: b.speakers || '',
    moderators: b.moderators || '',
    youtubeId: cleanYoutubeId(b.youtubeId || ''),
    image: b.image || '/uploads/broadcast-1.jpg'
  })))};

  // 1. YouTube Live Modal
  window.summitPlayLiveVideo = function(videoId, title) {
    var modal = document.getElementById('summit-wp-modal');
    var iframe = document.getElementById('summit-wp-modal-iframe');
    var titleEl = document.getElementById('summit-wp-modal-title');
    if (!modal || !iframe) return;
    if (titleEl) titleEl.textContent = title || 'Transmisión En Vivo';
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId + '?autoplay=1&rel=0';
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  };

  window.summitCloseLiveVideo = function() {
    var modal = document.getElementById('summit-wp-modal');
    var iframe = document.getElementById('summit-wp-modal-iframe');
    if (modal) {
      if (typeof modal.close === 'function') { modal.close(); }
      else { modal.removeAttribute('open'); }
    }
    if (iframe) { iframe.src = ''; }
  };

  // 2. Expansión Slide-in Speaker Bio Drawer
  window.summitOpenSpeakerBio = function(speakerId) {
    var spk = null;
    for (var i = 0; i < speakersData.length; i++) {
      if (speakersData[i].id === speakerId || ('spk-' + i) === speakerId) {
        spk = speakersData[i];
        break;
      }
    }
    if (!spk) return;

    var modal = document.getElementById('summit-wp-speaker-modal');
    var avatar = document.getElementById('summit-wp-modal-spk-img');
    var name = document.getElementById('summit-wp-modal-spk-name');
    var role = document.getElementById('summit-wp-modal-spk-role');
    var bio = document.getElementById('summit-wp-modal-spk-bio');

    if (avatar) avatar.src = spk.image || '';
    if (name) name.textContent = spk.name || '';
    if (role) role.textContent = spk.role + (spk.company ? ' • ' + spk.company : '');
    if (bio) bio.textContent = spk.bio || 'Trayectoria del ponente próximamente disponible.';

    if (modal) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  };

  window.summitCloseSpeakerBio = function() {
    var modal = document.getElementById('summit-wp-speaker-modal');
    if (modal) {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      window.summitCloseSpeakerBio();
      window.summitCloseLiveVideo();
    }
  });

  // 3. Expansión Signature Circular Stage Rotator
  var currentBcIdx = 0;
  function renderWpBroadcastStage(idx) {
    if (!broadcastData.length) return;
    currentBcIdx = (idx + broadcastData.length) % broadcastData.length;
    var active = broadcastData[currentBcIdx];

    var titleEl = document.getElementById('summit-wp-bc-title');
    var timeEl = document.getElementById('summit-wp-bc-time');
    var spkEl = document.getElementById('summit-wp-bc-speaker');
    var modEl = document.getElementById('summit-wp-bc-moderator');
    var avatarEl = document.getElementById('summit-wp-bc-avatar');
    var playBtn = document.getElementById('summit-wp-bc-play');
    var tray = document.getElementById('summit-wp-bc-tray');

    if (titleEl) titleEl.textContent = active.title || '';
    if (timeEl) timeEl.textContent = active.time || '';
    if (spkEl) spkEl.textContent = active.speakers || '';
    if (modEl) modEl.innerHTML = active.moderators ? '<strong>Moderador(es):</strong> ' + active.moderators : '';
    if (avatarEl) avatarEl.src = active.image;
    if (playBtn) {
      playBtn.onclick = function() {
        window.summitPlayLiveVideo(active.youtubeId, active.title);
      };
    }

    if (tray && broadcastData.length > 1) {
      var count = Math.min(broadcastData.length - 1, 2);
      var html = '';
      for (var offset = 1; offset <= count; offset++) {
        var targetIdx = (currentBcIdx + offset) % broadcastData.length;
        var itm = broadcastData[targetIdx];
        var peekingClass = (offset === 2 && broadcastData.length > 2) ? ' peeking' : '';
        html += '<div class="broadcast-preview-circle' + peekingClass + '" onclick="window.summitBroadcastGoTo(' + targetIdx + ')" title="Ver: ' + itm.title + '"><img src="' + itm.image + '" alt="' + itm.title + '"></div>';
      }
      tray.innerHTML = html;
    }
  }

  window.summitBroadcastNext = function() { renderWpBroadcastStage(currentBcIdx + 1); };
  window.summitBroadcastPrev = function() { renderWpBroadcastStage(currentBcIdx - 1); };
  window.summitBroadcastGoTo = function(idx) { renderWpBroadcastStage(idx); };

  // 4. Zigzag Timeline Scroll Tracking
  function setupTimelineAnimation() {
    var progress = document.getElementById('summit-timeline-progress');
    var container = document.getElementById('summit-timeline-items');
    if (!progress || !container) return;

    var items = container.querySelectorAll('.timeline_item');
    if (!items.length) return;

    function onScroll() {
      var containerRect = container.getBoundingClientRect();
      var containerHeight = containerRect.height;
      var triggerY = window.innerHeight * 0.55;

      var activeIndex = -1;
      items.forEach(function(item, idx) {
        var itemRect = item.getBoundingClientRect();
        if (itemRect.top <= triggerY) {
          activeIndex = idx;
        }
      });

      items.forEach(function(item, idx) {
        if (idx <= activeIndex) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      if (containerHeight > 0) {
        var scrollPercent = Math.max(0, Math.min(1, (triggerY - containerRect.top) / containerHeight));
        progress.style.height = (scrollPercent * 100) + '%';
      }
    }

    window.addEventListener('scroll', function() {
      window.requestAnimationFrame(onScroll);
    }, { passive: true });

    setTimeout(onScroll, 300);
  }
  setupTimelineAnimation();

  // 5. Category Filtering
  var filters = document.querySelectorAll('#summit-agenda-filters .filter-btn');
  var timelineItems = document.querySelectorAll('#summit-timeline-items .timeline_item');
  filters.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filters.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var cat = btn.getAttribute('data-category');
      timelineItems.forEach(function(item) {
        if (cat === 'Todas' || item.getAttribute('data-category') === cat) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  // 6. Mobile Navigation Toggle
  var menuBtn = document.getElementById('summit-mobile-menu-toggle');
  var nav = document.getElementById('summit-header-nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function() {
      nav.classList.toggle('mobile-open');
    });
    nav.querySelectorAll('.header-nav-link').forEach(function(link) {
      link.addEventListener('click', function() { nav.classList.remove('mobile-open'); });
    });
  }
})();
`;

const seoData = esgData.seo || {};

const sampleFullHtml = `<!-- ========================================================
     SUMMIT EVENT LANDING - RAW HTML BLOCK FOR WORDPRESS
     Generado automáticamente por Summit CMS Engine
     Compatible con Bloque HTML Personalizado Gutenberg y Elementor

     ========================================================
     METADATOS SEO Y OPEN GRAPH (OPCIONAL PARA PEGAR EN <HEAD>):
     ========================================================
     <title>${escapeHtml(seoData.metaTitle || app.eventTitle || 'Summit Innovation 2026')}</title>
     <meta name="description" content="${escapeHtml(seoData.metaDescription || '')}">
     <meta name="keywords" content="${escapeHtml(seoData.keywords || '')}">
     <meta name="robots" content="${escapeHtml(seoData.metaRobots || 'index, follow')}">
     <link rel="canonical" href="${escapeHtml(seoData.canonicalUrl || '')}">
     <meta property="og:type" content="${escapeHtml(seoData.ogType || 'website')}">
     <meta property="og:title" content="${escapeHtml(seoData.ogTitle || seoData.metaTitle || '')}">
     <meta property="og:description" content="${escapeHtml(seoData.ogDescription || seoData.metaDescription || '')}">
     <meta property="og:image" content="${seoData.ogImage || '/uploads/hero-cover.jpg'}">
     <meta property="og:url" content="${escapeHtml(seoData.ogUrl || seoData.canonicalUrl || '')}">
     <meta name="twitter:card" content="${escapeHtml(seoData.twitterCard || 'summary_large_image')}">
     ======================================================== -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${fontQuery}&display=swap" rel="stylesheet">

<style>
${compiledCss}
</style>

<div id="summit-wp-root" class="summit-landing-root">
${headerHtml}
${heroHtml}
<div id="summit-movable-sections">
${orderedMovableHtml}
</div>
${faqHtml}
${footerHtml}

  <!-- MODAL YOUTUBE LIVE PLAYER -->
  <dialog class="video-modal" id="summit-wp-modal" aria-labelledby="summit-wp-modal-title">
    <div class="modal-header">
      <div class="modal-title">
        <span style="color:#ef4444;">🔴</span>
        <span id="summit-wp-modal-title">Transmisión en Vivo</span>
      </div>
      <button class="modal-close-btn" onclick="window.summitCloseLiveVideo()" aria-label="Cerrar modal">&times;</button>
    </div>
    <div class="modal-body">
      <iframe id="summit-wp-modal-iframe" class="modal-iframe" src="" title="Reproductor en Vivo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>
  </dialog>

  <!-- MODAL BIOGRAFÍA PONENTES (EXPANSIÓN SLIDE-IN DRAWER) -->
  <div class="modal-team" id="summit-wp-speaker-modal" role="dialog" aria-modal="true">
    <div class="modal-overlay" onclick="window.summitCloseSpeakerBio()"></div>
    <div class="modal-panel">
      <button class="modal__close" onclick="window.summitCloseSpeakerBio()" aria-label="Cerrar modal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <div class="team-modal">
        <div class="team__wide-img">
          <img id="summit-wp-modal-spk-img" src="" alt="Foto Ponente">
        </div>
        <div class="team-modal__header">
          <h2 class="modal-team-name" id="summit-wp-modal-spk-name"></h2>
          <div class="modal-team-role" id="summit-wp-modal-spk-role"></div>
        </div>
        <div class="team__bio" id="summit-wp-modal-spk-bio"></div>
      </div>
    </div>
  </div>
</div>

<script>
${compiledJs}
</script>
<!-- FIN DE BLOQUE RAW HTML SUMMIT -->`;

const distDir = path.join(__dirname, 'public', 'export');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
const outPath = path.join(distDir, 'esg-summit-wordpress-sample.html');
fs.writeFileSync(outPath, sampleFullHtml, 'utf-8');

console.log(`Generated WordPress sample HTML at: ${outPath} (${(Buffer.byteLength(sampleFullHtml)/1024).toFixed(1)} KB)`);

// Validations
console.log('--- EXPORT VERIFICATION SUITE ---');
let passed = 0;
let total = 0;

function assert(condition, desc) {
  total++;
  if (condition) {
    passed++;
    console.log(`✓ [PASS] ${desc}`);
  } else {
    console.error(`✗ [FAIL] ${desc}`);
  }
}

assert(sampleFullHtml.includes('METADATOS SEO Y OPEN GRAPH'), 'Contains SEO & Open Graph meta header comments');
assert(sampleFullHtml.includes('esgsummit'), 'Contains canonical URL from SEO config');
assert(sampleFullHtml.includes('broadcast-section'), 'Contains Expansión signature broadcast section');
assert(sampleFullHtml.includes('broadcast-stage-grid'), 'Contains broadcast 3-column stage grid');
assert(sampleFullHtml.includes('broadcast-avatar-wrap'), 'Contains circular active speaker avatar');
assert(sampleFullHtml.includes('broadcast-preview-circle'), 'Contains bottom-right upcoming preview circle');
assert(sampleFullHtml.includes('section sponsors'), 'Contains responsive Sponsors section');
assert(sampleFullHtml.includes('timeline_progress_wrapper'), 'Contains Expansión zigzag timeline architecture');
assert(sampleFullHtml.includes('team-grid'), 'Contains Expansión organic circular speaker grid');
assert(sampleFullHtml.includes('modal-team'), 'Contains Expansión slide-in drawer team modal');

console.log(`\nResults: ${passed} / ${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
}
