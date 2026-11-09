/**
 * SUMMIT CMS - LANDING PAGE CLIENT SCRIPT
 * Expansión UX/UI Signature Engine:
 * - Dynamic Section Reordering (Desktop & Mobile)
 * - Sponsors with Responsive <picture>
 * - Alternating Zigzag Editorial Timeline & Continuous Scroll Progress
 * - Organic Circular Floating Speaker Cards & Slide-in Drawer Modal
 * - Cinematic Stage Carousel with 3D Preview Cards & YouTube Live Modal
 */

// Global state
let summitData = null;
let isCarouselAnimating = false;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initLandingPage();
});

async function initLandingPage() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Error al cargar datos del Summit');
    summitData = await res.json();
    
    // 0. Apply SEO metadata & social tags
    applySeo(summitData.seo);

    // 1. Apply styling, fonts & custom CSS
    applyTheme(summitData.appearance);

    // 2. Render Header & Hero (Fixed Top)
    renderHeader(summitData.header, summitData.appearance);
    renderHero(summitData.hero);

    // 3. Render Movable Sections
    renderSponsors(summitData.sponsors);
    renderVideo(summitData.videoSection);
    renderAgenda(summitData.agenda);
    renderSpeakers(summitData.speakers);
    renderBroadcast(summitData.broadcast);

    // 4. Apply Dynamic Section Order
    applySectionOrder(summitData.sectionOrder);

    // 5. Render Fixed Bottom Sections
    renderFaq(summitData.faq);
    renderFooter(summitData.footer, summitData.appearance);

    // 6. Setup Interactive Behaviors & Animations
    setupScrollSpy();
    setupMobileMenu();
    setupModalHandlers();
    setupTimelineScrollAnimation();
  } catch (err) {
    console.error('Error inicializando landing:', err);
  }
}

/**
 * 1. THEME, TYPOGRAPHY & PER-SECTION BACKGROUNDS
 */
function applyTheme(appearance) {
  if (!appearance) return;

  const root = document.documentElement;
  const colors = appearance.colors || {};
  const fonts = appearance.fonts || {};
  const secBgs = appearance.sectionBgs || {};

  // CSS Variables for Colors
  if (colors.primaryColor) root.style.setProperty('--color-primary', colors.primaryColor);
  if (colors.primaryHover) root.style.setProperty('--color-primary-hover', colors.primaryHover);
  if (colors.accentColor) root.style.setProperty('--color-accent', colors.accentColor);
  if (colors.backgroundColor) root.style.setProperty('--color-bg', colors.backgroundColor);
  if (colors.surfaceColor) root.style.setProperty('--color-surface', colors.surfaceColor);
  if (colors.moduleTitleColor) root.style.setProperty('--color-module-title', colors.moduleTitleColor);
  if (colors.talkTitleColor) root.style.setProperty('--color-talk-title', colors.talkTitleColor);
  if (colors.descriptionColor) root.style.setProperty('--color-desc', colors.descriptionColor);
  if (colors.headerBg) root.style.setProperty('--header-bg', colors.headerBg);
  if (colors.footerBg) root.style.setProperty('--footer-bg', colors.footerBg);
  if (colors.footerTextColor) root.style.setProperty('--footer-text', colors.footerTextColor);

  // Per-Section Backgrounds
  if (secBgs.header) root.style.setProperty('--bg-section-header', secBgs.header);
  if (secBgs.hero) root.style.setProperty('--bg-section-hero', secBgs.hero);
  if (secBgs.sponsors) root.style.setProperty('--bg-section-sponsors', secBgs.sponsors);
  if (secBgs.video) root.style.setProperty('--bg-section-video', secBgs.video);
  if (secBgs.agenda) root.style.setProperty('--bg-section-agenda', secBgs.agenda);
  if (secBgs.speakers) root.style.setProperty('--bg-section-speakers', secBgs.speakers);
  if (secBgs.broadcast) root.style.setProperty('--bg-section-broadcast', secBgs.broadcast);
  if (secBgs.faq) root.style.setProperty('--bg-section-faq', secBgs.faq);
  if (secBgs.footer) root.style.setProperty('--bg-section-footer', secBgs.footer);

  // Inject User Custom CSS
  const customCssTag = document.getElementById('summit-user-custom-css');
  if (customCssTag) {
    customCssTag.textContent = appearance.customCss || '';
  }

  // Load Google Fonts dynamically
  const fontFamilies = [
    fonts.moduleTitleFont || 'Outfit',
    fonts.talkTitleFont || 'Plus Jakarta Sans',
    fonts.bodyFont || 'Inter'
  ].filter(Boolean);

  const uniqueFonts = [...new Set(fontFamilies)];
  const fontParam = uniqueFonts.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`).join('&');
  
  const linkId = 'summit-dynamic-fonts';
  let fontLink = document.getElementById(linkId);
  if (!fontLink) {
    fontLink = document.createElement('link');
    fontLink.id = linkId;
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
  }
  fontLink.href = `https://fonts.googleapis.com/css2?${fontParam}&display=swap`;

  if (fonts.moduleTitleFont) {
    root.style.setProperty('--font-module-title', `'${fonts.moduleTitleFont}', sans-serif`);
  }
  if (fonts.talkTitleFont) {
    root.style.setProperty('--font-talk-title', `'${fonts.talkTitleFont}', sans-serif`);
  }
  if (fonts.bodyFont) {
    root.style.setProperty('--font-body', `'${fonts.bodyFont}', sans-serif`);
  }

  if (appearance.eventTitle && !summitData?.seo?.metaTitle) {
    document.title = appearance.eventTitle;
  }
}

