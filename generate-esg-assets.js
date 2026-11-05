import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'public', 'uploads');

// 1. Logo Expansión ESG Header
const logoExpansionHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 60" width="320" height="60">
  <rect x="0" y="8" width="130" height="44" rx="4" fill="#ed1c24" />
  <text x="65" y="38" font-family="'Work Sans', 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="20" fill="#ffffff" text-anchor="middle" letter-spacing="-0.5">EXPANSIÓN</text>
  <line x1="145" y1="14" x2="145" y2="46" stroke="#d1d5db" stroke-width="2" />
  <text x="160" y="32" font-family="'Work Sans', sans-serif" font-weight="800" font-size="19" fill="#1a1a1a" letter-spacing="1">ESG <tspan fill="#ed1c24">SUMMIT</tspan></text>
  <text x="160" y="47" font-family="'Inter', sans-serif" font-weight="600" font-size="9" fill="#6b7280" letter-spacing="2">TIEMPOS DE DEFINICIÓN</text>
</svg>`;

// 2. Logo Expansión ESG Footer
const logoExpansionFooter = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 60" width="320" height="60">
  <rect x="0" y="8" width="130" height="44" rx="4" fill="#ed1c24" />
  <text x="65" y="38" font-family="'Work Sans', 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="20" fill="#ffffff" text-anchor="middle" letter-spacing="-0.5">EXPANSIÓN</text>
  <line x1="145" y1="14" x2="145" y2="46" stroke="#4b5563" stroke-width="2" />
  <text x="160" y="32" font-family="'Work Sans', sans-serif" font-weight="800" font-size="19" fill="#ffffff" letter-spacing="1">ESG <tspan fill="#ed1c24">SUMMIT</tspan></text>
  <text x="160" y="47" font-family="'Inter', sans-serif" font-weight="600" font-size="9" fill="#9ca3af" letter-spacing="2">TIEMPOS DE DEFINICIÓN</text>
</svg>`;

// 3. Hero Cover 1920x938 matching ESG Summit 2026
const heroCoverEsg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 938" width="1920" height="938">
  <defs>
    <linearGradient id="esgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a100d" />
      <stop offset="45%" stop-color="#052e16" />
      <stop offset="80%" stop-color="#14532d" />
      <stop offset="100%" stop-color="#064e3b" />
    </linearGradient>
    <radialGradient id="sunGlow" cx="75%" cy="30%" r="55%">
      <stop offset="0%" stop-color="#22c55e" stop-opacity="0.35" />
      <stop offset="60%" stop-color="#15803d" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#052e16" stop-opacity="0" />
    </radialGradient>
    <pattern id="topo" width="100" height="100" patternUnits="userSpaceOnUse">
      <path d="M 0 50 Q 25 20 50 50 T 100 50" fill="none" stroke="rgba(34, 197, 94, 0.08)" stroke-width="1.5"/>
      <path d="M 0 20 Q 25 80 50 20 T 100 20" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1920" height="938" fill="url(#esgGrad)" />
  <rect width="1920" height="938" fill="url(#topo)" />
  <rect width="1920" height="938" fill="url(#sunGlow)" />
  
  <g opacity="0.2">
    <circle cx="1500" cy="450" r="350" stroke="#4ade80" stroke-width="2" fill="none"/>
    <circle cx="1500" cy="450" r="280" stroke="#86efac" stroke-width="1.5" stroke-dasharray="10 15" fill="none"/>
    <circle cx="1500" cy="450" r="420" stroke="#22c55e" stroke-width="1" stroke-dasharray="5 20" fill="none"/>
    <path d="M 200 700 Q 800 300 1400 550 T 1920 200" fill="none" stroke="#22c55e" stroke-width="3"/>
  </g>

  <!-- Red Accent Brand Stripe -->
  <rect x="0" y="0" width="1920" height="8" fill="#ed1c24" />
  
  <text x="960" y="890" font-family="'Work Sans', sans-serif" font-weight="700" font-size="16" fill="rgba(255,255,255,0.45)" letter-spacing="3" text-anchor="middle">EXPANSIÓN ESG SUMMIT • 1920 x 938 WEB OPTIMIZED</text>
</svg>`;

// Helper for card images
function makeEsgCard(title, subtitle, c1, c2, w = 640, h = 400, icon = '🌱') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g_${c1.replace('#','')}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g_${c1.replace('#','')})" />
    <rect x="0" y="0" width="${w}" height="5" fill="#ed1c24" />
    <circle cx="${w - 70}" cy="70" r="100" fill="rgba(255,255,255,0.06)" />
    <text x="40" y="80" font-size="38">${icon}</text>
    <text x="40" y="${h - 85}" font-family="'Work Sans', sans-serif" font-weight="700" font-size="26" fill="#ffffff">${title}</text>
    <text x="40" y="${h - 45}" font-family="'Inter', sans-serif" font-weight="500" font-size="15" fill="rgba(255,255,255,0.85)">${subtitle}</text>
  </svg>`;
}

