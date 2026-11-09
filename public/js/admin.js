/**
 * SUMMIT CMS - ADMIN ENGINE
 * Complete management system for Summit Landing Pages
 */

let summitData = null;
let currentUser = null;
let currentEditingItem = null;
let currentEditingType = null;

document.addEventListener('DOMContentLoaded', () => {
  initAdmin();
});

async function initAdmin() {
  const isAuth = await checkAuthSession();
  if (!isAuth) return; // Will redirect to /login

  setupSidebarNavigation();
  setupGlobalActions();
  await loadSummitData();
  if (currentUser?.role === 'admin') {
    loadUsersList();
  }
}

/**
 * 1. DATA LOADING & SAVING
 */
async function loadSummitData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Error al cargar datos desde el servidor');
    summitData = await res.json();
    populateAllForms();
    showToast('Datos cargados correctamente', 'success');
  } catch (err) {
    console.error(err);
    showToast('Error de conexión. Trabajando en modo local.', 'error');
  }
}

async function saveAllData() {
  if (!summitData) return;
  extractAllFormData();

  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summitData)
    });
    const result = await res.json();
    if (result.success) {
      showToast('¡Cambios guardados con éxito en el servidor!', 'success');
    } else {
      throw new Error(result.error || 'Error al guardar');
    }
  } catch (err) {
    console.error('Error al guardar:', err);
    showToast('Error al guardar datos: ' + err.message, 'error');
  }
}

/**
 * 2. POPULATE ADMIN FORMS
 */
function populateAllForms() {
  if (!summitData) return;

  // Appearance
  const app = summitData.appearance || {};
  const colors = app.colors || {};
  const fonts = app.fonts || {};

  setVal('app-event-title', app.eventTitle);
  setVal('app-font-module', fonts.moduleTitleFont || 'Outfit');
  setVal('app-font-talk', fonts.talkTitleFont || 'Plus Jakarta Sans');
  setVal('app-font-body', fonts.bodyFont || 'Inter');

  syncColorField('color-module-title', 'color-module-title-hex', colors.moduleTitleColor || '#0f172a');
  syncColorField('color-talk-title', 'color-talk-title-hex', colors.talkTitleColor || '#1e293b');
  syncColorField('color-desc', 'color-desc-hex', colors.descriptionColor || '#475569');
  syncColorField('color-primary', 'color-primary-hex', colors.primaryColor || '#2563eb');
  syncColorField('color-accent', 'color-accent-hex', colors.accentColor || '#f59e0b');
  syncColorField('color-bg', 'color-bg-hex', colors.backgroundColor || '#ffffff');
  syncColorField('color-header-bg', 'color-header-bg-hex', colors.headerBg || '#ffffff');
  syncColorField('color-footer-bg', 'color-footer-bg-hex', colors.footerBg || '#090d16');

  // Per-Section Background Colors
  const secBgs = app.sectionBgs || {};
  syncColorField('color-sec-header', 'color-sec-header-hex', secBgs.header || colors.headerBg || '#1d1d1b');
  syncColorField('color-sec-hero', 'color-sec-hero-hex', secBgs.hero || '#101828');
  syncColorField('color-sec-video', 'color-sec-video-hex', secBgs.video || colors.backgroundColor || '#fdfae7');
  syncColorField('color-sec-agenda', 'color-sec-agenda-hex', secBgs.agenda || colors.backgroundColor || '#fdfae7');
  syncColorField('color-sec-speakers', 'color-sec-speakers-hex', secBgs.speakers || '#f8f6e2');
  syncColorField('color-sec-broadcast', 'color-sec-broadcast-hex', secBgs.broadcast || colors.backgroundColor || '#fdfae7');
  syncColorField('color-sec-faq', 'color-sec-faq-hex', secBgs.faq || '#f8f6e2');
  syncColorField('color-sec-footer', 'color-sec-footer-hex', secBgs.footer || colors.footerBg || '#1d1d1b');
  syncColorField('color-sec-sponsors', 'color-sec-sponsors-hex', secBgs.sponsors || '#ffffff');

  // Custom CSS Code Override
  setVal('app-custom-css', app.customCss || '');

  setImagePreview('header-logo-preview', app.headerLogo);
  setVal('header-logo-url', app.headerLogo || '');
  setImagePreview('footer-logo-preview', app.footerLogo);
  setVal('footer-logo-url', app.footerLogo || '');

  // Header Nav
  renderNavItemsList();
  setVal('header-cta-label', summitData.header?.cta?.label);
  setVal('header-cta-url', summitData.header?.cta?.url);

  // Hero Section
  const hero = summitData.hero || {};
  setVal('hero-badge', hero.badge);
  setVal('hero-title', hero.title);
  setVal('hero-subtitle', hero.subtitle);
  setVal('hero-cta-pri-label', hero.ctaPrimary?.label);
  setVal('hero-cta-pri-anchor', hero.ctaPrimary?.anchor);
  setVal('hero-cta-sec-label', hero.ctaSecondary?.label);
  setVal('hero-cta-sec-anchor', hero.ctaSecondary?.anchor);
  setImagePreview('hero-cover-preview', hero.coverImage);
  setVal('hero-cover-url', hero.coverImage || '');
  setImagePreview('hero-cover-mobile-preview', hero.coverImageMobile || hero.coverImage);
  setVal('hero-cover-mobile-url', hero.coverImageMobile || '');

  // Hero Overlay & Hide Content
  const opacity = hero.overlayOpacity !== undefined ? hero.overlayOpacity : 70;
  setVal('hero-overlay-opacity', opacity);
  const opacityValEl = document.getElementById('hero-overlay-opacity-val');
  if (opacityValEl) opacityValEl.textContent = opacity + '%';
  syncColorField('hero-overlay-color', 'hero-overlay-color-hex', hero.overlayColor || '#000000');
  const hideContentCheck = document.getElementById('hero-hide-content');
  if (hideContentCheck) hideContentCheck.checked = !!hero.hideContent;

  // Video Section
  const vid = summitData.videoSection || {};
  setVal('video-title', vid.title);
  setVal('video-subtitle', vid.subtitle);
  setVal('video-youtube-id', vid.youtubeId);

  // Agenda Section
  const agenda = summitData.agenda || {};
  setVal('agenda-title-input', agenda.title);
  setVal('agenda-subtitle-input', agenda.subtitle);
  setVal('agenda-categories-input', (agenda.categories || []).join(', '));
  renderAgendaItemsList();

  // Speakers Section
  const spk = summitData.speakers || {};
  setVal('speakers-title-input', spk.title);
  setVal('speakers-subtitle-input', spk.subtitle);
  renderSpeakersList();

  // Broadcast Section
  const bc = summitData.broadcast || {};
  setVal('broadcast-title-input', bc.title);
  setVal('broadcast-subtitle-input', bc.subtitle);
  setVal('broadcast-bg-type', bc.bgType || 'gradient');
  syncColorField('broadcast-bg-color', 'broadcast-bg-color-hex', bc.bgColor || '#001040');
  setVal('broadcast-bg-gradient', bc.bgGradient || 'radial-gradient(ellipse at 65% 50%, #004ecc 0%, #00237d 45%, #001040 85%, #000824 100%)');
  setImagePreview('broadcast-bg-img-preview', bc.bgCustomImage || '');
  if (typeof handleBroadcastBgTypeChange === 'function') handleBroadcastBgTypeChange();
  renderBroadcastList();

  // SEO & Metadatos Panel
  const seo = summitData.seo || {};
  setVal('seo-title', seo.metaTitle || seo.title || '');
  setVal('seo-description', seo.metaDescription || seo.description || '');
  setVal('seo-keywords', seo.keywords || '');
  setVal('seo-robots', seo.metaRobots || seo.robots || 'noindex, nofollow');
  setVal('seo-canonical', seo.canonicalUrl || seo.canonical || '');
  setVal('seo-og-title', seo.ogTitle || '');
  setVal('seo-og-url', seo.ogUrl || seo.canonicalUrl || seo.canonical || '');
  setVal('seo-og-description', seo.ogDescription || '');
  setVal('seo-og-type', seo.ogType || 'website');
  setVal('seo-twitter-card', seo.twitterCard || 'summary_large_image');
  setImagePreview('seo-og-img-preview', seo.ogImage || '/uploads/1792104657106-hero-optimized.jpg');
  if (typeof updateSeoCharCounts === 'function') updateSeoCharCounts();
  if (typeof updateSeoSocialPreview === 'function') updateSeoSocialPreview();

  // FAQ Section
  const faq = summitData.faq || {};
  setVal('faq-title-input', faq.title);
  setVal('faq-subtitle-input', faq.subtitle);
  renderFaqList();

  // Sponsors Section
  const sp = summitData.sponsors || {};
  const spEnabled = document.getElementById('sponsors-enabled');
  if (spEnabled) spEnabled.checked = sp.enabled !== undefined ? !!sp.enabled : true;
  setVal('sponsors-label', sp.label || 'PATROCINADORES Y ALIADOS');
  setVal('sponsors-subtitle', sp.subtitle || '');
  setImagePreview('sponsors-img-preview', sp.imageDesktop || '/uploads/logos-sitioesg.png');
  setVal('sponsors-img-url', sp.imageDesktop || '');
  setImagePreview('sponsors-img-mobile-preview', sp.imageMobile || sp.imageDesktop || '/uploads/logos-sitioesg.png');
  setVal('sponsors-img-mobile-url', sp.imageMobile || '');

  // Footer
  const footer = summitData.footer || {};
  setVal('footer-description-input', footer.description);
  setVal('footer-copyright-input', footer.copyright);
  setVal('footer-email-input', footer.contactEmail);
  renderSocialsList();

  // Movable Sections Order
  renderReorderList();
}

/**
 * 3. EXTRACT FORMS INTO STATE
 */
