// api/glossary-comparison.mjs
// Standalone Vercel serverless function for glossary comparison pages.
// Routes: /glossary/{a}-vs-{b} and /glossary/es/{a}-vs-{b}

const TERMS = [
  { slug: "ab-testing", nameEN: "A/B Testing", nameES: "Pruebas A/B", defEN: "A/B Testing on YouTube is the practice of comparing two versions of a video element to determine which performs better.", defES: "Las Pruebas A/B en YouTube comparan dos versiones de un elemento del video para determinar cuál funciona mejor." },
  { slug: "click-through-rate", nameEN: "Click-Through Rate (CTR)", nameES: "Tasa de Clics (CTR)", defEN: "Click-Through Rate (CTR) is the percentage of users who click on your YouTube video after seeing an impression.", defES: "La Tasa de Clics (CTR) es el porcentaje de usuarios que hacen clic en tu video después de ver una impresión." },
  { slug: "youtube-algorithm", nameEN: "YouTube Algorithm", nameES: "Algoritmo de YouTube", defEN: "The YouTube Algorithm is a recommendation system that suggests videos based on viewing behavior and preferences.", defES: "El Algoritmo de YouTube es un sistema de recomendación que sugiere videos basados en el comportamiento de visualización." },
  { slug: "watch-time", nameEN: "Watch Time", nameES: "Tiempo de Visualización", defEN: "Watch Time is the total number of minutes viewers have spent watching your videos.", defES: "El Tiempo de Visualización son los minutos totales que los espectadores pasan viendo tus videos." },
  { slug: "impressions", nameEN: "Impressions", nameES: "Impresiones", defEN: "Impressions represent how many times your video thumbnail is shown to users.", defES: "Las Impresiones representan cuántas veces se muestra la miniatura de tu video a los usuarios." },
  { slug: "audience-retention", nameEN: "Audience Retention", nameES: "Retención de Audiencia", defEN: "Audience Retention measures how well your video holds viewers' attention over time.", defES: "La Retención de Audiencia mide qué tan bien tu video mantiene la atención de los espectadores." },
  { slug: "average-view-duration", nameEN: "Average View Duration (AVD)", nameES: "Duración Media de Visualización", defEN: "AVD is the average time viewers spend watching a single video.", defES: "La Duración Media de Visualización es el tiempo promedio que los espectadores pasan viendo un video." },
  { slug: "dwell-time", nameEN: "Dwell Time", nameES: "Tiempo de Permanencia", defEN: "Dwell Time is the time a user spends on YouTube after clicking a video.", defES: "El Tiempo de Permanencia es el tiempo que un usuario pasa en YouTube después de hacer clic en un video." },
  { slug: "session-time", nameEN: "Session Time", nameES: "Tiempo de Sesión", defEN: "Session Time measures total continuous time a viewer spends on YouTube.", defES: "El Tiempo de Sesión mide el tiempo continuo total que un espectador pasa en YouTube." },
  { slug: "search-volume", nameEN: "Search Volume", nameES: "Volumen de Búsqueda", defEN: "Search Volume is the number of times a keyword is searched on YouTube monthly.", defES: "El Volumen de Búsqueda es el número de veces que se busca una palabra clave en YouTube mensualmente." },
  { slug: "keyword-difficulty", nameEN: "Keyword Difficulty", nameES: "Dificultad de Palabra Clave", defEN: "Keyword Difficulty estimates how hard it is to rank for a search term.", defES: "La Dificultad de Palabra Clave estima qué tan difícil es posicionarse para un término de búsqueda." },
  { slug: "revenue-per-mille", nameEN: "Revenue Per Mille (RPM)", nameES: "Ingresos Por Mil (RPM)", defEN: "RPM is the amount a creator earns per thousand video views.", defES: "RPM es la cantidad que un creador gana por cada mil visitas al video." },
  { slug: "cost-per-mille", nameEN: "Cost Per Mille (CPM)", nameES: "Costo Por Mil (CPM)", defEN: "CPM is the amount advertisers pay per thousand ad impressions.", defES: "CPM es la cantidad que los anunciantes pagan por cada mil impresiones de anuncios." },
  { slug: "ad-revenue", nameEN: "Ad Revenue", nameES: "Ingresos por Anuncios", defEN: "Ad Revenue is income earned from advertisements displayed on your videos.", defES: "Los Ingresos por Anuncios son las ganancias obtenidas de los anuncios mostrados en tus videos." },
  { slug: "channel-memberships", nameEN: "Channel Memberships", nameES: "Membresías del Canal", defEN: "Channel Memberships let viewers pay a monthly fee for exclusive perks.", defES: "Las Membresías del Canal permiten a los espectadores pagar una tarifa mensual por beneficios exclusivos." },
  { slug: "super-chat", nameEN: "Super Chat", nameES: "Super Chat", defEN: "Super Chat allows viewers to pay for highlighted messages during live streams.", defES: "Super Chat permite a los espectadores pagar por mensajes destacados durante transmisiones en vivo." },
  { slug: "youtube-premium", nameEN: "YouTube Premium", nameES: "YouTube Premium", defEN: "YouTube Premium is a paid subscription for ad-free viewing and background play.", defES: "YouTube Premium es una suscripción paga para visualización sin anuncios y reproducción en segundo plano." },
  { slug: "youtube-partner-program", nameEN: "YouTube Partner Program (YPP)", nameES: "Programa de Socios de YouTube", defEN: "YPP is the monetization program for creators to earn from their content.", defES: "YPP es el programa de monetización para que los creadores ganen dinero con su contenido." },
  { slug: "shorts-monetization", nameEN: "Shorts Monetization", nameES: "Monetización de Shorts", defEN: "Shorts Monetization allows creators to earn revenue from YouTube Shorts.", defES: "La Monetización de Shorts permite a los creadores ganar ingresos con los Shorts de YouTube." },
];