function makeAvatar(name, role, c1, c2) {
  const initials = name.replace(/^(Dra\.|Dr\.|Ing\.|Lic\.)\s*/, '').split(' ').slice(0, 2).map(n => n[0]).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="g_${c1.replace('#','')}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#g_${c1.replace('#','')})" />
    <circle cx="200" cy="165" r="95" fill="rgba(255,255,255,0.22)" />
    <text x="200" y="195" font-family="'Work Sans', sans-serif" font-weight="800" font-size="70" fill="#ffffff" text-anchor="middle">${initials}</text>
    <rect x="0" y="310" width="400" height="90" fill="rgba(10,16,13,0.85)" />
    <text x="200" y="348" font-family="'Work Sans', sans-serif" font-weight="700" font-size="18" fill="#ffffff" text-anchor="middle">${name}</text>
    <text x="200" y="375" font-family="'Inter', sans-serif" font-weight="500" font-size="13" fill="#86efac" text-anchor="middle">${role}</text>
  </svg>`;
}

fs.writeFileSync(path.join(uploadsDir, 'logo-expansion-esg.svg'), logoExpansionHeader);
fs.writeFileSync(path.join(uploadsDir, 'logo-expansion-esg-footer.svg'), logoExpansionFooter);
fs.writeFileSync(path.join(uploadsDir, 'cover-esg-1920x938.jpg'), heroCoverEsg);

fs.writeFileSync(path.join(uploadsDir, 'agenda-esg-1.jpg'), makeEsgCard('Economía Circular', 'Territorio & Pasivos Ambientales', '#052e16', '#15803d', 640, 400, '♻️'));
fs.writeFileSync(path.join(uploadsDir, 'agenda-esg-2.jpg'), makeEsgCard('Transparencia ASG', 'Rendición de Cuentas BMV', '#1e293b', '#0f172a', 640, 400, '📊'));
fs.writeFileSync(path.join(uploadsDir, 'agenda-esg-3.jpg'), makeEsgCard('Restauración', 'Biodiversidad y Alianzas', '#064e3b', '#047857', 640, 400, '🌳'));
fs.writeFileSync(path.join(uploadsDir, 'agenda-esg-4.jpg'), makeEsgCard('Finanzas & IA', 'Bonos Verdes y Datos', '#1e1b4b', '#1e3a8a', 640, 400, '⚡'));

fs.writeFileSync(path.join(uploadsDir, 'spk-samaniego.jpg'), makeAvatar('José Luis Samaniego', 'Subsecretario SEMARNAT', '#065f46', '#047857'));
fs.writeFileSync(path.join(uploadsDir, 'spk-barajas.jpg'), makeAvatar('Nalleli Barajas', 'Directora Sostenibilidad BMV', '#1e3a8a', '#1e40af'));
fs.writeFileSync(path.join(uploadsDir, 'spk-bonilla.jpg'), makeAvatar('Mauricio Bonilla', 'Director Pacto Global México', '#374151', '#1f2937'));

fs.writeFileSync(path.join(uploadsDir, 'bc-esg-1.jpg'), makeEsgCard('Sala 1: Transmisión Inaugural', 'Economía Circular en Directo', '#991b1b', '#b91c1c', 800, 450, '🔴'));
fs.writeFileSync(path.join(uploadsDir, 'bc-esg-2.jpg'), makeEsgCard('Sala 2: Transmisión BMV', 'Mercados Sostenibles', '#1e3a8a', '#1e40af', 800, 450, '📺'));
fs.writeFileSync(path.join(uploadsDir, 'bc-esg-3.jpg'), makeEsgCard('Sala 3: Finanzas Verdes', 'Descarbonización e IA', '#065f46', '#047857', 800, 450, '⚡'));

console.log('ESG assets generated successfully.');