/**
 * SEO & METADATOS COMPONENT (Meta Title, Description, Canonical, OG & Twitter)
 */
function applySeo(seoData) {
  if (!seoData) return;

  const title = seoData.metaTitle || seoData.title || '';
  const desc = seoData.metaDescription || seoData.description || '';
  const robots = seoData.metaRobots || seoData.robots || 'noindex, nofollow';
  const canonical = seoData.canonicalUrl || seoData.canonical || window.location.href;

  if (title) {
    document.title = title;
    const metaTitleEl = document.getElementById('seo-meta-title');
    if (metaTitleEl) metaTitleEl.textContent = title;
  }
  
  const setMetaContent = (id, content) => {
    const el = document.getElementById(id);
    if (el && content !== undefined) el.setAttribute('content', content);
  };

  const setLinkHref = (id, href) => {
    const el = document.getElementById(id);
    if (el && href !== undefined) el.setAttribute('href', href);
  };

  // Standard SEO
  setMetaContent('seo-meta-desc', desc);
  setMetaContent('seo-meta-keywords', seoData.keywords || '');
  setMetaContent('seo-meta-robots', robots);
  setLinkHref('seo-meta-canonical', canonical);

  // Open Graph
  setMetaContent('seo-og-type', seoData.ogType || 'website');
  setMetaContent('seo-og-title', seoData.ogTitle || title || document.title);
  setMetaContent('seo-og-desc', seoData.ogDescription || desc);
  setMetaContent('seo-og-img', seoData.ogImage || '/uploads/hero-cover.jpg');
  setMetaContent('seo-og-url', seoData.ogUrl || canonical);

  // Twitter Cards
  setMetaContent('seo-tw-card', seoData.twitterCard || 'summary_large_image');
  setMetaContent('seo-tw-title', seoData.twitterTitle || seoData.ogTitle || title || document.title);
  setMetaContent('seo-tw-desc', seoData.twitterDescription || seoData.ogDescription || desc);
  setMetaContent('seo-tw-img', seoData.twitterImage || seoData.ogImage || '/uploads/hero-cover.jpg');
}

/**
 * 2. HEADER COMPONENT
 */