function extractAllFormData() {
  if (!summitData) return;

  // Appearance
  summitData.appearance = summitData.appearance || {};
  summitData.appearance.eventTitle = getVal('app-event-title');
  summitData.appearance.fonts = {
    moduleTitleFont: getVal('app-font-module'),
    talkTitleFont: getVal('app-font-talk'),
    bodyFont: getVal('app-font-body')
  };
  summitData.appearance.colors = {
    moduleTitleColor: getVal('color-module-title'),
    talkTitleColor: getVal('color-talk-title'),
    descriptionColor: getVal('color-desc'),
    primaryColor: getVal('color-primary'),
    primaryHover: shadeColor(getVal('color-primary'), -15),
    accentColor: getVal('color-accent'),
    backgroundColor: getVal('color-bg'),
    headerBg: getVal('color-header-bg'),
    footerBg: getVal('color-footer-bg'),
    footerTextColor: '#94a3b8'
  };
  summitData.appearance.sectionBgs = {
    header: getVal('color-sec-header'),
    hero: getVal('color-sec-hero'),
    video: getVal('color-sec-video'),
    agenda: getVal('color-sec-agenda'),
    speakers: getVal('color-sec-speakers'),
    broadcast: getVal('color-sec-broadcast'),
    faq: getVal('color-sec-faq'),
    footer: getVal('color-sec-footer'),
    sponsors: getVal('color-sec-sponsors')
  };
  summitData.appearance.customCss = getVal('app-custom-css');

  // Movable Sections Order
  summitData.sectionOrder = summitData.sectionOrder || ['sponsors', 'agenda', 'speakers', 'broadcast', 'video'];

  // Sponsors
  summitData.sponsors = summitData.sponsors || {};
  summitData.sponsors.enabled = !!document.getElementById('sponsors-enabled')?.checked;
  summitData.sponsors.label = getVal('sponsors-label');
  summitData.sponsors.subtitle = getVal('sponsors-subtitle');
  summitData.sponsors.imageDesktop = document.getElementById('sponsors-img-preview')?.getAttribute('src') || summitData.sponsors.imageDesktop || '/uploads/logos-sitioesg.png';
  summitData.sponsors.imageMobile = document.getElementById('sponsors-img-mobile-preview')?.getAttribute('src') || summitData.sponsors.imageMobile || summitData.sponsors.imageDesktop || '/uploads/logos-sitioesg.png';

  // Header CTA
  summitData.header.cta = {
    label: getVal('header-cta-label'),
    url: getVal('header-cta-url')
  };

  // Hero
  summitData.hero = summitData.hero || {};
  summitData.hero.badge = getVal('hero-badge');
  summitData.hero.title = getVal('hero-title');
  summitData.hero.subtitle = getVal('hero-subtitle');
  summitData.hero.ctaPrimary = {
    label: getVal('hero-cta-pri-label'),
    anchor: getVal('hero-cta-pri-anchor')
  };
  summitData.hero.ctaSecondary = {
    label: getVal('hero-cta-sec-label'),
    anchor: getVal('hero-cta-sec-anchor')
  };
  summitData.hero.coverImage = document.getElementById('hero-cover-preview')?.getAttribute('src') || summitData.hero.coverImage;
  summitData.hero.coverImageMobile = document.getElementById('hero-cover-mobile-preview')?.getAttribute('src') || summitData.hero.coverImageMobile || summitData.hero.coverImage;
  summitData.hero.overlayOpacity = parseInt(getVal('hero-overlay-opacity') || '70', 10);
  summitData.hero.overlayColor = getVal('hero-overlay-color');
  summitData.hero.hideContent = !!document.getElementById('hero-hide-content')?.checked;

  // Video
  summitData.videoSection = summitData.videoSection || {};
  summitData.videoSection.title = getVal('video-title');
  summitData.videoSection.subtitle = getVal('video-subtitle');
  summitData.videoSection.youtubeId = getVal('video-youtube-id');

  // Agenda
  summitData.agenda = summitData.agenda || {};
  summitData.agenda.title = getVal('agenda-title-input');
  summitData.agenda.subtitle = getVal('agenda-subtitle-input');
  const catInput = getVal('agenda-categories-input');
  summitData.agenda.categories = catInput ? catInput.split(',').map(s => s.trim()).filter(Boolean) : ['Todas'];

  // Speakers
  summitData.speakers = summitData.speakers || {};
  summitData.speakers.title = getVal('speakers-title-input');
  summitData.speakers.subtitle = getVal('speakers-subtitle-input');

  // Broadcast
  summitData.broadcast = summitData.broadcast || {};
  summitData.broadcast.title = getVal('broadcast-title-input');
  summitData.broadcast.subtitle = getVal('broadcast-subtitle-input');
  summitData.broadcast.bgType = getVal('broadcast-bg-type') || 'gradient';
  summitData.broadcast.bgColor = getVal('broadcast-bg-color') || '#001040';
  summitData.broadcast.bgGradient = getVal('broadcast-bg-gradient') || 'radial-gradient(ellipse at 65% 50%, #004ecc 0%, #00237d 45%, #001040 85%, #000824 100%)';
  summitData.broadcast.bgCustomImage = document.getElementById('broadcast-bg-img-preview')?.getAttribute('src') || '';

  // SEO & Metadatos
  summitData.seo = {
    metaTitle: getVal('seo-title'),
    metaDescription: getVal('seo-description'),
    keywords: getVal('seo-keywords'),
    metaRobots: getVal('seo-robots') || 'noindex, nofollow',
    canonicalUrl: getVal('seo-canonical'),
    ogTitle: getVal('seo-og-title') || getVal('seo-title'),
    ogDescription: getVal('seo-og-description') || getVal('seo-description'),
    ogImage: document.getElementById('seo-og-img-preview')?.getAttribute('src') || summitData.seo?.ogImage || '/uploads/1792104657106-hero-optimized.jpg',
    ogUrl: getVal('seo-og-url') || getVal('seo-canonical'),
    ogType: getVal('seo-og-type') || 'website',
    twitterCard: getVal('seo-twitter-card') || 'summary_large_image',
    twitterTitle: getVal('seo-og-title') || getVal('seo-title'),
    twitterDescription: getVal('seo-og-description') || getVal('seo-description'),
    twitterImage: document.getElementById('seo-og-img-preview')?.getAttribute('src') || summitData.seo?.ogImage || '/uploads/1792104657106-hero-optimized.jpg'
  };

  // FAQ
  summitData.faq = summitData.faq || {};
  summitData.faq.title = getVal('faq-title-input');
  summitData.faq.subtitle = getVal('faq-subtitle-input');

  // Footer
  summitData.footer = summitData.footer || {};
  summitData.footer.description = getVal('footer-description-input');
  summitData.footer.copyright = getVal('footer-copyright-input');
  summitData.footer.contactEmail = getVal('footer-email-input');
}

/**
 * 4. HEADER NAVIGATION CRUD
 */
function renderNavItemsList() {
  const container = document.getElementById('nav-items-list');
  if (!container) return;

  const items = summitData?.header?.navigation || [];
  container.innerHTML = items.map((item, idx) => `
    <div class="item-row-card">
      <div class="item-info">
        <span style="font-weight:700; color:#94a3b8; width:20px;">${idx + 1}</span>
        <div class="item-details">
          <h4>${escapeHtml(item.label)}</h4>
          <p>Ancla: <code>${escapeHtml(item.anchor)}</code></p>
        </div>
      </div>
      <div class="item-actions">
        <button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="editNavItem(${idx})">Editar</button>
        <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteNavItem(${idx})">Eliminar</button>
      </div>
    </div>
  `).join('');
}

window.openAddNavModal = function() {
  currentEditingType = 'nav';
  currentEditingItem = -1;
  setVal('modal-nav-label', '');
  setVal('modal-nav-anchor', '#');
  openDialog('admin-nav-modal');
};

window.editNavItem = function(idx) {
  currentEditingType = 'nav';
  currentEditingItem = idx;
  const item = summitData.header.navigation[idx];
  setVal('modal-nav-label', item.label);
  setVal('modal-nav-anchor', item.anchor);
  openDialog('admin-nav-modal');
};

window.deleteNavItem = function(idx) {
  if (confirm('¿Eliminar este enlace del menú de navegación?')) {
    summitData.header.navigation.splice(idx, 1);
    renderNavItemsList();
  }
};

window.saveNavItem = function() {
  const label = getVal('modal-nav-label');
  const anchor = getVal('modal-nav-anchor');
  if (!label || !anchor) {
    alert('Ingresa el texto y ancla del menú');
    return;
  }

  if (!summitData.header.navigation) summitData.header.navigation = [];

  if (currentEditingItem === -1) {
    summitData.header.navigation.push({
      id: 'nav-' + Date.now(),
      label,
      anchor
    });
  } else {
    summitData.header.navigation[currentEditingItem].label = label;
    summitData.header.navigation[currentEditingItem].anchor = anchor;
  }

  closeDialog('admin-nav-modal');
  renderNavItemsList();
};

/**
 * 5. AGENDA (TIMELINE) CRUD
 */