const SITE = 'https://yt-seo-architect.vercel.app';

const CSS = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:Outfit,Geist,sans-serif;background:#0a0a0f;color:#e2e8f0;line-height:1.6}.header{display:flex;justify-content:space-between;align-items:center;padding:.75rem 1.5rem;background:#0f0c29;border-bottom:1px solid rgba(255,255,255,.05)}.header a{color:#e2e8f0;text-decoration:none;font-weight:600}.header .cta{background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.4rem 1rem;border-radius:9999px;font-size:.85rem}main{max-width:720px;margin:0 auto;padding:2rem 1.5rem}h1{font-size:1.8rem;margin-bottom:.5rem;background:linear-gradient(135deg,#f97316,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.sub{color:#8b8b9e;font-size:.95rem;margin-bottom:2rem}.card{background:#1e1b4b;border:1px solid #2d2a5e;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem}.card h2{color:#a5b4fc;font-size:1.1rem;margin-bottom:.75rem}.card p{color:#94a3b8;line-height:1.7;margin:.5rem 0}.vs{text-align:center;font-size:1.5rem;font-weight:800;color:#f97316;padding:.5rem 0}.dw{display:flex;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.9rem}.dw:last-child{border-bottom:none}.dw .lb{color:#8b8b9e}.dw .va{color:#fb923c;font-weight:600}.dw .vb{color:#a5b4fc;font-weight:600}.ln{text-align:center;font-size:.8rem;color:#8b8b9e;margin:0 0 1.5rem}.ln a{color:#a5b4fc}.cta-box{border:1px solid #4f46e5;border-radius:12px;padding:1.5rem;text-align:center;margin:2rem 0}.cta-box a{display:inline-block;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.6rem 1.5rem;border-radius:9999px;text-decoration:none;font-weight:600}footer{text-align:center;padding:2rem;color:#6b7280;font-size:.8rem}footer a{color:#8b8b9e;text-decoration:none}';

export default function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  
  // Extract slugs from path: /glossary/{a}-vs-{b} or /glossary/es/{a}-vs-{b}
  const vsMatch = path.match(/\/([^-]+(?:-[^-]+)*)-vs-([^-]+(?:-[^-]+)*)$/);
  if (!vsMatch) {
    return res.status(404).json({ error: 'Not a comparison URL' });
  }
  
  const isES = path.includes('/es/');
  const slugA = vsMatch[1];
  const slugB = vsMatch[2];
  
  const termA = TERMS.find(t => t.slug === slugA);
  const termB = TERMS.find(t => t.slug === slugB);
  if (!termA || !termB) {
    return res.status(404).json({ error: `Terms not found: ${slugA}, ${slugB}` });
  }
  
  const aName = isES ? termA.nameES : termA.nameEN;
  const bName = isES ? termB.nameES : termB.nameEN;
  const aDef = isES ? termA.defES : termA.defEN;
  const bDef = isES ? termB.defES : termB.defEN;
  const lang = isES ? 'es' : 'en';
  const enUrl = `/glossary/${slugA}-vs-${slugB}`;
  const esUrl = `/glossary/es/${slugA}-vs-${slugB}`;
  const title = `${aName} vs ${bName} | YT SEO Architect`;
  
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title}</title>
<link rel="canonical" href="${SITE}${isES ? esUrl : enUrl}"/>
<link rel="alternate" hreflang="en" href="${SITE}${enUrl}"/>
<link rel="alternate" hreflang="es" href="${SITE}${esUrl}"/>
<link rel="alternate" hreflang="x-default" href="${SITE}${enUrl}"/>
<meta name="description" content="${isES ? 'Compara' : 'Compare'} ${aName} y ${bName} para tu estrategia de YouTube."/>
<style>${CSS}</style>
</head>
<body>
<header class="header"><a href="/">⚡ YT SEO Architect</a><a href="/tools/" class="cta">Free Tools</a></header>
<main>
<div class="ln">${isES ? `🇪🇸 Español · <a href="${enUrl}" hreflang="en">🇺🇸 English</a>` : `🇺🇸 English · <a href="${esUrl}" hreflang="es">🇪🇸 Español</a>`}</div>
<h1>${aName} vs ${bName}</h1>
<p class="sub">${isES ? 'Comparación detallada.' : 'Detailed comparison.'}</p>
<div class="card"><h2>📖 ${aName}</h2><p>${aDef}</p></div>
<div class="vs">⚡ VS ⚡</div>
<div class="card"><h2>📖 ${bName}</h2><p>${bDef}</p></div>
<div class="card"><h2>⚖️ ${isES ? 'Diferencias' : 'Differences'}</h2>
<div class="dw"><span class="lb">${isES ? 'Enfoque' : 'Focus'}</span><span class="va">${aName}</span><span class="vb">${bName}</span></div></div>
<div class="cta-box"><h3>🚀 Master YouTube SEO</h3><a href="/tools/">Try Free Tools →</a></div>
</main>
<footer><p>&copy; 2026 YT SEO Architect</p></footer>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  return res.status(200).send(html);
}