function renderHeader(headerData, appearance) {
  const logoContainer = document.getElementById('header-logo-container');
  const navContainer = document.getElementById('header-nav-list');
  const headerCta = document.getElementById('header-cta');

  if (logoContainer) {
    const logoSrc = appearance?.headerLogo || '/uploads/logo-summit-header.svg';
    logoContainer.innerHTML = `
      <img src="${logoSrc}" alt="${escapeHtml(appearance?.eventTitle || 'Summit')}" class="header-logo-img">
    `;
  }

  if (navContainer && headerData?.navigation) {
    navContainer.innerHTML = headerData.navigation.map(item => `
      <li>
        <a href="${item.anchor}" class="header-nav-link">${escapeHtml(item.label)}</a>
      </li>
    `).join('');
  }

  if (headerCta && headerData?.cta) {
    headerCta.textContent = headerData.cta.label || 'Registro';
    headerCta.setAttribute('href', headerData.cta.url || '#agenda');
  }
}

/**
 * 3. HERO COMPONENT (1920x938, Mobile Cover, Overlay & Hide Info)
 */
function renderHero(heroData) {
  if (!heroData) return;

  const root = document.documentElement;
  const heroSection = document.getElementById('hero');
  const heroBadge = document.getElementById('hero-badge');
  const heroTitle = document.getElementById('hero-title');
  const heroSubtitle = document.getElementById('hero-subtitle');
  const heroCover = document.getElementById('hero-cover-img');
  const heroSourceMobile = document.getElementById('hero-cover-source-mobile');
  const heroCtaPrimary = document.getElementById('hero-cta-primary');
  const heroCtaSecondary = document.getElementById('hero-cta-secondary');
  const heroStatsContainer = document.getElementById('hero-stats-container');

  // Overlay opacity & color
  const opacityVal = (heroData.overlayOpacity !== undefined ? heroData.overlayOpacity : 75) / 100;
  root.style.setProperty('--hero-overlay-opacity', opacityVal);
  if (heroData.overlayColor) {
    root.style.setProperty('--hero-overlay-color', heroData.overlayColor);
  }

  // Toggle Hide Info (Leave only cover image)
  if (heroSection) {
    if (heroData.hideContent) {
      heroSection.classList.add('hero-cover-only');
    } else {
      heroSection.classList.remove('hero-cover-only');
    }
  }

  // Covers (Desktop & Mobile)
  const desktopCover = heroData.coverImage || '/uploads/hero-cover.jpg';
  const mobileCover = heroData.coverImageMobile || desktopCover;

  if (heroCover) {
    heroCover.src = desktopCover;
    heroCover.alt = heroData.title || 'Hero Summit';
  }
  if (heroSourceMobile) {
    heroSourceMobile.srcset = mobileCover;
  }

  // Text content
  if (heroBadge) {
    heroBadge.innerHTML = `<span class="pulse-dot"></span>${escapeHtml(heroData.badge || 'SUMMIT 2026')}`;
  }
  if (heroTitle) heroTitle.textContent = heroData.title || '';
  if (heroSubtitle) heroSubtitle.textContent = heroData.subtitle || '';

  if (heroCtaPrimary && heroData.ctaPrimary) {
    heroCtaPrimary.textContent = heroData.ctaPrimary.label || 'Ver Agenda';
    heroCtaPrimary.setAttribute('href', heroData.ctaPrimary.anchor || '#agenda');
  }
  if (heroCtaSecondary && heroData.ctaSecondary) {
    heroCtaSecondary.textContent = heroData.ctaSecondary.label || 'Ver Transmisión';
    heroCtaSecondary.setAttribute('href', heroData.ctaSecondary.anchor || '#broadcast');
  }

  if (heroStatsContainer && heroData.stats) {
    heroStatsContainer.innerHTML = heroData.stats.map(s => `
      <div class="stat-item">
        <span class="stat-value">${escapeHtml(s.value)}</span>
        <span class="stat-label">${escapeHtml(s.label)}</span>
      </div>
    `).join('');
  }
}

/**
 * 4. PATROCINADORES / SPONSORS COMPONENT
 */