function renderAgendaItemsList() {
  const container = document.getElementById('agenda-items-list');
  if (!container) return;

  const items = summitData?.agenda?.items || [];
  container.innerHTML = items.map((item, idx) => {
    const spk = Array.isArray(item.speakers) ? item.speakers.join(', ') : item.speakers;
    return `
      <div class="item-row-card">
        <div class="item-info">
          <img src="${item.image || '/uploads/agenda-1.jpg'}" class="item-thumb-sm" alt="Foto">
          <div class="item-details">
            <h4>${escapeHtml(item.title)}</h4>
            <p><strong>${escapeHtml(item.time)}</strong> | ${escapeHtml(item.category || 'General')} | Ponentes: ${escapeHtml(spk || 'Sin asignar')}</p>
          </div>
        </div>
        <div class="item-actions">
          <button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="editAgendaItem(${idx})">Editar</button>
          <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteAgendaItem(${idx})">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

window.openAddAgendaModal = function() {
  currentEditingType = 'agenda';
  currentEditingItem = -1;
  setVal('modal-agenda-title', '');
  setVal('modal-agenda-time', '09:00 - 10:15 hrs');
  setVal('modal-agenda-category', 'Inteligencia Artificial');
  setVal('modal-agenda-desc', '');
  setVal('modal-agenda-speakers', '');
  setVal('modal-agenda-moderators', '');
  setImagePreview('modal-agenda-img-preview', '/uploads/agenda-1.jpg');
  setVal('modal-agenda-img-url', '');
  openDialog('admin-agenda-modal');
};

window.editAgendaItem = function(idx) {
  currentEditingType = 'agenda';
  currentEditingItem = idx;
  const item = summitData.agenda.items[idx];
  setVal('modal-agenda-title', item.title);
  setVal('modal-agenda-time', item.time);
  setVal('modal-agenda-category', item.category);
  setVal('modal-agenda-desc', item.description || '');
  setVal('modal-agenda-speakers', Array.isArray(item.speakers) ? item.speakers.join(', ') : (item.speakers || ''));
  setVal('modal-agenda-moderators', Array.isArray(item.moderators) ? item.moderators.join(', ') : (item.moderators || ''));
  setImagePreview('modal-agenda-img-preview', item.image || '/uploads/agenda-1.jpg');
  setVal('modal-agenda-img-url', item.image || '');
  openDialog('admin-agenda-modal');
};

window.deleteAgendaItem = function(idx) {
  if (confirm('¿Eliminar esta ponencia de la agenda?')) {
    summitData.agenda.items.splice(idx, 1);
    renderAgendaItemsList();
  }
};

window.saveAgendaItem = function() {
  const title = getVal('modal-agenda-title');
  const time = getVal('modal-agenda-time');
  if (!title || !time) {
    alert('Por favor ingresa el título y la hora de la ponencia');
    return;
  }

  const speakersStr = getVal('modal-agenda-speakers');
  const moderatorsStr = getVal('modal-agenda-moderators');

  const payload = {
    id: currentEditingItem === -1 ? 'agenda-' + Date.now() : summitData.agenda.items[currentEditingItem].id,
    title,
    time,
    category: getVal('modal-agenda-category'),
    description: getVal('modal-agenda-desc'),
    speakers: speakersStr ? speakersStr.split(',').map(s => s.trim()).filter(Boolean) : [],
    moderators: moderatorsStr ? moderatorsStr.split(',').map(s => s.trim()).filter(Boolean) : [],
    image: getVal('modal-agenda-img-url') || document.getElementById('modal-agenda-img-preview')?.getAttribute('src') || '/uploads/agenda-1.jpg'
  };

  if (!summitData.agenda.items) summitData.agenda.items = [];

  if (currentEditingItem === -1) {
    summitData.agenda.items.push(payload);
  } else {
    summitData.agenda.items[currentEditingItem] = payload;
  }

  closeDialog('admin-agenda-modal');
  renderAgendaItemsList();
};

/**
 * 6. SPEAKERS CRUD
 */
function renderSpeakersList() {
  const container = document.getElementById('speakers-items-list');
  if (!container) return;

  const items = summitData?.speakers?.items || [];
  container.innerHTML = items.map((spk, idx) => `
    <div class="item-row-card">
      <div class="item-info">
        <img src="${spk.image || '/uploads/speaker-1.jpg'}" class="item-thumb-sm" style="border-radius:50%;" alt="Avatar">
        <div class="item-details">
          <h4>${escapeHtml(spk.name)}</h4>
          <p>${escapeHtml(spk.role || '')} • ${escapeHtml(spk.company || '')} (${escapeHtml(spk.badge || 'Speaker')})</p>
        </div>
      </div>
      <div class="item-actions">
        <button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="editSpeakerItem(${idx})">Editar</button>
        <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteSpeakerItem(${idx})">Eliminar</button>
      </div>
    </div>
  `).join('');
}

window.openAddSpeakerModal = function() {
  currentEditingType = 'speaker';
  currentEditingItem = -1;
  setVal('modal-speaker-name', '');
  setVal('modal-speaker-role', '');
  setVal('modal-speaker-company', '');
  setVal('modal-speaker-badge', 'Keynote Speaker');
  setVal('modal-speaker-bio', '');
  setImagePreview('modal-speaker-img-preview', '/uploads/speaker-1.jpg');
  setVal('modal-speaker-img-url', '');
  openDialog('admin-speaker-modal');
};

window.editSpeakerItem = function(idx) {
  currentEditingType = 'speaker';
  currentEditingItem = idx;
  const spk = summitData.speakers.items[idx];
  setVal('modal-speaker-name', spk.name);
  setVal('modal-speaker-role', spk.role);
  setVal('modal-speaker-company', spk.company);
  setVal('modal-speaker-badge', spk.badge || 'Speaker');
  setVal('modal-speaker-bio', spk.bio || '');
  setImagePreview('modal-speaker-img-preview', spk.image || '/uploads/speaker-1.jpg');
  setVal('modal-speaker-img-url', spk.image || '');
  openDialog('admin-speaker-modal');
};

window.deleteSpeakerItem = function(idx) {
  if (confirm('¿Eliminar este ponente?')) {
    summitData.speakers.items.splice(idx, 1);
    renderSpeakersList();
  }
};

window.saveSpeakerItem = function() {
  const name = getVal('modal-speaker-name');
  if (!name) {
    alert('Ingresa el nombre del ponente');
    return;
  }

  const payload = {
    id: currentEditingItem === -1 ? 'spk-' + Date.now() : summitData.speakers.items[currentEditingItem].id,
    name,
    role: getVal('modal-speaker-role'),
    company: getVal('modal-speaker-company'),
    badge: getVal('modal-speaker-badge'),
    bio: getVal('modal-speaker-bio'),
    image: getVal('modal-speaker-img-url') || document.getElementById('modal-speaker-img-preview')?.getAttribute('src') || '/uploads/speaker-1.jpg'
  };

  if (!summitData.speakers.items) summitData.speakers.items = [];

  if (currentEditingItem === -1) {
    summitData.speakers.items.push(payload);
  } else {
    summitData.speakers.items[currentEditingItem] = payload;
  }

  closeDialog('admin-speaker-modal');
  renderSpeakersList();
};

/**
 * 7. BROADCAST CRUD
 */
function renderBroadcastList() {
  const container = document.getElementById('broadcast-items-list');
  if (!container) return;

  const items = summitData?.broadcast?.items || [];
  container.innerHTML = items.map((item, idx) => `
    <div class="item-row-card">
      <div class="item-info">
        <img src="${item.image || '/uploads/broadcast-1.jpg'}" class="item-thumb-sm" alt="Thumbnail">
        <div class="item-details">
          <h4>${escapeHtml(item.title)}</h4>
          <p><strong>${escapeHtml(item.time)}</strong> | YouTube ID: <code>${escapeHtml(item.youtubeId)}</code> | Ponentes: ${escapeHtml(item.speakers || '-')}</p>
        </div>
      </div>
      <div class="item-actions">
        <button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="testBroadcastModal('${escapeHtml(item.youtubeId)}')">▶ Probar Live</button>
        <button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="editBroadcastItem(${idx})">Editar</button>
        <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteBroadcastItem(${idx})">Eliminar</button>
      </div>
    </div>
  `).join('');
}

window.testBroadcastModal = function(youtubeId) {
  const modal = document.getElementById('admin-video-test-modal');
  const iframe = document.getElementById('admin-test-iframe');
  if (modal && iframe) {
    iframe.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`;
    openDialog('admin-video-test-modal');
  }
};

window.openAddBroadcastModal = function() {
  currentEditingType = 'broadcast';
  currentEditingItem = -1;
  setVal('modal-bc-title', '');
  setVal('modal-bc-time', 'En Vivo • 10:00 hrs');
  setVal('modal-bc-youtube', '5qap5aO4i9A');
  setVal('modal-bc-desc', '');
  setVal('modal-bc-speakers', '');
  setVal('modal-bc-moderators', '');
  setImagePreview('modal-bc-img-preview', '/uploads/broadcast-1.jpg');
  setVal('modal-bc-img-url', '');
  openDialog('admin-broadcast-modal');
};

window.editBroadcastItem = function(idx) {
  currentEditingType = 'broadcast';
  currentEditingItem = idx;
  const item = summitData.broadcast.items[idx];
  setVal('modal-bc-title', item.title);
  setVal('modal-bc-time', item.time);
  setVal('modal-bc-youtube', item.youtubeId);
  setVal('modal-bc-desc', item.description || '');
  setVal('modal-bc-speakers', item.speakers || '');
  setVal('modal-bc-moderators', item.moderators || '');
  setImagePreview('modal-bc-img-preview', item.image || '/uploads/broadcast-1.jpg');
  setVal('modal-bc-img-url', item.image || '');
  openDialog('admin-broadcast-modal');
};

window.deleteBroadcastItem = function(idx) {
  if (confirm('¿Eliminar esta ponencia de la sala de transmisión?')) {
    summitData.broadcast.items.splice(idx, 1);
    renderBroadcastList();
  }
};

window.saveBroadcastItem = function() {
  const title = getVal('modal-bc-title');
  const youtubeId = getVal('modal-bc-youtube');
  if (!title || !youtubeId) {
    alert('Ingresa el título y el ID de YouTube de la transmisión');
    return;
  }

  const payload = {
    id: currentEditingItem === -1 ? 'bc-' + Date.now() : summitData.broadcast.items[currentEditingItem].id,
    title,
    time: getVal('modal-bc-time'),
    youtubeId: cleanYoutubeId(youtubeId),
    description: getVal('modal-bc-desc'),
    speakers: getVal('modal-bc-speakers'),
    moderators: getVal('modal-bc-moderators'),
    image: getVal('modal-bc-img-url') || document.getElementById('modal-bc-img-preview')?.getAttribute('src') || '/uploads/broadcast-1.jpg'
  };

  if (!summitData.broadcast.items) summitData.broadcast.items = [];

  if (currentEditingItem === -1) {
    summitData.broadcast.items.push(payload);
  } else {
    summitData.broadcast.items[currentEditingItem] = payload;
  }

  closeDialog('admin-broadcast-modal');
  renderBroadcastList();
};

function cleanYoutubeId(input) {
  if (!input) return '';
  const str = input.trim();
  // Support full youtube URLs or raw IDs
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|live\/))([\w-]{11})/);
  return match ? match[1] : str;
}

/**
 * 8. FAQ CRUD
 */
function renderFaqList() {
  const container = document.getElementById('faq-items-list');
  if (!container) return;

  const items = summitData?.faq?.items || [];
  container.innerHTML = items.map((item, idx) => `
    <div class="item-row-card">
      <div class="item-info">
        <div class="item-details">
          <h4>${escapeHtml(item.question)}</h4>
          <p>${escapeHtml(item.answer)}</p>
        </div>
      </div>
      <div class="item-actions">
        <button class="admin-btn admin-btn-secondary admin-btn-sm" onclick="editFaqItem(${idx})">Editar</button>
        <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteFaqItem(${idx})">Eliminar</button>
      </div>
    </div>
  `).join('');
}

window.openAddFaqModal = function() {
  currentEditingType = 'faq';
  currentEditingItem = -1;
  setVal('modal-faq-question', '');
  setVal('modal-faq-answer', '');
  openDialog('admin-faq-modal');
};

window.editFaqItem = function(idx) {
  currentEditingType = 'faq';
  currentEditingItem = idx;
  const item = summitData.faq.items[idx];
  setVal('modal-faq-question', item.question);
  setVal('modal-faq-answer', item.answer);
  openDialog('admin-faq-modal');
};

window.deleteFaqItem = function(idx) {
  if (confirm('¿Eliminar esta pregunta frecuente?')) {
    summitData.faq.items.splice(idx, 1);
    renderFaqList();
  }
};

window.saveFaqItem = function() {
  const q = getVal('modal-faq-question');
  const a = getVal('modal-faq-answer');
  if (!q || !a) {
    alert('Ingresa la pregunta y su respuesta');
    return;
  }

  const payload = {
    id: currentEditingItem === -1 ? 'faq-' + Date.now() : summitData.faq.items[currentEditingItem].id,
    question: q,
    answer: a
  };

  if (!summitData.faq.items) summitData.faq.items = [];

  if (currentEditingItem === -1) {
    summitData.faq.items.push(payload);
  } else {
    summitData.faq.items[currentEditingItem] = payload;
  }

  closeDialog('admin-faq-modal');
  renderFaqList();
};

window.insertLinkIntoFaqAnswer = function() {
  const textarea = document.getElementById('modal-faq-answer');
  if (!textarea) return;

  const url = prompt('Ingresa la URL o ancla interna (ej: #agenda, #broadcast o https://sitio.com):', '#agenda');
  if (!url) return;
  const text = prompt('Texto visible del enlace:', 'aquí');
  if (!text) return;

  const snippet = `[${text}](${url})`;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  textarea.value = val.substring(0, start) + snippet + val.substring(end);
  textarea.focus();
};

/**
 * 9. FOOTER & SOCIALS
 */
