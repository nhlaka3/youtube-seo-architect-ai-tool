#!/usr/bin/env node
/**
 * scripts/generate-glossary-categories.mjs
 *
 * Generates combinatorial category landing pages for the glossary.
 * Each category page is a rich index with:
 *   - Category overview + meta description
 *   - Term cluster groupings (e.g., "Beginner Terms", "Advanced Concepts")
 *   - Cross-category "Related categories" links
 *   - Schema.org CollectionPage markup
 *   - Internal links to blog posts in the same category
 *
 * Outputs to public/glossary/category/{slug}.html
 *
 * Usage:
 *   node scripts/generate-glossary-categories.mjs
 *   node scripts/generate-glossary-categories.mjs --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const DATA_FILE = resolve(PROJECT, 'scripts/glossary-data.json');
const PT_DATA_FILE = resolve(PROJECT, 'scripts/glossary-data-pt.json');
const OUTPUT_DIR = resolve(PROJECT, 'public/glossary/category');
const PT_OUTPUT_DIR = resolve(PROJECT, 'public/glossary/pt/category');
const BLOG_DIR = resolve(PROJECT, 'public/blog');

const DRY_RUN = process.argv.includes('--dry-run');
const PT_MODE = process.argv.includes('--pt');

const CATEGORY_META = {
  'analytics': {
    name: 'Analytics',
    emoji: '📊',
    description: 'Understand your YouTube data with these analytics metrics and KPIs. Learn what each metric means, how to track it, and how to use the data to improve your content strategy and channel growth.',
    keywords: 'YouTube analytics metrics, video performance data, channel insights, audience analytics, content measurement',
  },
  'algorithm': {
    name: 'Algorithm',
    emoji: '🤖',
    description: 'How the YouTube algorithm works in 2026: ranking signals, recommendation systems, search ranking factors, and the strategies you need to work with the algorithm — not against it.',
    keywords: 'YouTube algorithm explained, ranking signals, recommendation system, video discovery, search ranking',
  },
  'seo-optimization': {
    name: 'SEO Optimization',
    emoji: '🔍',
    description: 'YouTube SEO strategies and techniques to rank higher in search results. From keyword research to title optimization, thumbnail design to transcript SEO — everything you need to get found.',
    keywords: 'YouTube SEO, video optimization, keyword research, title optimization, thumbnail tips, tag strategy',
  },
  'monetization': {
    name: 'Monetization',
    emoji: '💰',
    description: 'Make money on YouTube: ad revenue, channel memberships, Super Chat, affiliate marketing, sponsorships, and more. Understand YouTube Partner Program requirements and maximize your earnings per view.',
    keywords: 'YouTube monetization, ad revenue, channel memberships, Super Chat, affiliate marketing, sponsorships',
  },
  'content-strategy': {
    name: 'Content Strategy',
    emoji: '📝',
    description: 'Plan, create, and grow with a winning YouTube content strategy. Learn about content pillars, video formats, audience building, content calendars, and data-driven content planning.',
    keywords: 'YouTube content strategy, video planning, channel growth, content pillars, audience building',
  },
  'youtube-features': {
    name: 'YouTube Features',
    emoji: '⚙️',
    description: 'Master YouTube\'s built-in features — from end screens and cards to community posts, playlists, and live streaming. Use every tool the platform offers to grow your channel.',
    keywords: 'YouTube features guide, end screens, cards, playlists, community posts, live streaming tools',
  },
};

const PT_CATEGORY_META = {
  'analytics': {
    name: 'Análises',
    emoji: '📊',
    description: 'Entenda os dados do seu canal do YouTube com estas métricas e KPIs de análise. Aprenda o que cada métrica significa, como monitorá-la e como usá-la para melhorar sua estratégia de conteúdo e o crescimento do seu canal.',
    keywords: 'analítica de YouTube, métricas de rendimiento de video, datos del canal, analítica de audiencia, medición de contenido',
  },
  'algorithm': {
    name: 'Algoritmo',
    emoji: '🤖',
    description: 'Como funciona o algoritmo do YouTube em 2026: sinais de posicionamento, sistemas de recomendação, fatores de busca e as estratégias para trabalhar com o algoritmo — não contra ele.',
    keywords: 'algoritmo de YouTube explicado, señales de ranking, sistema de recomendación, descubrimiento de videos, ranking de búsqueda',
  },
  'seo-optimization': {
    name: 'Otimização de SEO',
    emoji: '🔍',
    description: 'Estratégias e técnicas de SEO para YouTube que ajudam você a posicionar melhor nos resultados de busca. Desde pesquisa de palavras-chave até otimização de títulos, miniaturas e transcrições.',
    keywords: 'SEO de YouTube, optimización de video, investigación de palabras clave, optimización de títulos, consejos de miniaturas',
  },
  'monetization': {
    name: 'Monetização',
    emoji: '💰',
    description: 'Ganhe dinheiro no YouTube: receita de anúncios, membros do canal, Super Chat, marketing de afiliados e patrocínios. Entenda os requisitos do Programa de Parceiros e maximize seus ganhos por visualização.',
    keywords: 'monetización de YouTube, ingresos por anuncios, membresías del canal, Super Chat, marketing de afiliados',
  },
  'content-strategy': {
    name: 'Estratégia de Conteúdo',
    emoji: '📝',
    description: 'Planeje, crie e cresça com uma estratégia de conteúdo vencedora para o YouTube. Aprenda sobre pilares de conteúdo, formatos de vídeo, construção de público e planejamento baseado em dados.',
    keywords: 'estrategia de contenido para YouTube, planificación de video, crecimiento del canal, pilares de contenido',
  },
  'youtube-features': {
    name: 'Recursos do YouTube',
    emoji: '⚙️',
    description: 'Domine os recursos integrados do YouTube — desde telas finais e cards até publicações da comunidade, playlists e transmissões ao vivo.',
    keywords: 'guía de funciones de YouTube, pantallas finales, tarjetas, listas de reproducción, transmisiones en vivo',
  },
};

function loadData() {
  const file = PT_MODE ? PT_DATA_FILE : DATA_FILE;
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function getCategoryEmoji(slug) {
  const meta = PT_MODE ? PT_CATEGORY_META : CATEGORY_META;
  return meta[slug]?.emoji || '📖';
}

function getCategoryName(slug) {
  const meta = PT_MODE ? PT_CATEGORY_META : CATEGORY_META;
  return meta[slug]?.name || slug;
}

// ── Cluster terms into beginner / intermediate / advanced ────

function clusterTerms(terms) {
  // Simple heuristic: shorter terms = broader = beginner-friendly
  const sorted = [...terms].sort((a, b) => a.term.length - b.term.length);
  const total = sorted.length;

  const clusters = {
    'Essential': sorted.slice(0, Math.max(3, Math.ceil(total * 0.25))),
    'Core Concepts': sorted.slice(Math.max(3, Math.ceil(total * 0.25)), Math.ceil(total * 0.65)),
    'Advanced Topics': sorted.slice(Math.ceil(total * 0.65)),
  };

  return clusters;
}

// ── Detect which blog posts relate to a category ─────────────

function getRelatedBlogsForCategory(categorySlug) {
  if (!existsSync(BLOG_DIR)) return [];

  const blogFiles = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && !f.startsWith('_'));
  const categoryKeywords = {
    'analytics': ['analytics', 'metric', 'data', 'track', 'measure', 'impression', 'ctr', 'retention', 'views', 'watch time'],
    'algorithm': ['algorithm', 'ranking', 'recommend', 'search', 'discovery', 'rank'],
    'seo-optimization': ['seo', 'optimize', 'keyword', 'title', 'thumbnail', 'tag', 'description', 'transcript'],
    'monetization': ['monetiz', 'revenue', 'earning', 'ad', 'sponsor', 'affiliate', 'membership', 'super chat'],
    'content-strategy': ['content', 'strategy', 'growth', 'planning', 'audience', 'niche', 'evergreen'],
    'youtube-features': ['shorts', 'live', 'community', 'playlist', 'end screen', 'card', 'feature'],
  };

  const keywords = categoryKeywords[categorySlug] || [];

  return blogFiles
    .map(f => {
      const slug = f.replace('.html', '');
      const title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const lowerFile = f.toLowerCase();
      const score = keywords.filter(kw => lowerFile.includes(kw)).length;
      return { slug, title, score };
    })
    .filter(b => b.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ── Generate a single category page ──────────────────────────

const PT_CATEGORY_GUIDES = {
  'analytics': { title: '📊 Como Trabalhar com as Analíticas', how: 'Os dados são o painel de controle do seu canal: cada métrica desta página decide algo. As impressões mostram se o YouTube está testando seu conteúdo; o CTR mostra se o título e a miniatura ganham o clique; a duração média de exibição mostra se o vídeo cumpre a promessa; a retenção mostra exatamente em que segundo você perdeu as pessoas.', items: ['Revise suas analíticas uma vez por semana: impressões, CTR e retenção dos seus últimos 5 vídeos — uma ação por dado.', 'Diagnostique pelo par de métricas: poucas impressões = problema de autoridade/nicho, CTR baixo = problema de embalagem, retenção baixa = problema de gancho.', 'Compare-se com o percentil do seu nicho antes de julgar um número.'], rule: 'Regra: se você não sabe qual métrica está doendo, melhorar a duração média de exibição é quase sempre o melhor começo.' },
  'algorithm': { title: '🤖 Como Trabalhar com o Algoritmo', how: 'O algoritmo é uma máquina que aprende com o comportamento dos espectadores: não há truques, só sinais. Retenção, CTR e tempo de sessão são as três alavancas reais.', items: ['Priorize retenção: um vídeo que segura 60%+ do público deixa um sinal forte para todo o sistema de recomendação.', 'Depois a embalagem (CTR): um vídeo com boa retenção mas título/miniatura fracos não é testado em escala.', 'Depois a sessão: termine com next-watch (cards, end screens, playlists) para o sugerido recomendar seu canal inteiro.'], rule: 'Regra: qualquer "estratégia de algoritmo" que exija enganar o espectador está errada. O algoritmo é um espelho — melhore o reflexo.' },
  'seo-optimization': { title: '🔍 Como Fazer SEO no YouTube', how: 'SEO no YouTube = facilitar para o buscador e o recomendador entenderem sobre o que é o vídeo e provar que ele entrega. Palavra-chave no título, na primeira linha da descrição e nos primeiros 30 segundos de áudio: os três pontos mais fortes.', items: ['Coloque a palavra-chave principal no título, na primeira linha da descrição e na fala dos primeiros 30 segundos.', 'Escreva uma descrição que conte o contrato do conteúdo: o que promete, para quem é e quando cada seção acontece (capítulos).', 'Atualize mensalmente seus 10 vídeos com melhor desempenho: descrições, tags, end screens e capítulos.'], rule: 'Regra: se o vídeo não casa com a intenção de busca do usuário, ele não vai rankear. Corrija a intenção antes de adicionar mais palavras-chave.' },
  'monetization': { title: '💰 Como Ganhar Dinheiro no YouTube', how: 'A monetização começa no Programa de Parceiros (1.000 inscritos + 4.000 horas de exibição ou equivalentes de Shorts) e cresce com alavancas que você controla: vídeos de 8+ minutos liberam mid-rolls, a audiência define o CPM e a diversificação estabiliza a receita.', items: ['Verifique o status de monetização e avisos de política no Studio.', 'Ative mid-rolls em vídeos de 8+ minutos, apenas em pausas naturais.', 'Diversifique: membros, Super Chat, afiliados e patrocínios.'], rule: 'Regra: o RPM (receita por 1.000 visualizações) é o número a otimizar, não as views. 100k views num nicho de CPM baixo valem menos que 5k num nicho alto.' },
  'content-strategy': { title: '📝 Estratégia de Conteúdo', how: 'Estratégia é a disciplina de decidir o que criar antes de criar: quais temas servem o seu nicho, quais formatos você domina e qual cadência você consegue sustentar. Os termos desta página são as unidades de planejamento.', items: ['Defina 3-5 pilares de conteúdo e publique dentro deles — pilares acumulam autoridade e buscas.', 'Mantenha 60-70% de conteúdo perene e 30-40% atemporal; perene rende por meses, tendências rendem rápido.', 'Produza em lote no pilar que já performa e use playlists para transformar vídeos avulsos em sessões.'], rule: 'Regra: consistência vence hits isolados. Dois vídeos por semana por 6 meses superam um vídeo perfeito por mês.' },
  'youtube-features': { title: '⚙️ Use os Recursos Nativos do YouTube', how: 'End screens, cards, playlists, capítulos, posts da comunidade, lives e Shorts são ativos de distribuição que já existem — sem custo de produção, só configuração. Recursos que estendem alcance, recursos que estendem tempo de exibição e recursos que estendem engajamento.', items: ['Adicione end screens e cards em todo vídeo em pontos estratégicos — o clique de "próximo vídeo" é tempo de sessão puro.', 'Transforme séries em playlists com ordem clara — playlists conduzem a uma sessão, não a um vídeo avulso.', 'Publique na comunidade entre uploads: enquetes, bastidores, anúncios.'], rule: 'Regra: o melhor recurso é o que amplifica conteúdo que você já tem: playlists + end screens + capítulos convertem vídeos em sessões.' },
};

function generateCategoryPage(categorySlug, termsInCategory, allTerms, totalTerms, allCategories) {
  const meta = (PT_MODE ? PT_CATEGORY_META : CATEGORY_META)[categorySlug] || { name: categorySlug, emoji: '📖', description: '', keywords: '' };
  const guide = PT_MODE ? PT_CATEGORY_GUIDES[categorySlug] : undefined;
  const clusters = clusterTerms(termsInCategory);
  const relatedBlogs = getRelatedBlogsForCategory(categorySlug);

  const termBase = PT_MODE ? '/glossary/pt' : '/glossary';
  const catBase = PT_MODE ? '/glossary/pt/category' : '/glossary/category';
  const lang = PT_MODE ? 'es' : 'en';
  const langLabel = PT_MODE ? '🇺🇸 English' : '🇪🇸 Español';
  const langHref = PT_MODE ? `/glossary/category/${categorySlug}` : `/glossary/pt/category/${categorySlug}`;
  const otherLangHref = langHref;

  const clusterLabels = PT_MODE
    ? { 'Essential': 'Esenciales', 'Core Concepts': 'Conceptos Clave', 'Advanced Topics': 'Temas Avanzados' }
    : {};

  // Term cards by cluster
  let bodyHTML = '';
  for (const [clusterName, clusterTerms] of Object.entries(clusters)) {
    if (clusterTerms.length === 0) continue;
    const label = clusterLabels[clusterName] || clusterName;
    const cards = clusterTerms.map(t => {
      const termName = PT_MODE ? (t.term_es || t.term) : t.term;
      const def = PT_MODE ? (t.shortDefinition_es || t.shortDefinition) : t.shortDefinition;
      return `
      <div class="glossary-card">
        <a href="${termBase}/${t.slug}"><h3>${termName}</h3></a>
        <p>${def.substring(0, 150)}...</p>
        ${t.relatedTerms && t.relatedTerms.length > 0
          ? `<div class="tag-group"><strong>${PT_MODE ? 'Relacionados' : 'Related'}:</strong> ${t.relatedTerms.slice(0, 3).map(s => {
              const rt = allTerms.find(t2 => t2.slug === s);
              const rtName = rt ? (PT_MODE ? (rt.term_es || rt.term) : rt.term) : '';
              return rt ? `<a href="${termBase}/${rt.slug}" class="tag">${rtName}</a>` : '';
            }).filter(Boolean).join(' ')}</div>`
          : ''}
      </div>`;
    }).join('');

    bodyHTML += `
    <section class="cluster">
      <h2 class="cluster-title">${label} <span class="count">(${clusterTerms.length} ${PT_MODE ? 'termos' : 'terms'})</span></h2>
      <div class="card-grid">
        ${cards}
      </div>
    </section>`;
  }

  // Related blogs section
  let blogSection = '';
  if (relatedBlogs.length > 0) {
    blogSection = `
    <section class="related-blogs">
      <h2>${PT_MODE ? '📝 Artigos de Blog Relacionados' : '📝 Related Blog Posts'}</h2>
      <div class="blog-list">
        ${relatedBlogs.map(b => `<a href="/blog/${b.slug}" class="blog-link">📖 ${b.title}</a>`).join('\n        ')}
      </div>
    </section>`;
  }

  // Cross-category navigation
  const otherCategories = allCategories
    .filter(c => c !== categorySlug)
    .map(c => `<a href="${catBase}/${c}" class="cross-cat">${getCategoryEmoji(c)} ${getCategoryName(c)}</a>`)
    .join('\n          ');

  // Category guide section (pillar prose)
  let guideSection = '';
  if (guide) {
    const blocks = Object.entries(guide)
      .filter(([k]) => k !== 'title')
      .map(([k, v]) => Array.isArray(v)
        ? `<ul>${v.map(x => `<li>${x}</li>`).join('')}</ul>`
        : k === 'rule' ? `<p class="guide-rule"><strong>${v.split(':')[0]}:</strong>${v.slice(v.indexOf(':') + 1)}</p>` : `<p>${v}</p>`)
      .join('\n    ');
    guideSection = `
    <section class="category-guide">
      <h2>${guide.title}</h2>
      ${blocks}
    </section>`;
  }

  // Build HTML
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="/logo.svg" type="image/svg+xml" />
  <title>${meta.emoji} ${meta.name} — ${PT_MODE ? 'Termos do Glossário de SEO do YouTube' : 'YouTube SEO Glossary Terms'} | YT SEO Architect</title>
  <meta name="description" content="${meta.description.substring(0, 160)}" />
  <meta name="keywords" content="${meta.keywords}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://yt-seo-architect.vercel.app${catBase}/${categorySlug}" />
  <link rel="alternate" hreflang="en" href="https://yt-seo-architect.vercel.app/glossary/category/${categorySlug}" />
  <link rel="alternate" hreflang="es" href="https://yt-seo-architect.vercel.app/glossary/es/category/${categorySlug}" />
  <link rel="alternate" hreflang="pt" href="https://yt-seo-architect.vercel.app/glossary/pt/category/${categorySlug}" />
  <link rel="alternate" hreflang="x-default" href="https://yt-seo-architect.vercel.app/glossary/category/${categorySlug}" />

  <meta property="og:title" content="${meta.name} — ${PT_MODE ? 'Glossário de SEO do YouTube' : 'YouTube SEO Glossary'}" />
  <meta property="og:description" content="${meta.description.substring(0, 160)}" />
  <meta property="og:url" content="https://yt-seo-architect.vercel.app${catBase}/${categorySlug}" />
  <meta property="og:type" content="website" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "${PT_MODE ? `Glossário de ${meta.name}` : `${meta.name} YouTube SEO Glossary`}",
    "description": "${meta.description.substring(0, 200)}",
    "url": "https://yt-seo-architect.vercel.app${catBase}/${categorySlug}",
    "about": {
      "@type": "Thing",
      "name": "${meta.name}"
    }
  }
  </script>

  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3831668789026424" crossorigin="anonymous"></script>
  <link rel="stylesheet" href="/design-tokens.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/utilities.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/nav.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/blog-article.css" media="print" onload="this.media='all'">
  <noscript>
    <link rel="stylesheet" href="/design-tokens.css">
    <link rel="stylesheet" href="/utilities.css">
    <link rel="stylesheet" href="/nav.css">
    <link rel="stylesheet" href="/blog-article.css">
  </noscript>
  
  <style>
    body{font-display:swap;font-family:'Outfit','Geist',-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0f;color:#e2e8f0}
    .hero{background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);padding:3rem 1.5rem;text-align:center;margin-bottom:2rem;border-radius:1rem}
    .hero h1{font-size:2rem;margin:0 0 .5rem;color:#fff}
    .hero p{color:#c4b5fd;max-width:600px;margin:0 auto}
    .hero .stat{margin-top:1rem;display:inline-block;background:rgba(99,102,241,.3);color:#a5b4fc;padding:.4rem 1.2rem;border-radius:9999px;font-size:.9rem}
    .lang-switch{display:inline-block;margin-top:.75rem;font-size:.8rem;color:#a5b4fc;text-decoration:none;border:1px solid #4f46e5;padding:.3rem 1rem;border-radius:9999px;transition:all .2s}
    .lang-switch:hover{background:#312e81;color:#fff}
    .cluster{margin-bottom:2.5rem}
    .cluster-title{font-size:1.3rem;color:#e0e7ff;margin:0 0 1rem;display:flex;align-items:center;gap:.5rem}
    .cluster-title .count{font-size:.85rem;color:#8b8b9e;font-weight:400}
    .card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
    .glossary-card{background:#1e1b4b;border:1px solid #2d2a5e;border-radius:.75rem;padding:1.25rem;transition:all .2s}
    .glossary-card:hover{background:#312e81;transform:translateY(-2px);border-color:#6366f1}
    .glossary-card h3{color:#a5b4fc;margin:0 0 .5rem;font-size:1rem}
    .glossary-card p{color:#8b8b9e;font-size:.85rem;margin:0 0 .75rem;line-height:1.5}
    .tag-group{font-size:.8rem;color:#6b7280}
    .tag-group .tag{display:inline-block;background:rgba(99,102,241,.2);color:#a5b4fc;padding:.15rem .5rem;border-radius:9999px;margin-right:.25rem;font-size:.75rem;text-decoration:none;transition:all .2s}
    .tag-group .tag:hover{background:rgba(99,102,241,.5)}
    .cross-cats{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;margin-bottom:2rem}
    .cross-cat{background:#1e1b4b;color:#a5b4fc;padding:.4rem 1rem;border-radius:9999px;font-size:.85rem;text-decoration:none;transition:all .2s}
    .cross-cat:hover{background:#312e81;color:#fff;transform:translateY(-1px)}
    .related-blogs h2{font-size:1.1rem;color:#e0e7ff;margin-bottom:1rem}
    .blog-list{display:flex;flex-wrap:wrap;gap:.75rem}
    .blog-link{display:inline-block;background:#1e1b4b;color:#a5b4fc;padding:.5rem 1rem;border-radius:.5rem;text-decoration:none;font-size:.85rem;transition:all .2s}
    .blog-link:hover{background:#312e81;color:#fff}
    .back-link{display:inline-block;margin-bottom:1.5rem;color:#8b8b9e;text-decoration:none;font-size:.9rem}
    .back-link:hover{color:#a5b4fc}
    .category-guide{max-width:760px;margin:0 auto 2.5rem;padding:0 1.5rem}
    .category-guide h2{color:#e0e7ff;font-size:1.35rem;margin-bottom:.75rem}
    .category-guide p,.category-guide li{color:#8b8b9e;line-height:1.7;font-size:.95rem}
    .category-guide ul{padding-left:1.25rem;margin:.5rem 0 1rem}
    .category-guide li{margin-bottom:.5rem}
    .category-guide .guide-rule{color:#a5b4fc;border-left:3px solid #6366f1;padding-left:.75rem;margin-top:1rem}
    .cta-box{border:1px solid #4f46e5;margin:2rem 0}
    @media(max-width:640px){.hero{padding:2rem 1rem}.hero h1{font-size:1.5rem}.card-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header class="header">
    <a href="/">⚡ YT SEO Architect</a>
    <a href="${termBase}/" style="color:#a5b4fc">📖 ${PT_MODE ? 'Glossário' : 'Glossary'}</a>
    <a href="/tools/" class="cta">${PT_MODE ? 'Ferramentas Grátis' : 'Free Tools'}</a>
  </header>

  <main>
    <a href="${termBase}/" class="back-link">← ${PT_MODE ? 'Voltar para Todos os Termos do Glossário' : 'Back to All Glossary Terms'}</a>

    <div class="hero">
      <h1>${meta.emoji} ${PT_MODE ? `Glossário de ${meta.name}` : `${meta.name} Glossary`}</h1>
      <p>${meta.description}</p>
      <div class="stat">${termsInCategory.length} ${PT_MODE ? 'termos' : 'terms'} · ${Object.keys(clusters).length} ${PT_MODE ? 'grupos' : 'clusters'}</div>
      <br>
      <a href="/glossary/category/${categorySlug}" class="lang-switch" hreflang="en" rel="alternate">🇺🇸 English</a>
      <a href="/glossary/es/category/${categorySlug}" class="lang-switch" hreflang="es" rel="alternate">🇪🇸 Español</a>
    </div>

    <nav class="cross-cats">
      ${otherCategories}
    </nav>

    ${guideSection}

    ${bodyHTML}

    ${blogSection}

    <div class="cta-box" style="margin:2rem 0;padding:1.5rem;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #6366f1;border-radius:12px;text-align:center;">
      <h3 style="color:#e2e8f0;margin:0 0 .5rem">🚀 ${PT_MODE ? 'Aplique o Que Você Aprendeu' : "Apply What You've Learned"}</h3>
      <p style="color:#94a3b8;margin:0 0 1rem">${PT_MODE ? 'Use as ferramentas gratuitas do YT SEO Architect para otimizar seu conteúdo do YouTube — títulos, tags, descrições e muito mais.' : "Use YT SEO Architect's free tools to optimize your YouTube content — titles, tags, descriptions, and more."}</p>
      <a href="/tools/" style="display:inline-block;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.7rem 2rem;border-radius:9999px;text-decoration:none;font-weight:600">${PT_MODE ? 'Experimente as Ferramentas Grátis →' : 'Try Free Tools →'}</a>
    </div>

    <div style="text-align:center;margin:2rem 0">
      <a href="${termBase}/" style="color:#a5b4fc;font-size:.9rem">📖 ${PT_MODE ? 'Explore todos os' : 'Browse All'} ${totalTerms} ${PT_MODE ? 'Termos do Glossário' : 'Glossary Terms'}</a>
    </div>
  </main>

  <footer class="footer">
    <p>&copy; 2026 YT SEO Architect · <a href="${termBase}/">${PT_MODE ? 'Glossário' : 'Glossary'}</a> · <a href="/blog">Blog</a> · <a href="/tools/">${PT_MODE ? 'Ferramentas Grátis' : 'Free Tools'}</a> · <a href="/privacy-policy">Privacy</a></p>
  </footer>
</body>
</html>`;

  return html;
}

// ── Generate category index page ─────────────────────────────

function generateCategoryIndex(allCategories, termCounts, totalTerms) {
  const termBase = PT_MODE ? '/glossary/pt' : '/glossary';
  const catBase = PT_MODE ? '/glossary/pt/category' : '/glossary/category';
  const lang = PT_MODE ? 'es' : 'en';

  const cards = allCategories.map(cat => {
    const meta = (PT_MODE ? PT_CATEGORY_META : CATEGORY_META)[cat] || { name: cat, emoji: '📖', description: '' };
    return `
      <a href="${catBase}/${cat}" class="cat-card">
        <div class="cat-emoji">${meta.emoji}</div>
        <h3>${meta.name}</h3>
        <p>${termCounts[cat] || 0} ${PT_MODE ? 'termos' : 'terms'}</p>
        <p class="desc">${meta.description.substring(0, 100)}...</p>
      </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${PT_MODE ? 'Categorias do Glossário' : 'Glossary Categories'} — YT SEO Architect</title>
  <meta name="description" content="${PT_MODE
    ? 'Explore os termos do glossário de SEO para YouTube por categoria: Análises, Algoritmo, Otimização de SEO, Monetização, Estratégia de Conteúdo e Recursos do YouTube.'
    : 'Browse YouTube SEO glossary terms by category: Analytics, Algorithm, SEO Optimization, Monetization, Content Strategy, and YouTube Features.'}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://yt-seo-architect.vercel.app${catBase}/" />
  <link rel="alternate" hreflang="en" href="https://yt-seo-architect.vercel.app/glossary/category/" />
  <link rel="alternate" hreflang="es" href="https://yt-seo-architect.vercel.app/glossary/es/category/" />
  <link rel="alternate" hreflang="pt" href="https://yt-seo-architect.vercel.app/glossary/pt/category/" />
  <link rel="alternate" hreflang="x-default" href="https://yt-seo-architect.vercel.app/glossary/category/" />
  <link rel="stylesheet" href="/design-tokens.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/utilities.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/nav.css" media="print" onload="this.media='all'">
  <link rel="stylesheet" href="/blog-article.css" media="print" onload="this.media='all'">
  <noscript>
    <link rel="stylesheet" href="/design-tokens.css">
    <link rel="stylesheet" href="/utilities.css">
    <link rel="stylesheet" href="/nav.css">
    <link rel="stylesheet" href="/blog-article.css">
  </noscript>
  <style>
    body{font-family:'Outfit','Geist',sans-serif;background:#0a0a0f;color:#e2e8f0}
    .hero{text-align:center;padding:3rem 1rem}
    .hero h1{font-size:2rem;margin:0 0 .5rem}
    .hero p{color:#8b8b9e;max-width:500px;margin:0 auto}
    .cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1.5rem;max-width:900px;margin:2rem auto;padding:0 1rem}
    .cat-card{background:#1e1b4b;border:1px solid #2d2a5e;border-radius:1rem;padding:1.5rem;text-align:center;text-decoration:none;transition:all .2s;display:block}
    .cat-card:hover{background:#312e81;transform:translateY(-3px);border-color:#6366f1}
    .cat-emoji{font-size:2.5rem;margin-bottom:.5rem}
    .cat-card h3{color:#a5b4fc;margin:0 0 .25rem;font-size:1.1rem}
    .cat-card p{color:#8b8b9e;margin:0;font-size:.85rem}
    .cat-card .desc{font-size:.8rem;margin-top:.5rem}
  </style>
</head>
<body>
  <header class="header"><a href="/">⚡ YT SEO Architect</a></header>
  <main>
    <div class="hero">
      <h1>📖 ${PT_MODE ? 'Categorias do Glossário' : 'Glossary Categories'}</h1>
      <p>${totalTerms} ${PT_MODE ? 'termos em 6 categorias. Escolha uma categoria para mergulhar.' : 'terms across 6 categories. Pick a category to dive in.'}</p>
      <p style="max-width:640px;margin:1rem auto 0;color:#8b8b9e;font-size:.9rem;line-height:1.7">${PT_MODE
        ? 'Cada categoria reúne os conceitos que você precisa para dominar uma parte específica do SEO no YouTube. Comece pela categoria que combina com o seu problema atual — analíticas se você não sabe qual métrica acompanhar, algoritmo se quer entender por que seus vídeos são recomendados, SEO se quer ranquear mais na busca. Dentro de cada uma você encontra a definição, os termos relacionados e um guia prático de aplicação.'
        : 'Each category groups the concepts you need to master one part of YouTube SEO. Start with the category that matches your current problem — Analytics if you don\'t know which metric to watch, Algorithm if you want to understand why your videos get recommended, SEO Optimization if you want to rank higher in search. Inside each one you\'ll find definitions, related terms, and a practical application guide.'}</p>
      <a href="${termBase}/" style="color:#a5b4fc;font-size:.9rem">📖 ${PT_MODE ? 'Ver todos os termos' : 'View all glossary terms'}</a>
      <br>
      <a href="/glossary/category/" class="lang-switch" hreflang="en" rel="alternate" style="display:inline-flex;align-items:center;gap:4px;font-size:.8rem;color:#a5b4fc;text-decoration:none;padding:4px 12px;border:1px solid rgba(165,180,252,.3);border-radius:9999px;transition:all .2s">🇺🇸 English</a>
      <a href="/glossary/es/category/" class="lang-switch" hreflang="es" rel="alternate" style="display:inline-flex;align-items:center;gap:4px;font-size:.8rem;color:#a5b4fc;text-decoration:none;padding:4px 12px;border:1px solid rgba(165,180,252,.3);border-radius:9999px;transition:all .2s">🇪🇸 Español</a>
    </div>
    <div class="cat-grid">${cards}</div>
  </main>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────

function main() {
  const modeLabel = PT_MODE ? '🇧🇷 PT' : '🇺🇸 EN';
  console.log(`\n🗂️  Generating Glossary Category Pages [${modeLabel}]...\n`);

  const dataFile = PT_MODE ? PT_DATA_FILE : DATA_FILE;
  if (!existsSync(dataFile)) {
    console.error(`❌ ${dataFile} not found`);
    process.exit(1);
  }

  const data = loadData();
  const allTerms = data.terms;
  const allCategories = data.categories.map(c => c.slug).filter(c => (PT_MODE ? PT_CATEGORY_META : CATEGORY_META)[c]);
  const totalTerms = allTerms.length;

  const outDir = PT_MODE ? PT_OUTPUT_DIR : OUTPUT_DIR;
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  let generated = 0;

  // Generate per-category pages
  for (const categorySlug of allCategories) {
    const termsInCategory = allTerms.filter(t => t.category === categorySlug);
    if (termsInCategory.length === 0) {
      console.log(`  ⏭ Skipping ${categorySlug} — no terms`);
      continue;
    }

    const html = generateCategoryPage(categorySlug, termsInCategory, allTerms, totalTerms, allCategories);
    const filePath = resolve(outDir, `${categorySlug}.html`);

    if (!DRY_RUN) {
      writeFileSync(filePath, html);
    }

    console.log(`  ✅ ${categorySlug}.html  [${termsInCategory.length} terms]`);
    generated++;
  }

  // Generate category index page
  const termCounts = {};
  for (const cat of allCategories) {
    termCounts[cat] = allTerms.filter(t => t.category === cat).length;
  }
  const indexHTML = generateCategoryIndex(allCategories, termCounts, totalTerms);
  if (!DRY_RUN) {
    writeFileSync(resolve(outDir, 'index.html'), indexHTML);
    if (!PT_MODE) {
      writeFileSync(resolve(PROJECT, 'public/glossary/category.html'), indexHTML);
    }
  }
  console.log(`  ✅ category/index.html  [Category Hub — ${allCategories.length} categories]`);

  console.log(`\n📊 Summary [${modeLabel}]:`);
  console.log(`  Category pages: ${generated}`);
  console.log(`  Total terms indexed: ${totalTerms}`);
  console.log(`  Output: ${outDir.replace(PROJECT + '/', '')}/\n`);
}

main();
