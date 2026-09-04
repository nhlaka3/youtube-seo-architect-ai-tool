// Generate dashboard-hero.svg (1200x750) — dark Cyber-Luxe dashboard mockup
const fs = require('fs');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0b10"/>
      <stop offset="100%" stop-color="#0d1117"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00f2ff"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="orange" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#fb923c"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="12" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="750" fill="url(#bg)"/>
  <circle cx="1050" cy="120" r="260" fill="#00f2ff" opacity="0.05"/>
  <circle cx="120" cy="620" r="220" fill="#2563eb" opacity="0.06"/>

  <!-- Top nav bar -->
  <rect x="0" y="0" width="1200" height="64" fill="#0d1117" opacity="0.9"/>
  <circle cx="32" cy="32" r="14" fill="none" stroke="#00f2ff" stroke-width="3"/>
  <path d="M28 38 L38 32 L28 26 Z" fill="#00f2ff"/>
  <text x="60" y="40" font-family="Geist, Arial, sans-serif" font-size="20" font-weight="700" fill="#f8fafc">YT SEO <tspan fill="#00f2ff">Architect</tspan></text>
  <text x="930" y="40" font-family="Geist, Arial, sans-serif" font-size="15" fill="#94a3b8">Tools</text>
  <text x="1000" y="40" font-family="Geist, Arial, sans-serif" font-size="15" fill="#94a3b8">Blog</text>
  <text x="1068" y="40" font-family="Geist, Arial, sans-serif" font-size="15" fill="#94a3b8">Glossary</text>
  <rect x="1120" y="16" width="56" height="32" rx="8" fill="url(#brand)"/>
  <text x="1148" y="38" font-family="Geist, Arial, sans-serif" font-size="13" font-weight="700" fill="#06121f" text-anchor="middle">Free</text>

  <!-- Sidebar -->
  <rect x="0" y="64" width="200" height="686" fill="#0a0b10" opacity="0.6"/>
  <g font-family="Geist, Arial, sans-serif" font-size="14">
    <rect x="12" y="88" width="176" height="36" rx="8" fill="#00f2ff" opacity="0.12"/>
    <text x="28" y="112" fill="#00f2ff" font-weight="600">📊 Dashboard</text>
    <text x="28" y="158" fill="#64748b">🔍 Keyword Research</text>
    <text x="28" y="198" fill="#64748b">🏷️ Tag Generator</text>
    <text x="28" y="238" fill="#64748b">✍️ Title Optimizer</text>
    <text x="28" y="278" fill="#64748b">📝 Description Writer</text>
    <text x="28" y="318" fill="#64748b">🖼️ Thumbnail Analyzer</text>
    <text x="28" y="358" fill="#64748b">📈 Analytics</text>
    <text x="28" y="398" fill="#64748b">🚀 Growth Tools</text>
  </g>

  <!-- Main content -->
  <!-- Stat cards -->
  <g>
    <rect x="228" y="88" width="210" height="100" rx="14" fill="#111827" stroke="#1f2937"/>
    <text x="248" y="120" font-family="Geist, Arial, sans-serif" font-size="13" fill="#94a3b8">Keyword Score</text>
    <text x="248" y="156" font-family="Geist, Arial, sans-serif" font-size="28" font-weight="800" fill="#00f2ff">92<span font-size="16" fill="#64748b">/100</span></text>

    <rect x="456" y="88" width="210" height="100" rx="14" fill="#111827" stroke="#1f2937"/>
    <text x="476" y="120" font-family="Geist, Arial, sans-serif" font-size="13" fill="#94a3b8">CTR</text>
    <text x="476" y="156" font-family="Geist, Arial, sans-serif" font-size="28" font-weight="800" fill="#f97316">6.8%<span font-size="16" fill="#64748b">  ↑1.2%</span></text>

    <rect x="684" y="88" width="210" height="100" rx="14" fill="#111827" stroke="#1f2937"/>
    <text x="704" y="120" font-family="Geist, Arial, sans-serif" font-size="13" fill="#94a3b8">Watch Time</text>
    <text x="704" y="156" font-family="Geist, Arial, sans-serif" font-size="28" font-weight="800" fill="#34d399">4,210<span font-size="16" fill="#64748b"> hrs</span></text>

    <rect x="912" y="88" width="220" height="100" rx="14" fill="url(#brand)" opacity="0.95"/>
    <text x="932" y="120" font-family="Geist, Arial, sans-serif" font-size="13" fill="#06121f" opacity="0.8">AI Credits</text>
    <text x="932" y="156" font-family="Geist, Arial, sans-serif" font-size="28" font-weight="800" fill="#ffffff">Unlimited</text>
  </g>

  <!-- Main panel: keyword research -->
  <rect x="228" y="210" width="470" height="300" rx="16" fill="#111827" stroke="#1f2937"/>
  <text x="252" y="244" font-family="Geist, Arial, sans-serif" font-size="16" font-weight="700" fill="#f8fafc">🔑 Golden Keywords</text>
  <rect x="252" y="262" width="420" height="42" rx="10" fill="#0d1117" stroke="#1f2937"/>
  <text x="272" y="289" font-family="Geist, Arial, sans-serif" font-size="14" fill="#64748b">how to grow youtube channel in 2026</text>
  <rect x="592" y="262" width="80" height="42" rx="10" fill="url(#brand)"/>
  <text x="632" y="289" font-family="Geist, Arial, sans-serif" font-size="13" font-weight="700" fill="#06121f" text-anchor="middle">Search</text>

  <!-- Keyword rows -->
  <g font-family="Geist, Arial, sans-serif" font-size="13">
    <rect x="252" y="322" width="420" height="34" rx="8" fill="#0d1117"/>
    <text x="268" y="344" fill="#e2e8f0">youtube growth strategy 2026</text>
    <text x="580" y="344" fill="#00f2ff" font-weight="700" text-anchor="end">88</text>
    <text x="596" y="344" fill="#34d399" font-weight="700">Low</text>
    <rect x="252" y="364" width="420" height="34" rx="8" fill="#0d1117"/>
    <text x="268" y="386" fill="#e2e8f0">how to grow a youtube channel fast</text>
    <text x="580" y="386" fill="#00f2ff" font-weight="700" text-anchor="end">84</text>
    <text x="596" y="386" fill="#34d399" font-weight="700">Low</text>
    <rect x="252" y="406" width="420" height="34" rx="8" fill="#0d1117"/>
    <text x="268" y="428" fill="#e2e8f0">small youtube channel growth tips</text>
    <text x="580" y="428" fill="#f59e0b" font-weight="700" text-anchor="end">71</text>
    <text x="596" y="428" fill="#f59e0b" font-weight="700">Med</text>
    <rect x="252" y="448" width="420" height="34" rx="8" fill="#0d1117"/>
    <text x="268" y="470" fill="#e2e8f0">youtube algorithm secrets 2026</text>
    <text x="580" y="470" fill="#ef4444" font-weight="700" text-anchor="end">52</text>
    <text x="596" y="470" fill="#ef4444" font-weight="700">High</text>
  </g>

  <!-- Right panel: tag generator -->
  <rect x="716" y="210" width="416" height="300" rx="16" fill="#111827" stroke="#1f2937"/>
  <text x="740" y="244" font-family="Geist, Arial, sans-serif" font-size="16" font-weight="700" fill="#f8fafc">🏷️ AI Tag Generator</text>
  <g font-family="Geist, Arial, sans-serif" font-size="12.5">
    <rect x="740" y="262" width="368" height="30" rx="8" fill="#0d1117"/>
    <text x="756" y="282" fill="#cbd5e1">youtube growth</text>
    <rect x="740" y="300" width="368" height="30" rx="8" fill="#0d1117"/>
    <text x="756" y="320" fill="#cbd5e1">youtube growth strategy 2026</text>
    <rect x="740" y="338" width="368" height="30" rx="8" fill="#0d1117"/>
    <text x="756" y="358" fill="#cbd5e1">how to grow youtube channel</text>
    <rect x="740" y="376" width="368" height="30" rx="8" fill="#0d1117"/>
    <text x="756" y="396" fill="#cbd5e1">youtube algorithm tips</text>
    <rect x="740" y="414" width="368" height="30" rx="8" fill="#0d1117"/>
    <text x="756" y="434" fill="#cbd5e1">small channel growth</text>
    <rect x="740" y="452" width="368" height="34" rx="10" fill="url(#orange)" filter="url(#glow)"/>
    <text x="924" y="474" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">✨ Generate Tags — Free</text>
  </g>

  <!-- Bottom CTA strip -->
  <rect x="228" y="532" width="904" height="70" rx="16" fill="url(#brand)" opacity="0.12" stroke="#00f2ff" stroke-opacity="0.3"/>
  <text x="260" y="566" font-family="Geist, Arial, sans-serif" font-size="17" font-weight="700" fill="#00f2ff">90+ Free AI Tools · Unlimited Credits · No Card · No Catch</text>
  <text x="260" y="590" font-family="Geist, Arial, sans-serif" font-size="13" fill="#94a3b8">The same power as vidIQ &amp; TubeBuddy — without the $50/month.</text>
  <rect x="1030" y="550" width="84" height="36" rx="10" fill="url(#brand)"/>
  <text x="1072" y="573" font-family="Geist, Arial, sans-serif" font-size="14" font-weight="800" fill="#06121f" text-anchor="middle">Start Free</text>

  <!-- Bottom stats -->
  <g font-family="Geist, Arial, sans-serif">
    <text x="228" y="646" font-size="13" fill="#64748b">Trusted by creators —</text>
    <text x="228" y="672" font-size="13" fill="#64748b">0.0% card decline ·</text>
    <text x="228" y="698" font-size="13" fill="#64748b">100% data privacy</text>
    <circle cx="620" cy="650" r="4" fill="#00f2ff"/>
    <text x="634" y="655" font-size="13" fill="#94a3b8">5,000+ active creators</text>
    <circle cx="620" cy="680" r="4" fill="#34d399"/>
    <text x="634" y="685" font-size="13" fill="#94a3b8">12.4M tags generated</text>
    <circle cx="620" cy="710" r="4" fill="#f97316"/>
    <text x="634" y="715" font-size="13" fill="#94a3b8">38% avg CTR improvement</text>
  </g>
</svg>`;

fs.writeFileSync('public/dashboard-hero.svg', svg);
console.log('SVG written');