function renderSocialsList() {
  const container = document.getElementById('footer-socials-list');
  if (!container) return;

  const socials = summitData?.footer?.socials || [];
  container.innerHTML = socials.map((s, idx) => `
    <div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.5rem;">
      <input type="text" class="form-input" style="width:140px;" value="${escapeHtml(s.name)}" onchange="updateSocial(${idx}, 'name', this.value)">
      <input type="text" class="form-input" style="flex:1;" value="${escapeHtml(s.url)}" onchange="updateSocial(${idx}, 'url', this.value)">
      <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="removeSocial(${idx})">&times;</button>
    </div>
  `).join('');
}

window.addSocialNetwork = function() {
  if (!summitData.footer.socials) summitData.footer.socials = [];
  summitData.footer.socials.push({ name: 'Nueva Red', url: 'https://' });
  renderSocialsList();
};

window.removeSocial = function(idx) {
  summitData.footer.socials.splice(idx, 1);
  renderSocialsList();
};

window.updateSocial = function(idx, field, val) {
  if (summitData.footer.socials[idx]) {
    summitData.footer.socials[idx][field] = val;
  }
};

/**
 * 10. ADVANCED IMAGE UPLOAD, URL LINKING & OPTIMIZATION (1920x938 CHECK)
 */
window.handleImageUrlInput = function(inputEl, previewImgId, feedbackId) {
  const url = (inputEl.value || '').trim();
  const previewImg = document.getElementById(previewImgId);
  const feedbackEl = feedbackId ? document.getElementById(feedbackId) : null;
  if (!url) return;

  if (previewImg) {
    previewImg.src = url;
    // Auto-update model if static preview id
    if (summitData) {
      if (previewImg.id === 'header-logo-preview') summitData.appearance.headerLogo = url;
      if (previewImg.id === 'footer-logo-preview') summitData.appearance.footerLogo = url;
      if (previewImg.id === 'hero-cover-preview') summitData.hero.coverImage = url;
      if (previewImg.id === 'hero-cover-mobile-preview') summitData.hero.coverImageMobile = url;
      if (previewImg.id === 'sponsors-img-preview') summitData.sponsors.imageDesktop = url;
      if (previewImg.id === 'sponsors-img-mobile-preview') summitData.sponsors.imageMobile = url;
    }
  }

  if (feedbackEl) {
    feedbackEl.className = 'upload-feedback valid';
    feedbackEl.textContent = '✓ URL de imagen externa vinculada';
  }
};

window.handleImageUpload = async function(fileInput, previewImgId, feedbackId, targetDimensions, textUrlInputId) {
  const file = fileInput.files[0];
  if (!file) return;

  const feedbackEl = feedbackId ? document.getElementById(feedbackId) : null;
  const previewImg = document.getElementById(previewImgId);

  // Read file into image object to check natural dimensions
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    const img = new Image();
    img.onload = async () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      let uploadedUrl = null;
      if (targetDimensions === '1920x938') {
        if (w === 1920 && h === 938) {
          if (feedbackEl) {
            feedbackEl.className = 'upload-feedback valid';
            feedbackEl.textContent = '✓ Dimensiones exactas verificadas: 1920 x 938 px';
          }
          uploadedUrl = await uploadImageToServer(file.name, dataUrl, previewImg);
        } else {
          // Offer automated canvas crop to 1920x938
          const ratio = (w / h).toFixed(2);
          if (feedbackEl) {
            feedbackEl.className = 'upload-feedback warning';
            feedbackEl.innerHTML = `⚠️ Dimensiones detectadas: ${w}x${h} px. Optimizando y ajustando a 1920x938 px...`;
          }
          const optimizedDataUrl = cropAndOptimizeImage(img, 1920, 938);
          uploadedUrl = await uploadImageToServer('hero-optimized.jpg', optimizedDataUrl, previewImg);
          if (feedbackEl) {
            feedbackEl.className = 'upload-feedback valid';
            feedbackEl.textContent = '✓ Imagen adaptada y optimizada para web (1920 x 938 px)';
          }
        }
      } else {
        // Standard upload
        uploadedUrl = await uploadImageToServer(file.name, dataUrl, previewImg);
        if (feedbackEl) {
          feedbackEl.className = 'upload-feedback valid';
          feedbackEl.textContent = `✓ Imagen cargada (${w} x ${h} px)`;
        }
      }

      if (uploadedUrl && textUrlInputId) {
        setVal(textUrlInputId, uploadedUrl);
      }
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
};

// Canvas Cropper & Web Optimizer
function cropAndOptimizeImage(image, targetW, targetH) {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  // Cover aspect ratio algorithm
  const srcRatio = image.width / image.height;
  const targetRatio = targetW / targetH;
  let renderW, renderH, offsetX, offsetY;

  if (srcRatio > targetRatio) {
    renderH = targetH;
    renderW = image.width * (targetH / image.height);
    offsetX = (targetW - renderW) / 2;
    offsetY = 0;
  } else {
    renderW = targetW;
    renderH = image.height * (targetW / image.width);
    offsetX = 0;
    offsetY = (targetH - renderH) / 2;
  }

  ctx.drawImage(image, offsetX, offsetY, renderW, renderH);
  return canvas.toDataURL('image/jpeg', 0.88); // 88% quality web-optimized
}

async function uploadImageToServer(filename, dataUrl, previewImg) {
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, dataUrl })
    });
    const result = await res.json();
    if (result.success && result.url) {
      if (previewImg) previewImg.src = result.url;
      // Auto-update appropriate data model field
      if (previewImg.id === 'header-logo-preview') summitData.appearance.headerLogo = result.url;
      if (previewImg.id === 'footer-logo-preview') summitData.appearance.footerLogo = result.url;
      if (previewImg.id === 'hero-cover-preview') summitData.hero.coverImage = result.url;
      showToast('Imagen subida con éxito', 'success');
      return result.url;
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    console.error(err);
    showToast(err && err.message ? `Error al subir: ${err.message}` : 'Error al subir imagen al servidor', 'error');
    // Fallback: keep local dataUrl for preview
    if (previewImg) previewImg.src = dataUrl;
    return dataUrl;
  }
}

/**
 * 11. SIDEBAR & NAVIGATION SETUP
 */
function setupSidebarNavigation() {
  const tabButtons = document.querySelectorAll('.sidebar-tab-btn');
  const panels = document.querySelectorAll('.admin-panel');
  const pageTitle = document.getElementById('current-page-title');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.target;
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');

      if (pageTitle) pageTitle.textContent = btn.querySelector('.tab-label')?.textContent || 'Configuración';
    });
  });
}

function setupGlobalActions() {
  // Save All
  document.getElementById('save-all-btn')?.addEventListener('click', saveAllData);

  // Live Preview Modal
  document.getElementById('open-preview-btn')?.addEventListener('click', () => {
    saveAllData();
    const modal = document.getElementById('live-preview-modal');
    const iframe = document.getElementById('live-preview-iframe');
    if (modal && iframe) {
      iframe.src = '/?' + Date.now();
      openDialog('live-preview-modal');
    }
  });

  // Export JSON
  document.getElementById('export-json-btn')?.addEventListener('click', () => {
    extractAllFormData();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(summitData, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `summit-config-${Date.now()}.json`;
    a.click();
  });

  // Import JSON
  const importInput = document.getElementById('import-json-input');
  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          summitData = parsed;
          populateAllForms();
          await saveAllData();
          showToast('Configuración importada exitosamente', 'success');
        } catch (err) {
          alert('El archivo no contiene un JSON válido: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }
}

/**
 * UTILS & HELPERS
 */
function syncColorField(pickerId, hexId, defaultVal) {
  const picker = document.getElementById(pickerId);
  const hex = document.getElementById(hexId);
  if (!picker || !hex) return;

  picker.value = defaultVal;
  hex.value = defaultVal;

  picker.addEventListener('input', () => { hex.value = picker.value; });
  hex.addEventListener('input', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hex.value)) {
      picker.value = hex.value;
    }
  });
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val !== undefined && val !== null ? val : '';
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setImagePreview(imgId, src) {
  const img = document.getElementById(imgId);
  if (img && src) img.src = src;
}

function openDialog(dialogId) {
  const d = document.getElementById(dialogId);
  if (!d) return;
  if (typeof d.showModal === 'function') {
    d.showModal();
  } else {
    d.setAttribute('open', '');
  }
}

window.closeDialog = function(dialogId) {
  const d = document.getElementById(dialogId);
  if (!d) return;
  if (typeof d.close === 'function') {
    d.close();
  } else {
    d.removeAttribute('open');
  }

  // If testing video, stop playback
  if (dialogId === 'admin-video-test-modal') {
    const iframe = document.getElementById('admin-test-iframe');
    if (iframe) iframe.src = '';
  }
};