function renderSponsors(sponsorsData) {
  const sponsorsSec = document.getElementById('sponsors');
  if (!sponsorsSec) return;

  if (sponsorsData?.enabled === false) {
    sponsorsSec.style.display = 'none';
    return;
  }
  sponsorsSec.style.display = '';

  const labelEl = document.getElementById('sponsors-label');
  const subEl = document.getElementById('sponsors-subtitle');
  const imgEl = document.getElementById('sponsors-img');
  const sourceMobileEl = document.getElementById('sponsors-source-mobile');

  if (labelEl) labelEl.textContent = sponsorsData?.label || 'PATROCINADORES Y ALIADOS';
  if (subEl) {
    subEl.textContent = sponsorsData?.subtitle || '';
    subEl.style.display = sponsorsData?.subtitle ? 'block' : 'none';
  }

  const desktopImg = sponsorsData?.imageDesktop || '/uploads/logos-sitioesg.png';
  const mobileImg = sponsorsData?.imageMobile || desktopImg;

  if (imgEl) imgEl.src = desktopImg;
  if (sourceMobileEl) sourceMobileEl.srcset = mobileImg;
}

/**
 * 5. VIDEO SECTION COMPONENT
 */
function renderVideo(videoData) {
  if (!videoData) return;

  const sectionTitle = document.getElementById('video-section-title');
  const sectionSubtitle = document.getElementById('video-section-subtitle');
  const iframe = document.getElementById('main-video-iframe');

  if (sectionTitle) sectionTitle.textContent = videoData.title || 'Video';
  if (sectionSubtitle) sectionSubtitle.textContent = videoData.subtitle || '';
  
  if (iframe) {
    const videoId = cleanYoutubeId(videoData.youtubeId || 'L_LUpnjgPso');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
  }
}

/**
 * 6. DYNAMIC SECTION REORDERING
 * Moves sections inside #summit-movable-sections according to user preference
 */
function applySectionOrder(sectionOrder) {
  const container = document.getElementById('summit-movable-sections');
  if (!container) return;

  const sections = {
    sponsors: document.getElementById('sponsors'),
    agenda: document.getElementById('agenda'),
    speakers: document.getElementById('speakers'),
    broadcast: document.getElementById('broadcast'),
    video: document.getElementById('video')
  };

  const order = sectionOrder || ['sponsors', 'agenda', 'speakers', 'broadcast', 'video'];
  order.forEach(secKey => {
    const secEl = sections[secKey];
    if (secEl) {
      container.appendChild(secEl);
    }
  });
}

/**
 * 7. AGENDA / TIMELINE COMPONENT (Expansión Zigzag Architecture)
 */
function renderAgenda(agendaData) {
  if (!agendaData) return;

  const sectionTitle = document.getElementById('agenda-title');
  const sectionSubtitle = document.getElementById('agenda-subtitle');
  const filtersContainer = document.getElementById('agenda-filters');
  const timelineContainer = document.getElementById('agenda-timeline-items');

  if (sectionTitle) sectionTitle.textContent = agendaData.title || 'Agenda';
  if (sectionSubtitle) sectionSubtitle.textContent = agendaData.subtitle || '';

  // Render Category Filters
  const categories = agendaData.categories || ['Todas'];
  if (filtersContainer) {
    filtersContainer.innerHTML = categories.map((cat, idx) => `
      <button class="filter-btn ${idx === 0 ? 'active' : ''}" data-category="${escapeHtml(cat)}">
        ${escapeHtml(cat)}
      </button>
    `).join('');

    filtersContainer.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filtersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const selected = btn.dataset.category;
        filterAgendaItems(selected, agendaData.items || []);
      });
    });
  }

  // Render Zigzag Timeline items initially
  renderTimelineList(agendaData.items || [], timelineContainer);
}

