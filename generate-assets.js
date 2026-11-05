import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 1. Header Logo
const headerLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 60" width="280" height="60">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
  </defs>
  <rect x="2" y="8" width="44" height="44" rx="12" fill="url(#grad1)" />
  <path d="M14 36 L24 18 L34 36 Z" fill="#ffffff" />
  <circle cx="24" cy="27" r="4" fill="#60a5fa" />
  <text x="56" y="32" font-family="'Outfit', sans-serif, system-ui" font-weight="800" font-size="22" fill="#0f172a" letter-spacing="-0.5">SUMMIT<tspan fill="#3b82f6">2026</tspan></text>
  <text x="56" y="46" font-family="'Inter', sans-serif, system-ui" font-weight="600" font-size="10" fill="#64748b" letter-spacing="2">GLOBAL INNOVATION</text>
</svg>`;

// 2. Footer Logo
const footerLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 60" width="280" height="60">
  <defs>
    <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
  </defs>
  <rect x="2" y="8" width="44" height="44" rx="12" fill="url(#grad2)" />
  <path d="M14 36 L24 18 L34 36 Z" fill="#ffffff" />
  <circle cx="24" cy="27" r="4" fill="#93c5fd" />
  <text x="56" y="32" font-family="'Outfit', sans-serif, system-ui" font-weight="800" font-size="22" fill="#ffffff" letter-spacing="-0.5">SUMMIT<tspan fill="#60a5fa">2026</tspan></text>
  <text x="56" y="46" font-family="'Inter', sans-serif, system-ui" font-weight="600" font-size="10" fill="#94a3b8" letter-spacing="2">GLOBAL INNOVATION</text>
</svg>`;

// 3. Hero 1920x938 SVG
const heroSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 938" width="1920" height="938">
  <defs>
    <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="50%" stop-color="#111827" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <radialGradient id="glow1" cx="30%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glow2" cx="80%" cy="70%" r="50%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0" />
    </radialGradient>
    <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1920" height="938" fill="url(#heroGrad)" />
  <rect width="1920" height="938" fill="url(#grid)" />
  <rect width="1920" height="938" fill="url(#glow1)" />
  <rect width="1920" height="938" fill="url(#glow2)" />
  <g opacity="0.15">
    <circle cx="300" cy="450" r="220" stroke="#60a5fa" stroke-width="2" fill="none"/>
    <circle cx="1600" cy="300" r="300" stroke="#c084fc" stroke-width="2" fill="none"/>
    <path d="M 100 800 Q 500 400 1000 650 T 1800 300" fill="none" stroke="#3b82f6" stroke-width="3"/>
  </g>
  <text x="960" y="880" font-family="sans-serif" font-size="20" fill="rgba(255,255,255,0.4)" text-anchor="middle">OPTIMIZADA PARA WEB 1920 x 938 PX</text>
</svg>`;

// Helper for card images
function makeCardSvg(title, subtitle, color1, color2, width = 640, height = 400, icon = '✦') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g_${color1.replace('#','')}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color1}" />
        <stop offset="100%" stop-color="${color2}" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g_${color1.replace('#','')})" />
    <circle cx="${width - 80}" cy="80" r="120" fill="rgba(255,255,255,0.06)" />
    <circle cx="80" cy="${height - 40}" r="90" fill="rgba(0,0,0,0.15)" />
    <text x="50" y="100" font-size="44" fill="rgba(255,255,255,0.9)">${icon}</text>
    <text x="50" y="${height - 90}" font-family="'Outfit', sans-serif, system-ui" font-weight="700" font-size="28" fill="#ffffff">${title}</text>
    <text x="50" y="${height - 50}" font-family="'Inter', sans-serif, system-ui" font-weight="500" font-size="16" fill="rgba(255,255,255,0.8)">${subtitle}</text>
  </svg>`;
}