function showToast(msg, type = 'success') {
  const toast = document.getElementById('admin-toast');
  if (!toast) return;

  toast.textContent = msg;
  toast.className = `toast-notice ${type} show`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

/**
 * SEO & Social Preview Helpers
 */
window.updateSeoCharCounts = function() {
  const title = getVal('seo-title') || '';
  const desc = getVal('seo-description') || '';
  
  const titleCountEl = document.getElementById('seo-title-count');
  const descCountEl = document.getElementById('seo-desc-count');
  
  if (titleCountEl) {
    titleCountEl.textContent = `${title.length} / 60 caracteres`;
    titleCountEl.style.color = (title.length >= 40 && title.length <= 60) ? '#10b981' : (title.length > 60 ? '#ef4444' : '#94a3b8');
  }
  
  if (descCountEl) {
    descCountEl.textContent = `${desc.length} / 160 caracteres`;
    descCountEl.style.color = (desc.length >= 120 && desc.length <= 160) ? '#10b981' : (desc.length > 160 ? '#ef4444' : '#94a3b8');
  }

  // Live update Google preview
  const googleTitle = document.getElementById('seo-prev-google-title');
  const googleDesc = document.getElementById('seo-prev-google-desc');
  const googleUrl = document.getElementById('seo-prev-google-url');
  const canonical = getVal('seo-canonical') || 'https://expansion.mx/esgsummit';
  
  if (googleTitle) googleTitle.textContent = title || 'Summit Innovation 2026 | Cumbre Global de Tecnología';
  if (googleDesc) googleDesc.textContent = desc || 'La cumbre internacional más relevante de inteligencia artificial, transformación digital y sostenibilidad tecnológica. Regístrate gratis.';
  if (googleUrl) googleUrl.textContent = canonical;
};

window.updateSeoSocialPreview = function() {
  const ogTitle = getVal('seo-og-title') || getVal('seo-title') || 'Summit Innovation 2026';
  const ogDesc = getVal('seo-og-description') || getVal('seo-description') || 'Más de 40 líderes internacionales debatiendo sobre agentes autónomos, ciberseguridad y sustentabilidad.';
  const ogUrl = getVal('seo-og-url') || getVal('seo-canonical') || 'https://expansion.mx/esgsummit';
  const ogImgEl = document.getElementById('seo-og-img-preview');
  const ogImgSrc = ogImgEl?.getAttribute('src') || '/uploads/1792104657106-hero-optimized.jpg';

  let domain = 'EXPANSION.MX';
  try {
    const parsed = new URL(ogUrl);
    domain = parsed.hostname.toUpperCase();
  } catch (e) {}

  const socialDomain = document.getElementById('seo-prev-social-domain');
  const socialTitle = document.getElementById('seo-prev-social-title');
  const socialDesc = document.getElementById('seo-prev-social-desc');
  const socialImg = document.getElementById('seo-prev-social-img');

  if (socialDomain) socialDomain.textContent = domain;
  if (socialTitle) socialTitle.textContent = ogTitle;
  if (socialDesc) socialDesc.textContent = ogDesc;
  if (socialImg) socialImg.src = ogImgSrc;
};

/**
 * Broadcast Background Customizer Helpers
 */
window.handleBroadcastBgTypeChange = function() {
  const type = document.getElementById('broadcast-bg-type')?.value || 'gradient';
  const colorGroup = document.getElementById('broadcast-color-group');
  const gradientGroup = document.getElementById('broadcast-gradient-group');
  const imageGroup = document.getElementById('broadcast-image-group');

  if (colorGroup) colorGroup.style.display = (type === 'color' || type === 'gradient') ? 'block' : 'none';
  if (gradientGroup) gradientGroup.style.display = (type === 'gradient') ? 'block' : 'none';
  if (imageGroup) imageGroup.style.display = (type === 'image') ? 'block' : 'none';
};

window.setBroadcastGradientPreset = function(presetName) {
  const gradInput = document.getElementById('broadcast-bg-gradient');
  if (!gradInput) return;

  if (presetName === 'expansion') {
    gradInput.value = 'radial-gradient(ellipse at 65% 50%, #004ecc 0%, #00237d 45%, #001040 85%, #000824 100%)';
  } else if (presetName === 'neon') {
    gradInput.value = 'linear-gradient(135deg, #001f3f 0%, #003366 35%, #0074d9 75%, #001122 100%)';
  } else if (presetName === 'dark') {
    gradInput.value = 'radial-gradient(ellipse at 50% 50%, #1e293b 0%, #0f172a 60%, #020617 100%)';
  }
  showToast('Gradiente "' + presetName + '" aplicado', 'success');
};

function shadeColor(color, percent) {
  let R = parseInt(color.substring(1,3),16);
  let G = parseInt(color.substring(3,5),16);
  let B = parseInt(color.substring(5,7),16);

  R = parseInt(R * (100 + percent) / 100);
  G = parseInt(G * (100 + percent) / 100);
  B = parseInt(B * (100 + percent) / 100);

  R = (R<255)?R:255;  
  G = (G<255)?G:255;  
  B = (B<255)?B:255;  

  const RR = ((R.toString(16).length===1)?"0"+R.toString(16):R.toString(16));
  const GG = ((G.toString(16).length===1)?"0"+G.toString(16):G.toString(16));
  const BB = ((B.toString(16).length===1)?"0"+B.toString(16):B.toString(16));

  return "#"+RR+GG+BB;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * ========================================================
 * 11.5 SECTION REORDERING MANAGEMENT
 * ========================================================
 */
const SECTION_METADATA = {
  sponsors: { id: 'sponsors', name: 'Patrocinadores (Sponsors)', icon: '🤝', desc: 'Composición de marcas en Desktop y Mobile' },
  agenda: { id: 'agenda', name: 'Agenda (Timeline Zigzag)', icon: '📅', desc: 'Cronograma interactivo con punto animado y filtros' },
  speakers: { id: 'speakers', name: 'Ponentes (Speakers)', icon: '👥', desc: 'Grilla circular orgánica y drawer lateral de semblanza' },
  broadcast: { id: 'broadcast', name: 'Broadcast (Stage Carousel)', icon: '📡', desc: 'Stage principal cinematográfico y tarjetas flotantes 3D' },
  video: { id: 'video', name: 'Sección de Video Oficial', icon: '🎬', desc: 'Reproductor tráiler oficial de YouTube' }
};

function renderReorderList() {
  const container = document.getElementById('reorder-sections-list');
  if (!container) return;

  if (!summitData.sectionOrder || !Array.isArray(summitData.sectionOrder)) {
    summitData.sectionOrder = ['sponsors', 'agenda', 'speakers', 'broadcast', 'video'];
  }

  // Ensure all 5 keys exist in sectionOrder
  const validKeys = ['sponsors', 'agenda', 'speakers', 'broadcast', 'video'];
  validKeys.forEach(k => {
    if (!summitData.sectionOrder.includes(k)) summitData.sectionOrder.push(k);
  });

  container.innerHTML = summitData.sectionOrder.map((secKey, idx) => {
    const meta = SECTION_METADATA[secKey] || { name: secKey, icon: '📦', desc: 'Sección de contenido' };
    const posNumber = idx + 3; // header=1, hero=2, movable=3..7, faq=8, footer=9
    const isFirst = idx === 0;
    const isLast = idx === summitData.sectionOrder.length - 1;

    return `
      <div class="reorder-item-card" data-key="${secKey}">
        <div class="reorder-item-left">
          <div class="reorder-pos-badge">#${posNumber}</div>
          <div class="reorder-icon">${meta.icon}</div>
          <div class="reorder-title-wrap">
            <h4>${meta.name}</h4>
            <p>${meta.desc}</p>
          </div>
        </div>
        <div class="reorder-actions">
          <button class="reorder-btn" onclick="moveSectionUp(${idx})" ${isFirst ? 'disabled' : ''} title="Subir sección">
            <span>▲ Subir</span>
          </button>
          <button class="reorder-btn" onclick="moveSectionDown(${idx})" ${isLast ? 'disabled' : ''} title="Bajar sección">
            <span>▼ Bajar</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.moveSectionUp = function(idx) {
  if (!summitData?.sectionOrder || idx <= 0) return;
  const temp = summitData.sectionOrder[idx];
  summitData.sectionOrder[idx] = summitData.sectionOrder[idx - 1];
  summitData.sectionOrder[idx - 1] = temp;
  renderReorderList();
  showToast('Orden actualizado. Recuerda "Guardar Cambios".', 'success');
};

window.moveSectionDown = function(idx) {
  if (!summitData?.sectionOrder || idx >= summitData.sectionOrder.length - 1) return;
  const temp = summitData.sectionOrder[idx];
  summitData.sectionOrder[idx] = summitData.sectionOrder[idx + 1];
  summitData.sectionOrder[idx + 1] = temp;
  renderReorderList();
  showToast('Orden actualizado. Recuerda "Guardar Cambios".', 'success');
};

window.resetSectionOrder = function() {
  if (!summitData) return;
  summitData.sectionOrder = ['sponsors', 'agenda', 'speakers', 'broadcast', 'video'];
  renderReorderList();
  showToast('Orden predeterminado restaurado', 'success');
};

/**
 * ========================================================
 * 12. PRESET LOADER & WORDPRESS RAW HTML GENERATOR
 * ========================================================
 */

window.loadPreset = async function(presetName) {
  try {
    const res = await fetch('/api/preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: presetName })
    });
    const result = await res.json();
    if (result.success && result.data) {
      summitData = result.data;
      populateAllForms();
      showToast('¡Plantilla Expansión ESG Summit 2026 cargada con éxito!', 'success');
    } else {
      throw new Error(result.error || 'Error al cargar plantilla');
    }
  } catch (err) {
    console.error(err);
    showToast('Error al cargar plantilla: ' + err.message, 'error');
  }
};

window.resolveAssetUrl = function(url, prefixRaw) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  const prefix = (prefixRaw || '').trim();
  if (!prefix) return url;

  if (url.startsWith('/uploads/')) {
    const filename = url.replace('/uploads/', '');
    const hasPath = prefix.replace(/^https?:\/\/[^\/]+/, '').length > 0;
    
    if (prefix.endsWith('/uploads/') || prefix.endsWith('/uploads')) {
      const clean = prefix.replace(/\/+$/, '');
      return `${clean}/${filename}`;
    } else if (prefix.endsWith('/')) {
      return `${prefix}${filename}`;
    } else if (!hasPath) {
      return `${prefix}/uploads/${filename}`;
    } else {
      return `${prefix}/${filename}`;
    }
  }

  const cleanPath = url.startsWith('/') ? url.slice(1) : url;
  return prefix.endsWith('/') ? `${prefix}${cleanPath}` : `${prefix}/${cleanPath}`;
};

window.setWpAssetPrefixMode = function(mode) {
  const input = document.getElementById('wp-asset-prefix');
  if (!input) return;

  if (mode === 'current-cms') {
    // Current server origin + /uploads/
    input.value = `${window.location.origin}/uploads/`;
    showToast('Prefijo asignado al servidor actual del CMS', 'success');
  } else if (mode === 'static-folder') {
    input.value = 'https://expansion.mx/summit-assets/';
    showToast('Prefijo asignado a carpeta estática', 'success');
  } else if (mode === 'relative') {
    input.value = '';
    showToast('Rutas relativas locales (/uploads/)', 'success');
  }

  updateWpAssetPreview();
};

window.updateWpAssetPreview = function() {
  const input = document.getElementById('wp-asset-prefix');
  const previewSpan = document.getElementById('wp-sample-asset-url');
  if (!previewSpan) return;

  const prefix = input ? input.value : '';
  const sample = '/uploads/1792383743425-El-negocio-de-alimentar.png';
  previewSpan.textContent = window.resolveAssetUrl(sample, prefix);
};

window.openWpGeneratorModal = function() {
  const wpBtn = document.querySelector('.sidebar-tab-btn[data-target="panel-wordpress"]');
  if (wpBtn) {
    wpBtn.click();
  }

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const warnEl = document.getElementById('wp-localhost-warning');
  if (warnEl) warnEl.style.display = isLocal ? 'block' : 'none';

  const prefixInput = document.getElementById('wp-asset-prefix');
  if (prefixInput && !prefixInput.value) {
    if (!isLocal) {
      prefixInput.value = `${window.location.origin}/uploads/`;
    }
  }

  updateWpAssetPreview();
  compileAndGenerateWordPressHtml();
};

window.compileAndGenerateWordPressHtml = async function() {
  extractAllFormData();
  if (!summitData) return;

  const prefixRaw = (document.getElementById('wp-asset-prefix')?.value || '').trim();
  const includeHeader = document.getElementById('wp-opt-header')?.checked ?? true;
  const includeFooter = document.getElementById('wp-opt-footer')?.checked ?? true;
  const scopeCss = document.getElementById('wp-opt-scope-css')?.checked ?? true;
  const embedBase64 = !!document.getElementById('wp-opt-embed-base64')?.checked;

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const warnEl = document.getElementById('wp-localhost-warning');
  if (warnEl) warnEl.style.display = isLocal ? 'block' : 'none';

  // 1. Fetch base CSS from landing.css
  let baseCss = '';
  try {
    const cssRes = await fetch('/css/landing.css');
    baseCss = await cssRes.text();
  } catch (e) {
    console.warn('CSS fetch error, using inline fallback');
  }

  const app = summitData.appearance || {};
  const colors = app.colors || {};
  const fonts = app.fonts || {};
  const hero = summitData.hero || {};
  const spSec = summitData.sponsors || {};
  const spkSec = summitData.speakers || {};
  const bcSec = summitData.broadcast || {};
  const seoData = summitData.seo || {};

  // Pre-resolve assets (supports Base64 inlining or URL resolution)
  const assetCache = new Map();
  async function resolveAsset(url) {
    if (!url) return '';
    if (assetCache.has(url)) return assetCache.get(url);
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      assetCache.set(url, url);
      return url;
    }
    if (embedBase64 && url.startsWith('/uploads/')) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const blob = await res.blob();
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          assetCache.set(url, base64);
          return base64;
        }
      } catch (e) {
        console.warn('Error convirtiendo imagen a Base64:', url, e);
      }
    }
    const resolved = window.resolveAssetUrl(url, prefixRaw);
    assetCache.set(url, resolved);
    return resolved;
  }

  const allImages = [
    app.headerLogo, app.footerLogo,
    hero.coverImage, hero.coverImageMobile,
    spSec.imageDesktop, spSec.imageMobile,
    ...(summitData.agenda?.items || []).map(i => i.image),
    ...(spkSec.items || []).map(s => s.image),
    ...(bcSec.items || []).map(b => b.image),
    bcSec.bgCustomImage,
    seoData.ogImage, seoData.twitterImage
  ].filter(Boolean);

  await Promise.all(allImages.map(u => resolveAsset(u)));

  const mapAsset = (url) => assetCache.get(url) || window.resolveAssetUrl(url, prefixRaw);

  const fontModule = fonts.moduleTitleFont || 'Outfit';
  const fontTalk = fonts.talkTitleFont || 'Plus Jakarta Sans';
  const fontBody = fonts.bodyFont || 'Inter';

  const uniqueFonts = [...new Set([fontModule, fontTalk, fontBody])];
  const fontQuery = uniqueFonts.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`).join('&');

  // Parse markdown links for FAQs
  const parseLinks = (text) => {
    if (!text) return '';
    return escapeHtml(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
      const isInternal = url.startsWith('#');
      const target = isInternal ? '' : ' target="_blank" rel="noopener noreferrer"';
      return `<a href="${url}"${target}>${label}</a>`;
    });
  };

  // Pre-render Header
  const headerHtml = includeHeader ? `
  <!-- HEADER -->
  <header class="site-header" id="main-header">
    <div class="container header-container">
      <a href="#hero" class="header-logo-link" aria-label="Inicio">
        <img src="${mapAsset(app.headerLogo || '/uploads/logo-summit-header.svg')}" alt="${escapeHtml(app.eventTitle || 'Summit')}" class="header-logo-img">
      </a>
      <nav class="header-nav" id="summit-header-nav" aria-label="Navegación Principal">
        <ul class="header-nav-list">
          ${(summitData.header?.navigation || []).map(item => `
            <li><a href="${item.anchor}" class="header-nav-link">${escapeHtml(item.label)}</a></li>
          `).join('')}
        </ul>
      </nav>
      <div class="header-actions">
        <a href="${summitData.header?.cta?.url || '#agenda'}" class="btn btn-primary btn-sm">${escapeHtml(summitData.header?.cta?.label || 'Registro')}</a>
        <button class="mobile-menu-btn" id="summit-mobile-menu-toggle" aria-label="Abrir menú">☰</button>
      </div>
    </div>
  </header>` : '';

  // Pre-render Hero (1920x938, Mobile Cover, Overlay & Hide Info)
  const heroHtml = `
  <!-- PORTADA / HERO (1920 x 938) -->
  <section class="hero-section ${hero.hideContent ? 'hero-cover-only' : ''}" id="hero">
    <div class="hero-bg-wrapper">
      <picture>
        <source media="(max-width: 768px)" srcset="${mapAsset(hero.coverImageMobile || hero.coverImage || '/uploads/hero-cover.jpg')}">
        <img src="${mapAsset(hero.coverImage || '/uploads/hero-cover.jpg')}" alt="${escapeHtml(hero.title || 'Portada')}" class="hero-cover-img" width="1920" height="938" fetchpriority="high">
      </picture>
      <div class="hero-overlay"></div>
    </div>
    <div class="container">
      <div class="hero-content">
        ${hero.badge ? `<div class="hero-badge"><span class="pulse-dot"></span>${escapeHtml(hero.badge)}</div>` : ''}
        <h1 class="hero-title">${escapeHtml(hero.title || '')}</h1>
        <p class="hero-subtitle">${escapeHtml(hero.subtitle || '')}</p>
        <div class="hero-buttons">
          ${hero.ctaPrimary?.label ? `<a href="${hero.ctaPrimary.anchor || '#agenda'}" class="btn btn-primary">${escapeHtml(hero.ctaPrimary.label)}</a>` : ''}
          ${hero.ctaSecondary?.label ? `<a href="${hero.ctaSecondary.anchor || '#broadcast'}" class="btn btn-secondary">▶ ${escapeHtml(hero.ctaSecondary.label)}</a>` : ''}
        </div>
        ${hero.stats?.length ? `
          <div class="hero-stats">
            ${hero.stats.map(s => `
              <div class="stat-item">
                <span class="stat-value">${escapeHtml(s.value)}</span>
                <span class="stat-label">${escapeHtml(s.label)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  </section>`;

  // Pre-render Sponsors
  const sponsorsHtml = (spSec.enabled !== false) ? `
  <!-- PATROCINADORES / SPONSORS -->
  <section class="section sponsors" id="sponsors">
    <div class="container">
      ${spSec.label ? `<div class="sponsors-label">${escapeHtml(spSec.label)}</div>` : ''}
      ${spSec.subtitle ? `<p class="sponsors-subtitle">${escapeHtml(spSec.subtitle)}</p>` : ''}
      <div class="sponsors-img-wrapper">
        <picture>
          <source media="(max-width: 768px)" srcset="${mapAsset(spSec.imageMobile || spSec.imageDesktop || '/uploads/logos-sitioesg.png')}">
          <img src="${mapAsset(spSec.imageDesktop || '/uploads/logos-sitioesg.png')}" alt="Patrocinadores y Aliados" class="sponsors-img" loading="lazy">
        </picture>
      </div>
    </div>
  </section>` : '';

  // Pre-render Video
  const video = summitData.videoSection || {};
  const videoHtml = `
  <!-- VIDEO OFICIAL -->
  <section class="section-padding section-alt" id="video">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Tráiler Oficial</span>
        <h2 class="section-title">${escapeHtml(video.title || 'Video')}</h2>
        <p class="section-subtitle">${escapeHtml(video.subtitle || '')}</p>
      </div>
      <div class="video-card-container">
        <iframe class="video-iframe" src="https://www.youtube-nocookie.com/embed/${cleanYoutubeId(video.youtubeId || 'L_LUpnjgPso')}?rel=0" title="Video Promocional" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
    </div>
  </section>`;

  // Pre-render Agenda (Expansión Zigzag Architecture)
  const agenda = summitData.agenda || {};
  const categories = agenda.categories || ['Todas'];
  const agendaHtml = `
  <!-- AGENDA / TIMELINE (ZIGZAG EDITORIAL) -->
  <section class="section-padding" id="agenda">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Cronograma</span>
        <h2 class="section-title">${escapeHtml(agenda.title || 'Agenda')}</h2>
        <p class="section-subtitle">${escapeHtml(agenda.subtitle || '')}</p>
      </div>
      <div class="agenda-filters" id="summit-agenda-filters">
        ${categories.map((cat, i) => `
          <button class="filter-btn ${i === 0 ? 'active' : ''}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
        `).join('')}
      </div>

      <!-- Solo Card (Apertura / Inauguración) -->
      <div class="timeline__solo-card">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span>08:30 - 09:00 hrs • Registro &amp; Ceremonia de Inauguración</span>
      </div>

      <!-- Continuous Central Track & Alternating Items -->
      <div class="timeline_progress_wrapper">
        <div class="timeline_progress">
          <div class="timeline_progress_fill" id="summit-timeline-progress"></div>
        </div>
        <div class="timeline_items_wrap" id="summit-timeline-items">
          ${(agenda.items || []).map((item, idx) => {
            const isOdd = idx % 2 === 0;
            const alignClass = isOdd ? 'item-left-image' : 'item-right-image';
            const spk = Array.isArray(item.speakers) ? item.speakers.join(', ') : (item.speakers || '');
            const mod = Array.isArray(item.moderators) ? item.moderators.join(', ') : (item.moderators || '');
            return `
            <div class="timeline_item ${alignClass} ${idx === 0 ? 'active' : ''}" data-category="${escapeHtml(item.category || '')}" data-index="${idx}">
              <div class="_2-column_item_component">
                <div class="_2-column_image-wrapper">
                  ${item.image ? `<img src="${mapAsset(item.image)}" alt="${escapeHtml(item.title)}" class="_2-column_image" loading="lazy">` : ''}
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

  // Pre-render Speakers (Expansión Organic Floating Circular Portraits)
  const speakersHtml = `
  <!-- PONENTES / SPEAKERS -->
  <section class="section-padding section-alt" id="speakers">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Keynote &amp; Expertos</span>
        <h2 class="section-title">${escapeHtml(spkSec.title || 'Ponentes')}</h2>
        <p class="section-subtitle">${escapeHtml(spkSec.subtitle || '')}</p>
      </div>
      <div class="team-grid">
        ${(spkSec.items || []).map((spk, idx) => `
          <div class="team-card team" onclick="window.summitOpenSpeakerBio('${escapeHtml(spk.id || 'spk-' + idx)}')" role="button" tabindex="0">
            <div class="team__img">
              <img src="${mapAsset(spk.image || '/uploads/speaker-1.jpg')}" alt="${escapeHtml(spk.name)}" loading="lazy">
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

  // Pre-render Broadcast (Expansión Signature Circular Stage)
  const bcItems = bcSec.items || [];
  const firstBc = bcItems[0] || {};

  let bcBackground = 'radial-gradient(ellipse at 65% 50%, #004ecc 0%, #00237d 45%, #001040 85%, #000824 100%)';
  if (bcSec.bgType === 'image' && bcSec.bgCustomImage) {
    bcBackground = `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.65)), url('${mapAsset(bcSec.bgCustomImage)}') center/cover no-repeat`;
  } else if (bcSec.bgType === 'color' && bcSec.bgColor) {
    bcBackground = bcSec.bgColor;
  } else if (bcSec.bgGradient) {
    bcBackground = bcSec.bgGradient;
  }

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
            <img src="${mapAsset(firstBc.image || '/uploads/broadcast-1.jpg')}" alt="Ponente Activo" class="broadcast-avatar-img" id="summit-wp-bc-avatar">
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
                  <img src="${mapAsset(item.image || '/uploads/broadcast-1.jpg')}" alt="${escapeHtml(item.title)}">
                </div>
              `;
            }).join('') : ''}
          </div>
        </div>
      </div>
    </div>
  </section>`;

  // Pre-render FAQ
  const faqSec = summitData.faq || {};
  const faqHtml = `
  <!-- PREGUNTAS FRECUENTES (FAQ) -->
  <section class="section-padding section-alt" id="faq">
    <div class="container">
      <div class="section-header">
        <span class="section-tag">Dudas y Respuestas</span>
        <h2 class="section-title">${escapeHtml(faqSec.title || 'Preguntas Frecuentes')}</h2>
        <p class="section-subtitle">${escapeHtml(faqSec.subtitle || '')}</p>
      </div>
      <div class="faq-container" id="summit-faq-accordion">
        ${(faqSec.items || []).map((item, idx) => `
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

  // Pre-render Footer
  const footerSec = summitData.footer || {};
  const footerHtml = includeFooter ? `
  <!-- FOOTER -->
  <footer class="site-footer" id="footer">
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand">
          <img src="${mapAsset(app.footerLogo || '/uploads/logo-summit-footer.svg')}" alt="${escapeHtml(app.eventTitle || 'Summit')}" class="footer-logo-img">
          <p class="footer-desc">${escapeHtml(footerSec.description || '')}</p>
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
            ${(footerSec.socials || []).map(s => `
              <a href="${s.url}" target="_blank" rel="noopener" class="footer-social-btn"><span>${escapeHtml(s.name)}</span></a>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>${escapeHtml(footerSec.copyright || '© Todos los derechos reservados')}</p>
        <p>${escapeHtml(app.eventTitle || 'Summit Event')}</p>
      </div>
    </div>
  </footer>` : '';

  // Dynamic Section Reordering Assembly
  const movableSectionsMap = {
    sponsors: sponsorsHtml,
    agenda: agendaHtml,
    speakers: speakersHtml,
    broadcast: broadcastHtml,
    video: videoHtml
  };
  const activeOrder = summitData.sectionOrder || ['sponsors', 'agenda', 'speakers', 'broadcast', 'video'];
  const orderedMovableHtml = activeOrder.map(key => movableSectionsMap[key] || '').join('\n');

  // Inlined Dynamic CSS (Colores, Fondos por Sección, Overlay y Custom CSS)
  const compiledCss = `
  /* Variables dinámicas del CMS */
  :root, #summit-wp-root {
    --color-primary: ${colors.primaryColor || '#2563eb'};
    --color-primary-hover: ${colors.primaryHover || '#1d4ed8'};
    --color-accent: ${colors.accentColor || '#f59e0b'};
    --color-bg: ${colors.backgroundColor || '#ffffff'};
    --color-surface: ${colors.surfaceColor || '#f8fafc'};
    --color-surface-card: #ffffff;
    --color-border: #e2e8f0;
    --color-module-title: ${colors.moduleTitleColor || '#0f172a'};
    --color-talk-title: ${colors.talkTitleColor || '#1e293b'};
    --color-desc: ${colors.descriptionColor || '#475569'};
    --header-bg: ${colors.headerBg || 'rgba(255, 255, 255, 0.95)'};
    --footer-bg: ${colors.footerBg || '#090d16'};
    --footer-text: ${colors.footerTextColor || '#94a3b8'};

    /* Per-Section Backgrounds */
    --bg-section-header: ${app.sectionBgs?.header || colors.headerBg || '#ffffff'};
    --bg-section-hero: ${app.sectionBgs?.hero || '#0a100d'};
    --bg-section-sponsors: ${app.sectionBgs?.sponsors || '#ffffff'};
    --bg-section-video: ${app.sectionBgs?.video || colors.backgroundColor || '#f8f9fa'};
    --bg-section-agenda: ${app.sectionBgs?.agenda || colors.backgroundColor || '#ffffff'};
    --bg-section-speakers: ${app.sectionBgs?.speakers || '#f8f9fa'};
    --bg-section-broadcast: ${app.sectionBgs?.broadcast || colors.backgroundColor || '#ffffff'};
    --bg-section-faq: ${app.sectionBgs?.faq || '#f8f9fa'};
    --bg-section-footer: ${app.sectionBgs?.footer || colors.footerBg || '#1a1a1a'};

    /* Hero Overlay Opacity & Color */
    --hero-overlay-opacity: ${(hero.overlayOpacity !== undefined ? hero.overlayOpacity : 70) / 100};
    --hero-overlay-color: ${hero.overlayColor || '#000000'};

    --font-module-title: '${fontModule}', sans-serif;
    --font-talk-title: '${fontTalk}', sans-serif;
    --font-body: '${fontBody}', sans-serif;
  }
  ${baseCss}

  /* Custom CSS Overrides */
  ${app.customCss || ''}
  `;

  // Compiled Inlined JavaScript (100% Autónomo sin dependencias externas)
  const compiledJs = `
  (function() {
    var speakersData = ${JSON.stringify((spkSec.items || []).map((s, idx) => ({
      id: s.id || ('spk-' + idx),
      name: s.name,
      role: s.role || '',
      company: s.company || '',
      badge: s.badge || '',
      bio: s.bio || '',
      image: mapAsset(s.image || '/uploads/speaker-1.jpg')
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

    var liveModal = document.getElementById('summit-wp-modal');
    if (liveModal) {
      liveModal.addEventListener('click', function(e) {
        var rect = liveModal.getBoundingClientRect();
        var inDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
        if (!inDialog) { window.summitCloseLiveVideo(); }
      });
      liveModal.addEventListener('close', function() {
        var iframe = document.getElementById('summit-wp-modal-iframe');
        if (iframe) iframe.src = '';
      });
    }

    // 2. Expansión Slide-in Bio Drawer (Modal Team)
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
    var broadcastData = ${JSON.stringify(bcItems.map(item => ({
      title: item.title,
      time: item.time || '',
      speakers: item.speakers || '',
      moderators: item.moderators || '',
      image: mapAsset(item.image || '/uploads/broadcast-1.jpg'),
      youtubeId: cleanYoutubeId(item.youtubeId || '')
    })))};
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

    // 4. Expansión Zigzag Timeline Scroll Animation
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

    // 5. Agenda Category Filtering
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

  // Final Compiled WordPress HTML block
  const fullHtml = `<!-- ========================================================
     SUMMIT EVENT LANDING - RAW HTML BLOCK FOR WORDPRESS
     Generado automáticamente por Summit CMS Engine
     Compatible con Bloque HTML Personalizado Gutenberg y Elementor
     
     ========================================================
     METADATOS SEO Y OPEN GRAPH (OPCIONAL PARA PEGAR EN <HEAD>):
     ========================================================
     <title>${escapeHtml(seoData.metaTitle || app.eventTitle || 'Summit Innovation 2026')}</title>
     <meta name="description" content="${escapeHtml(seoData.metaDescription || '')}">
     <meta name="keywords" content="${escapeHtml(seoData.keywords || '')}">
     <meta name="robots" content="${escapeHtml(seoData.metaRobots || 'noindex, nofollow')}">
     <link rel="canonical" href="${escapeHtml(seoData.canonicalUrl || '')}">
     <meta property="og:type" content="${escapeHtml(seoData.ogType || 'website')}">
     <meta property="og:title" content="${escapeHtml(seoData.ogTitle || seoData.metaTitle || '')}">
     <meta property="og:description" content="${escapeHtml(seoData.ogDescription || seoData.metaDescription || '')}">
     <meta property="og:image" content="${mapAsset(seoData.ogImage || '/uploads/hero-cover.jpg')}">
     <meta property="og:url" content="${escapeHtml(seoData.ogUrl || seoData.canonicalUrl || '')}">
     <meta name="twitter:card" content="${escapeHtml(seoData.twitterCard || 'summary_large_image')}">
     <meta name="twitter:title" content="${escapeHtml(seoData.twitterTitle || seoData.ogTitle || '')}">
     <meta name="twitter:description" content="${escapeHtml(seoData.twitterDescription || seoData.ogDescription || '')}">
     <meta name="twitter:image" content="${mapAsset(seoData.twitterImage || seoData.ogImage || '/uploads/hero-cover.jpg')}">
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

  // Put in textarea
  const textarea = document.getElementById('wp-generated-code-textarea');
  if (textarea) {
    textarea.value = fullHtml;
  }

  // Update stats
  const lines = fullHtml.split('\n').length;
  const kb = (new Blob([fullHtml]).size / 1024).toFixed(1);
  const statsEl = document.getElementById('wp-code-stats');
  if (statsEl) {
    statsEl.textContent = `✓ ${lines} líneas compiladas • ${kb} KB • 100% Autónomo para WordPress`;
  }

  showToast(`¡Código compilado con éxito (${kb} KB)! Listo para WordPress.`, 'success');
};

window.copyWordPressCodeToClipboard = async function() {
  const textarea = document.getElementById('wp-generated-code-textarea');
  const btn = document.getElementById('btn-copy-wp-code');
  if (!textarea || !textarea.value) {
    alert('Primero haz clic en "Compilar y Generar Código HTML"');
    return;
  }

  try {
    await navigator.clipboard.writeText(textarea.value);
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span>✓ ¡Copiado al Portapapeles!</span>';
      btn.style.background = '#059669';
      btn.style.color = '#ffffff';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.style.color = '';
      }, 2500);
    }
    showToast('¡Código copiado al portapapeles! Ya puedes pegarlo en WordPress.', 'success');
  } catch (err) {
    textarea.select();
    document.execCommand('copy');
    showToast('Código copiado al portapapeles', 'success');
  }
};

window.downloadWordPressHtmlFile = function() {
  const textarea = document.getElementById('wp-generated-code-textarea');
  if (!textarea || !textarea.value) {
    alert('Primero compila el código');
    return;
  }
  const blob = new Blob([textarea.value], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `summit-wordpress-${Date.now()}.html`;
  a.click();
  showToast('Archivo HTML descargado', 'success');
};

window.previewWordPressHtmlDirect = function() {
  const textarea = document.getElementById('wp-generated-code-textarea');
  if (!textarea || !textarea.value) {
    alert('Primero compila el código');
    return;
  }
  const blob = new Blob([textarea.value], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

// ==========================================
// 12. AUTHENTICATION & USER MANAGEMENT
// ==========================================

async function checkAuthSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) throw new Error('Error al verificar sesión');
    const data = await res.json();
    if (data.authenticated && data.user) {
      currentUser = data.user;
      renderUserUI(currentUser);
      applyRoleRestrictions(currentUser);
      return true;
    } else {
      window.location.href = '/login';
      return false;
    }
  } catch (err) {
    console.warn('Verificación de sesión falló:', err);
    window.location.href = '/login';
    return false;
  }
}

function renderUserUI(user) {
  if (!user) return;
  const nameEl = document.getElementById('user-display-name');
  const userEl = document.getElementById('user-display-username');
  const roleEl = document.getElementById('user-display-role');
  const iconEl = document.getElementById('user-badge-icon');
  const topNameEl = document.getElementById('topbar-user-name');
  const topRoleEl = document.getElementById('topbar-user-role-badge');

  const isAdmin = user.role === 'admin';
  const roleText = isAdmin ? 'ADMIN' : 'EDITOR';
  const roleBadgeClass = isAdmin ? 'role-badge-admin' : 'role-badge-editor';
  const icon = isAdmin ? '👑' : '✍️';

  if (nameEl) nameEl.textContent = user.name || user.username;
  if (userEl) userEl.textContent = `@${user.username}`;
  if (roleEl) {
    roleEl.textContent = roleText;
    roleEl.className = `user-role-badge ${roleBadgeClass}`;
  }
  if (iconEl) iconEl.textContent = icon;

  if (topNameEl) topNameEl.textContent = user.name || user.username;
  if (topRoleEl) {
    topRoleEl.textContent = roleText;
    topRoleEl.className = `user-role-badge ${roleBadgeClass}`;
  }
}

function applyRoleRestrictions(user) {
  const isEditor = user.role === 'editor';
  const usersTab = document.getElementById('sidebar-tab-users');

  if (usersTab) {
    usersTab.style.display = isEditor ? 'none' : 'flex';
  }

  // Restrictions for editor profile
  if (isEditor) {
    // Custom CSS restriction: readonly with notice
    const cssTextarea = document.getElementById('appearance-custom-css');
    if (cssTextarea && !document.getElementById('editor-css-notice')) {
      const notice = document.createElement('div');
      notice.id = 'editor-css-notice';
      notice.className = 'editor-restricted-notice';
      notice.innerHTML = '🔒 <strong>Modo Editor:</strong> La edición de código Custom CSS está reservada para el perfil Administrador.';
      cssTextarea.parentNode.insertBefore(notice, cssTextarea);
      cssTextarea.disabled = true;
      cssTextarea.style.opacity = '0.6';
    }

    // Hide preset template trigger for editors to prevent accidental theme overwrites
    const presetButtons = document.querySelectorAll("button[onclick*='loadPreset']");
    presetButtons.forEach(btn => {
      btn.style.display = 'none';
    });
  }
}

window.handleLogout = async function() {
  if (!confirm('¿Seguro que deseas cerrar sesión?')) return;
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  localStorage.removeItem('summit_auth_token');
  localStorage.removeItem('summit_auth_user');
  window.location.href = '/login';
};

window.openChangePasswordModal = function() {
  const alertEl = document.getElementById('change-pw-alert');
  if (alertEl) alertEl.style.display = 'none';
  const curEl = document.getElementById('pw-current');
  const newEl = document.getElementById('pw-new');
  const confEl = document.getElementById('pw-confirm');
  if (curEl) curEl.value = '';
  if (newEl) newEl.value = '';
  if (confEl) confEl.value = '';
  openDialog('admin-change-password-modal');
};

window.submitChangePassword = async function() {
  const alertEl = document.getElementById('change-pw-alert');
  const oldPassword = document.getElementById('pw-current')?.value || '';
  const newPassword = document.getElementById('pw-new')?.value || '';
  const confirmPassword = document.getElementById('pw-confirm')?.value || '';

  const showAlert = (msg, isError = true) => {
    if (!alertEl) return;
    alertEl.style.display = 'block';
    alertEl.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    alertEl.style.border = isError ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)';
    alertEl.style.color = isError ? '#fca5a5' : '#6ee7b7';
    alertEl.textContent = msg;
  };

  if (!oldPassword) return showAlert('Ingresa tu contraseña actual');
  if (!newPassword || newPassword.length < 10) return showAlert('La nueva contraseña debe tener al menos 10 caracteres');
  if (newPassword !== confirmPassword) return showAlert('La confirmación de contraseña no coincide');

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showAlert('¡Contraseña actualizada exitosamente!', false);
      setTimeout(() => {
        closeDialog('admin-change-password-modal');
        showToast('Contraseña actualizada con éxito', 'success');
      }, 1200);
    } else {
      showAlert(data.error || 'No se pudo actualizar la contraseña');
    }
  } catch (err) {
    showAlert('Error de conexión al servidor');
  }
};

window.loadUsersList = async function() {
  const container = document.getElementById('users-table-container');
  if (!container) return;

  try {
    const res = await fetch('/api/auth/users');
    if (!res.ok) throw new Error('Error al consultar usuarios');
    const data = await res.json();
    const users = data.users || [];

    if (!users.length) {
      container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:#94a3b8;">No se encontraron usuarios.</div>';
      return;
    }

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.875rem; text-align:left;">
          <thead>
            <tr style="border-bottom:1px solid #334155; color:#94a3b8; font-size:0.75rem; text-transform:uppercase;">
              <th style="padding:10px 12px;">Usuario</th>
              <th style="padding:10px 12px;">Nombre</th>
              <th style="padding:10px 12px;">Perfil / Rol</th>
              <th style="padding:10px 12px;">Fecha de Creación</th>
              <th style="padding:10px 12px; text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const isAdmin = u.role === 'admin';
              const roleBadge = isAdmin
                ? '<span class="user-role-badge role-badge-admin">👑 Admin</span>'
                : '<span class="user-role-badge role-badge-editor">✍️ Editor</span>';
              const isMe = currentUser && currentUser.id === u.id;
              const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-MX', { year:'numeric', month:'short', day:'numeric' }) : '-';

              return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05); color:#e2e8f0;">
                  <td style="padding:12px; font-weight:600; font-family:monospace; color:#38bdf8;">
                    @${escapeHtml(u.username)} ${isMe ? '<span style="font-size:0.7rem; color:#fcea10;">(Tú)</span>' : ''}
                  </td>
                  <td style="padding:12px;">${escapeHtml(u.name || '')}</td>
                  <td style="padding:12px;">${roleBadge}</td>
                  <td style="padding:12px; color:#94a3b8; font-size:0.8rem;">${dateStr}</td>
                  <td style="padding:12px; text-align:right;">
                    ${isMe ? `
                      <span style="font-size:0.75rem; color:#64748b;">Tu cuenta</span>
                    ` : `
                      <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" onclick="openResetPasswordModal('${escapeHtml(u.id)}', '${escapeHtml(u.username)}')" style="padding:3px 8px; font-size:0.75rem; margin-right:4px;">
                        <span>🔑 Contraseña</span>
                      </button>
                      <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteUserItem('${escapeHtml(u.id)}', '${escapeHtml(u.username)}')" style="padding:3px 8px; font-size:0.75rem;">
                        <span>🗑️ Eliminar</span>
                      </button>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="text-align:center; padding:1.5rem; color:#f87171;">Error al cargar la lista de usuarios.</div>`;
  }
};

window.openCreateUserModal = function() {
  const alertEl = document.getElementById('create-user-alert');
  if (alertEl) alertEl.style.display = 'none';
  const nameEl = document.getElementById('new-user-name');
  const userEl = document.getElementById('new-user-username');
  const roleEl = document.getElementById('new-user-role');
  const passEl = document.getElementById('new-user-password');
  if (nameEl) nameEl.value = '';
  if (userEl) userEl.value = '';
  if (roleEl) roleEl.value = 'editor';
  if (passEl) passEl.value = '';
  openDialog('admin-create-user-modal');
};

window.submitCreateUser = async function() {
  const alertEl = document.getElementById('create-user-alert');
  const name = (document.getElementById('new-user-name')?.value || '').trim();
  const username = (document.getElementById('new-user-username')?.value || '').trim();
  const role = document.getElementById('new-user-role')?.value || 'editor';
  const password = document.getElementById('new-user-password')?.value || '';

  const showAlert = (msg) => {
    if (!alertEl) return;
    alertEl.style.display = 'block';
    alertEl.textContent = msg;
  };

  if (!name) return showAlert('Ingresa el nombre del usuario');
  if (!username || username.length < 3) return showAlert('El nombre de usuario debe tener al menos 3 caracteres');
  if (!password || password.length < 10) return showAlert('La contraseña debe tener al menos 10 caracteres');

  try {
    const res = await fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, role, password })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      closeDialog('admin-create-user-modal');
      showToast(`Usuario @${username} creado exitosamente`, 'success');
      loadUsersList();
    } else {
      showAlert(data.error || 'No se pudo crear el usuario');
    }
  } catch (err) {
    showAlert('Error de conexión al servidor');
  }
};

window.deleteUserItem = async function(userId, username) {
  if (!confirm(`¿Estás seguro de que deseas eliminar la cuenta de @${username}? Esta acción no se puede deshacer.`)) {
    return;
  }

  try {
    const res = await fetch('/api/auth/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Usuario @${username} eliminado`, 'success');
      loadUsersList();
    } else {
      alert(data.error || 'No se pudo eliminar el usuario');
    }
  } catch (err) {
    alert('Error de conexión al servidor');
  }
};



window.openResetPasswordModal = function(userId, username) {
  const alertEl = document.getElementById('reset-pw-alert');
  if (alertEl) alertEl.style.display = 'none';
  document.getElementById('reset-pw-userid').value = userId;
  document.getElementById('reset-pw-username').textContent = '@' + username;
  document.getElementById('reset-pw-new').value = '';
  document.getElementById('reset-pw-confirm').value = '';
  openDialog('admin-reset-password-modal');
};

window.submitResetPassword = async function() {
  const alertEl = document.getElementById('reset-pw-alert');
  const userId = document.getElementById('reset-pw-userid').value;
  const newPassword = document.getElementById('reset-pw-new').value || '';
  const confirmPassword = document.getElementById('reset-pw-confirm').value || '';
  const showAlert = (msg) => {
    if (!alertEl) return;
    alertEl.style.display = 'block';
    alertEl.textContent = msg;
  };

  if (newPassword.length < 10) return showAlert('La contraseña debe tener al menos 10 caracteres');
  if (newPassword !== confirmPassword) return showAlert('La confirmación no coincide');

  try {
    const res = await fetch('/api/auth/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newPassword })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      closeDialog('admin-reset-password-modal');
      showToast('Contraseña restablecida', 'success');
    } else {
      showAlert(data.error || 'No se pudo restablecer la contraseña');
    }
  } catch (err) {
    showAlert('Error de conexión al servidor');
  }
};

// Si la sesión expira mientras se edita, cualquier llamada a la API devuelve 401:
// se avisa y se redirige al login en lugar de fallar en silencio.
(function installSessionGuard() {
  const originalFetch = window.fetch.bind(window);
  let redirecting = false;
  window.fetch = async function(input, init) {
    const res = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (res.status === 401 && url.startsWith('/api/') && !url.startsWith('/api/auth/login') && !redirecting) {
      redirecting = true;
      alert('Tu sesión expiró. Vuelve a iniciar sesión (los cambios no guardados se perderán).');
      window.location.href = '/login?next=' + encodeURIComponent('/admin');
    }
    return res;
  };
})();