function renderTimelineList(items, container) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<p style="text-align:center; padding: 2.5rem; color: var(--color-desc);">No hay ponencias registradas en esta categoría.</p>`;
    return;
  }

  container.innerHTML = items.map((item, idx) => {
    const isOdd = idx % 2 === 0;
    const alignClass = isOdd ? 'item-left-image' : 'item-right-image';
    const speakers = Array.isArray(item.speakers) ? item.speakers.join(', ') : (item.speakers || '');
    const moderators = Array.isArray(item.moderators) ? item.moderators.join(', ') : (item.moderators || '');

    return `
      <div class="timeline_item ${alignClass} ${idx === 0 ? 'active' : ''}" data-index="${idx}" data-category="${escapeHtml(item.category || '')}">
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
            ${(speakers || moderators) ? `
              <ul class="ponentes">
                ${speakers ? `<li><strong>Ponente(s):</strong> <span>${escapeHtml(speakers)}</span></li>` : ''}
                ${moderators ? `<li><strong>Moderador(es):</strong> <span>${escapeHtml(moderators)}</span></li>` : ''}
              </ul>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterAgendaItems(selectedCategory, allItems) {
  const container = document.getElementById('agenda-timeline-items');
  if (selectedCategory === 'Todas') {
    renderTimelineList(allItems, container);
  } else {
    const filtered = allItems.filter(i => (i.category || '').toLowerCase() === selectedCategory.toLowerCase());
    renderTimelineList(filtered, container);
  }
}

/**
 * Scroll Tracking Animation for Expansión Timeline
 * Fills progress bar dynamically and sets active state to nearest session
 */
function setupTimelineScrollAnimation() {
  const wrapper = document.getElementById('agenda-timeline-wrapper');
  const progressBar = document.getElementById('timeline-progress-bar');
  if (!wrapper || !progressBar) return;

  function onScroll() {
    const items = wrapper.querySelectorAll('.timeline_item');
    if (!items.length) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const wrapperHeight = wrapperRect.height;
    const triggerY = window.innerHeight * 0.55;

    let activeIndex = -1;
    items.forEach((item, idx) => {
      const itemRect = item.getBoundingClientRect();
      if (itemRect.top <= triggerY) {
        activeIndex = idx;
      }
    });

    items.forEach((item, idx) => {
      if (idx <= activeIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    if (wrapperHeight > 0) {
      const scrollPercent = Math.max(0, Math.min(1, (triggerY - wrapperRect.top) / wrapperHeight));
      progressBar.style.height = `${scrollPercent * 100}%`;
    }
  }

  window.addEventListener('scroll', () => {
    window.requestAnimationFrame(onScroll);
  }, { passive: true });

  setTimeout(onScroll, 300);
}

/**
 * 8. PONENTES / SPEAKERS COMPONENT (Expansión Organic Team Grid)
 */
function renderSpeakers(speakersData) {
  if (!speakersData) return;

  const sectionTitle = document.getElementById('speakers-title');
  const sectionSubtitle = document.getElementById('speakers-subtitle');
  const gridContainer = document.getElementById('speakers-grid');

  if (sectionTitle) sectionTitle.textContent = speakersData.title || 'Ponentes';
  if (sectionSubtitle) sectionSubtitle.textContent = speakersData.subtitle || '';

  if (gridContainer && speakersData.items) {
    gridContainer.innerHTML = speakersData.items.map((spk, idx) => `
      <div class="team-card team" onclick="openSpeakerBioModal('${escapeHtml(spk.id || 'spk-' + idx)}')" role="button" tabindex="0">
        <div class="team__img">
          <img src="${spk.image || '/uploads/speaker-1.jpg'}" alt="${escapeHtml(spk.name)}" loading="lazy">
          <div class="team-hover">
            <span>Ver Bio</span>
          </div>
        </div>
        <div class="team__info">
          <h3 class="team__card-name">${escapeHtml(spk.name)}</h3>
          <p class="team__card-cargo">${escapeHtml(spk.role || '')}${spk.company ? ' • ' + escapeHtml(spk.company) : ''}</p>
        </div>
      </div>
    `).join('');
  }
}

/**
 * Expansión Speaker Slide-in Drawer Modal
 */
window.openSpeakerBioModal = function(speakerId) {
  if (!summitData?.speakers?.items) return;

  const spk = summitData.speakers.items.find((s, idx) => (s.id === speakerId || ('spk-' + idx) === speakerId));
  if (!spk) return;

  const modal = document.getElementById('speaker-drawer-modal');
  const avatar = document.getElementById('speaker-drawer-avatar');
  const name = document.getElementById('speaker-drawer-name');
  const role = document.getElementById('speaker-drawer-role');
  const bio = document.getElementById('speaker-drawer-bio');

  if (avatar) avatar.src = spk.image || '/uploads/speaker-1.jpg';
  if (name) name.textContent = spk.name || '';
  if (role) role.textContent = spk.role + (spk.company ? ' • ' + spk.company : '');
  if (bio) {
    bio.textContent = spk.bio || 'Trayectoria del ponente próximamente disponible.';
  }

  if (modal) {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
};

window.closeSpeakerBioModal = function() {
  const modal = document.getElementById('speaker-drawer-modal');
  if (modal) {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }
};

/**
 * 9. BROADCAST (Expansión Signature Circular Stage)
 * Stage with cyan squircle play button, large circular speaker avatar,
 * arrow buttons centered underneath, and upcoming sessions tray bottom right.
 */
let currentBroadcastIndex = 0;

function renderBroadcast(broadcastData) {
  if (!broadcastData || !broadcastData.items || !broadcastData.items.length) return;

  const section = document.getElementById('broadcast');
  const sectionTitle = document.getElementById('broadcast-title');
  if (sectionTitle) sectionTitle.textContent = broadcastData.title || 'Broadcast';

  // Apply Section Background (Dynamic Gradient or Custom Image, without repeating speaker avatar)
  if (section) {
    if (broadcastData.bgType === 'image' && broadcastData.bgCustomImage) {
      section.style.background = `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.65)), url('${broadcastData.bgCustomImage}') center/cover no-repeat`;
    } else if (broadcastData.bgType === 'color' && broadcastData.bgColor) {
      section.style.background = broadcastData.bgColor;
    } else if (broadcastData.bgGradient) {
      section.style.background = broadcastData.bgGradient;
    } else {
      section.style.background = 'radial-gradient(ellipse at 65% 50%, #004ecc 0%, #00237d 45%, #001040 85%, #000824 100%)';
    }
  }

  const items = broadcastData.items;
  currentBroadcastIndex = Math.min(Math.max(0, currentBroadcastIndex), items.length - 1);

  const updateStage = (index) => {
    currentBroadcastIndex = (index + items.length) % items.length;
    const active = items[currentBroadcastIndex];

    const titleEl = document.getElementById('broadcast-active-title');
    const timeEl = document.getElementById('broadcast-active-time');
    const speakerEl = document.getElementById('broadcast-active-speaker');
    const moderatorEl = document.getElementById('broadcast-active-moderator');
    const avatarEl = document.getElementById('broadcast-active-avatar');
    const playBtn = document.getElementById('broadcast-play-trigger');
    const previewTray = document.getElementById('broadcast-preview-tray');

    // Smooth subtle transition
    if (titleEl) {
      titleEl.style.opacity = '0';
      setTimeout(() => {
        titleEl.textContent = active.title || '';
        titleEl.style.opacity = '1';
      }, 120);
    }

    if (timeEl) timeEl.textContent = active.time || '';
    
    if (speakerEl) {
      speakerEl.innerHTML = active.speakers ? `${escapeHtml(active.speakers)}` : '';
    }
    
    if (moderatorEl) {
      moderatorEl.innerHTML = active.moderators ? `<strong>Moderador(es):</strong> ${escapeHtml(active.moderators)}` : '';
    }

    if (avatarEl) {
      avatarEl.style.opacity = '0.3';
      avatarEl.style.transform = 'scale(0.96)';
      setTimeout(() => {
        avatarEl.src = active.image || '/uploads/broadcast-1.jpg';
        avatarEl.alt = active.title || 'Ponente Activo';
        avatarEl.style.opacity = '1';
        avatarEl.style.transform = 'scale(1)';
      }, 140);
    }

    if (playBtn) {
      playBtn.onclick = () => {
        openLiveVideoModal(active.youtubeId || '', active.title || 'Transmisión Oficial');
      };
    }

    // Render Preview Tray (Upcoming sessions circular avatars)
    if (previewTray && items.length > 1) {
      const upcomingIndices = [];
      const count = Math.min(items.length - 1, 2);
      for (let offset = 1; offset <= count; offset++) {
        upcomingIndices.push((currentBroadcastIndex + offset) % items.length);
      }

      previewTray.innerHTML = upcomingIndices.map((idx, i) => {
        const item = items[idx];
        const isPeeking = (i === 1 && items.length > 2) ? ' peeking' : '';
        return `
          <div class="broadcast-preview-circle${isPeeking}" 
               data-target-index="${idx}" 
               title="Ver: ${escapeHtml(item.title)}"
               role="button"
               tabindex="0"
               aria-label="Ir a ${escapeHtml(item.title)}">
            <img src="${item.image || '/uploads/broadcast-1.jpg'}" alt="${escapeHtml(item.title)}" loading="lazy">
          </div>
        `;
      }).join('');

      previewTray.querySelectorAll('.broadcast-preview-circle').forEach(circle => {
        circle.addEventListener('click', () => {
          const targetIdx = parseInt(circle.getAttribute('data-target-index'), 10);
          updateStage(targetIdx);
        });
        circle.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const targetIdx = parseInt(circle.getAttribute('data-target-index'), 10);
            updateStage(targetIdx);
          }
        });
      });
    } else if (previewTray) {
      previewTray.innerHTML = '';
    }
  };

  // Setup Arrow Navigation
  const nextBtn = document.getElementById('broadcast-next-btn');
  const prevBtn = document.getElementById('broadcast-prev-btn');

  if (nextBtn) {
    nextBtn.onclick = () => updateStage(currentBroadcastIndex + 1);
  }
  if (prevBtn) {
    prevBtn.onclick = () => updateStage(currentBroadcastIndex - 1);
  }

  // Touch Swipe Gesture for mobile
  if (section) {
    let touchStartX = 0;
    let touchEndX = 0;
    section.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    section.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchEndX - touchStartX;
      if (Math.abs(diff) > 45) {
        if (diff < 0) updateStage(currentBroadcastIndex + 1);
        else updateStage(currentBroadcastIndex - 1);
      }
    }, { passive: true });
  }

  // Initialize stage with active index
  updateStage(currentBroadcastIndex);
}

/**
 * 10. YOUTUBE LIVE MODAL
 */
window.openLiveVideoModal = function(youtubeId, title) {
  const modal = document.getElementById('live-stream-modal');
  const iframe = document.getElementById('modal-stream-iframe');
  const titleEl = document.getElementById('modal-stream-title');

  if (!modal || !iframe) return;

  if (titleEl) titleEl.textContent = title || 'Transmisión Oficial En Vivo';
  const cleanId = cleanYoutubeId(youtubeId || '');
  iframe.src = `https://www.youtube-nocookie.com/embed/${cleanId}?autoplay=1&rel=0`;

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', '');
  }
};