// Helper for speaker avatars
function makeAvatarSvg(name, role, bg1, bg2) {
  const initials = name.replace(/^(Dra\.|Dr\.|Ing\.|Lic\.)\s*/, '').split(' ').slice(0, 2).map(n => n[0]).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="g_${bg1.replace('#','')}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}" />
        <stop offset="100%" stop-color="${bg2}" />
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#g_${bg1.replace('#','')})" />
    <circle cx="200" cy="170" r="90" fill="rgba(255,255,255,0.2)" />
    <text x="200" y="195" font-family="'Outfit', sans-serif" font-weight="700" font-size="72" fill="#ffffff" text-anchor="middle">${initials}</text>
    <rect x="0" y="320" width="400" height="80" fill="rgba(0,0,0,0.3)" />
    <text x="200" y="355" font-family="'Outfit', sans-serif" font-weight="700" font-size="20" fill="#ffffff" text-anchor="middle">${name}</text>
    <text x="200" y="380" font-family="'Inter', sans-serif" font-weight="500" font-size="14" fill="#cbd5e1" text-anchor="middle">${role}</text>
  </svg>`;
}

fs.writeFileSync(path.join(uploadsDir, 'logo-summit-header.svg'), headerLogoSvg);
fs.writeFileSync(path.join(uploadsDir, 'logo-summit-footer.svg'), footerLogoSvg);
fs.writeFileSync(path.join(uploadsDir, 'hero-cover.jpg'), heroSvg);
fs.writeFileSync(path.join(uploadsDir, 'video-poster.jpg'), makeCardSvg('Trailer Oficial 2026', 'Experiencia Summit', '#0f172a', '#3b82f6', 1280, 720, '▶'));

// Agenda images
fs.writeFileSync(path.join(uploadsDir, 'agenda-1.jpg'), makeCardSvg('Inteligencia Artificial', 'Agentes Autónomos & LLMs', '#1e1b4b', '#4338ca'));
fs.writeFileSync(path.join(uploadsDir, 'agenda-2.jpg'), makeCardSvg('Ciberseguridad', 'Criptografía Poscuántica', '#0f172a', '#059669'));
fs.writeFileSync(path.join(uploadsDir, 'agenda-3.jpg'), makeCardSvg('Cloud & DevOps', 'Sistemas Serverless', '#1e293b', '#2563eb'));
fs.writeFileSync(path.join(uploadsDir, 'agenda-4.jpg'), makeCardSvg('Sostenibilidad Tech', 'Cómputo Verde', '#064e3b', '#10b981'));

// Speakers
fs.writeFileSync(path.join(uploadsDir, 'speaker-1.jpg'), makeAvatarSvg('Dra. Sofia Navarro', 'VP de IA', '#3b82f6', '#1d4ed8'));
fs.writeFileSync(path.join(uploadsDir, 'speaker-2.jpg'), makeAvatarSvg('Alex Thorne', 'Chief Security Architect', '#6366f1', '#4338ca'));
fs.writeFileSync(path.join(uploadsDir, 'speaker-3.jpg'), makeAvatarSvg('Camila Morales', 'Principal Cloud Architect', '#ec4899', '#be185d'));
fs.writeFileSync(path.join(uploadsDir, 'speaker-4.jpg'), makeAvatarSvg('Dr. Julian Bernardi', 'EcoCompute Initiative', '#10b981', '#047857'));

// Broadcasts
fs.writeFileSync(path.join(uploadsDir, 'broadcast-1.jpg'), makeCardSvg('SALA A: En Vivo', 'Keynote Apertura & IA', '#dc2626', '#7f1d1d', 800, 450, '🔴'));
fs.writeFileSync(path.join(uploadsDir, 'broadcast-2.jpg'), makeCardSvg('SALA B: Transmisión', 'Criptografía y Blindaje', '#2563eb', '#1e3a8a', 800, 450, '⚡'));
fs.writeFileSync(path.join(uploadsDir, 'broadcast-3.jpg'), makeCardSvg('SALA C: Transmisión', 'Infraestructura Cloud', '#7c3aed', '#4c1d95', 800, 450, '☁️'));

console.log('Sample assets generated successfully.');