window.closeLiveVideoModal = function() {
  const modal = document.getElementById('live-stream-modal');
  const iframe = document.getElementById('modal-stream-iframe');
  if (modal) {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  }
  if (iframe) iframe.src = '';
};

/**
 * 11. FAQ ACCORDION COMPONENT
 */
function renderFaq(faqData) {
  if (!faqData) return;

  const sectionTitle = document.getElementById('faq-title');
  const sectionSubtitle = document.getElementById('faq-subtitle');
  const container = document.getElementById('faq-accordion-container');

  if (sectionTitle) sectionTitle.textContent = faqData.title || 'Preguntas Frecuentes';
  if (sectionSubtitle) sectionSubtitle.textContent = faqData.subtitle || '';

  if (container && faqData.items) {
    container.innerHTML = faqData.items.map((item, idx) => `
      <div class="faq-item ${idx === 0 ? 'open' : ''}">
        <button class="faq-question-btn" aria-expanded="${idx === 0 ? 'true' : 'false'}">
          <span>${escapeHtml(item.question)}</span>
          <span class="faq-icon">▼</span>
        </button>
        <div class="faq-answer-content">
          <p>${formatFaqAnswerWithLinks(item.answer)}</p>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.faq-question-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.closest('.faq-item');
        const isOpen = parent.classList.contains('open');
        parent.classList.toggle('open', !isOpen);
        btn.setAttribute('aria-expanded', !isOpen);
      });
    });
  }
}

function formatFaqAnswerWithLinks(text) {
  if (!text) return '';
  let formatted = escapeHtml(text);
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const isInternal = url.startsWith('#');
    const target = isInternal ? '' : ' target="_blank" rel="noopener noreferrer"';
    return `<a href="${url}"${target}>${label}</a>`;
  });
  return formatted;
}

/**
 * 12. FOOTER COMPONENT
 */
function renderFooter(footerData, appearance) {
  if (!footerData) return;

  const footerLogo = document.getElementById('footer-logo');
  const footerDesc = document.getElementById('footer-description');
  const footerCopyright = document.getElementById('footer-copyright');
  const footerSocials = document.getElementById('footer-socials');
  const footerQuickLinks = document.getElementById('footer-quicklinks');

  if (footerLogo) {
    const logoSrc = appearance?.footerLogo || '/uploads/logo-summit-footer.svg';
    footerLogo.src = logoSrc;
    footerLogo.alt = appearance?.eventTitle || 'Summit';
  }

  if (footerDesc) footerDesc.textContent = footerData.description || '';
  if (footerCopyright) footerCopyright.textContent = footerData.copyright || '';

  if (footerSocials && footerData.socials) {
    footerSocials.innerHTML = footerData.socials.map(s => `
      <a href="${s.url}" target="_blank" rel="noopener" class="footer-social-btn">
        <span>${escapeHtml(s.name)}</span>
      </a>
    `).join('');
  }

  if (footerQuickLinks && footerData.quickLinks) {
    footerQuickLinks.innerHTML = footerData.quickLinks.map(l => `
      <li><a href="${l.url}" class="footer-link">${escapeHtml(l.label)}</a></li>
    `).join('');
  }
}

/**
 * MODALS SETUP & GLOBAL EVENT LISTENERS
 */
function setupModalHandlers() {
  // Live Stream modal
  const streamModal = document.getElementById('live-stream-modal');
  const streamCloseBtn = document.getElementById('modal-close-btn');

  if (streamCloseBtn && streamModal) {
    streamCloseBtn.addEventListener('click', closeLiveVideoModal);
  }

  if (streamModal) {
    streamModal.addEventListener('click', (e) => {
      const rect = streamModal.getBoundingClientRect();
      const isIn = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
      if (!isIn) closeLiveVideoModal();
    });
    streamModal.addEventListener('close', () => {
      const iframe = document.getElementById('modal-stream-iframe');
      if (iframe) iframe.src = '';
    });
  }

  // Speaker Bio Drawer modal
  const drawerCloseBtn = document.getElementById('speaker-drawer-close');
  const drawerOverlay = document.getElementById('speaker-drawer-overlay');

  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeSpeakerBioModal);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeSpeakerBioModal);

  // Global Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSpeakerBioModal();
      closeLiveVideoModal();
    }
  });
}

/**
 * MOBILE MENU & SCROLLSPY
 */
function setupMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-toggle');
  const nav = document.getElementById('header-nav');

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      nav.classList.toggle('mobile-open');
    });

    nav.querySelectorAll('.header-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('mobile-open');
      });
    });
  }
}

function setupScrollSpy() {
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  }, { passive: true });
}

function cleanYoutubeId(input) {
  if (!input) return '';
  const str = input.trim();
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|live\/))([\w-]{11})/);
  return match ? match[1] : str;
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
