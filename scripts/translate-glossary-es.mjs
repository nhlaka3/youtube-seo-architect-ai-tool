#!/usr/bin/env node
/**
 * scripts/translate-glossary-es.mjs
 *
 * Translates all glossary terms to Spanish using Groq AI.
 * Generates glossary-data-es.json with translated fields.
 *
 * Usage:
 *   node scripts/translate-glossary-es.mjs             # Translate all terms
 *   node scripts/translate-glossary-es.mjs --dry-run   # Preview without saving
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const DATA_FILE = resolve(PROJECT, 'scripts/glossary-data.json');
const ES_DATA_FILE = resolve(PROJECT, 'scripts/glossary-data-es.json');

const DRY_RUN = process.argv.includes('--dry-run');

const CATEGORY_MAP = {
  'analytics': 'Analíticas',
  'algorithm': 'Algoritmo',
  'seo-optimization': 'Optimización SEO',
  'monetization': 'Monetización',
  'content-strategy': 'Estrategia de Contenido',
  'youtube-features': 'Funciones de YouTube',
};

// ── Groq API ───────────────────────────────────────────────

async function callGroq(prompt, retries = 3) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY required');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'Eres un traductor experto de YouTube SEO. Traduce del inglés al español. Devuelve JSON exacto. Términos técnicos (CTR, SEO, CPM, RPM) se quedan en inglés. Slugs no se traducen.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 500,
        })
      });

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;

      // Rate limited — wait and retry
      if (data.error?.code === 'rate_limit_exceeded') {
        const wait = Math.min(10, attempt) * 2;
        console.log(`  ⏳ Rate limit. Esperando ${wait}s (intento ${attempt}/${retries})...`);
        await new Promise(r => setTimeout(r, wait * 1000));
        continue;
      }
      throw new Error('Empty Groq response: ' + JSON.stringify(data));
    } catch (e) {
      if (attempt === retries) throw e;
      const wait = Math.min(10, attempt) * 2;
      console.log(`  ⚠️ Error: ${e.message}. Reintentando en ${wait}s...`);
      await new Promise(r => setTimeout(r, wait * 1000));
    }
  }
}

// ── Translate terms in batches ─────────────────────────────

function loadData() {
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

async function translateBatch(terms, startIdx) {
  const batch = terms.slice(startIdx, startIdx + 1);
  const jsonInput = JSON.stringify(batch.map(t => ({
    term: t.term,
    shortDefinition: t.shortDefinition,
    category: t.category,
  })), null, 2);

  const prompt = `Traduce al español este término de YouTube SEO. Mantén slugs iguales. Términos técnicos (CTR, SEO, CPM, RPM) en inglés. Devuelve SOLO un array JSON con: term, shortDefinition.

JSON:
${jsonInput}`;

  console.log(`  Traduciendo término ${startIdx + 1}/${terms.length}...`);
  const result = await callGroq(prompt);

  // Parse JSON from response
  let clean = result.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
  const firstBracket = clean.indexOf('[');
  const lastBracket = clean.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    clean = clean.substring(firstBracket, lastBracket + 1);
  }

  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('❌ Error parsing translation response:', e.message);
    console.error('Raw:', clean.substring(0, 500));
    return null;
  }
}

// ── Generate category descriptions in Spanish ──────────────

function generateSpanishCategoryDescriptions() {
  const catContent = {
    'analytics': 'Comprende tus datos de YouTube con estas métricas y KPIs de analítica. Aprende qué significa cada métrica, cómo rastrearla y cómo usar los datos para mejorar tu estrategia de contenido.',
    'algorithm': 'Cómo funciona el algoritmo de YouTube en 2026: señales de ranking, sistemas de recomendación, factores de búsqueda y las estrategias que necesitas para trabajar con el algoritmo.',
    'seo-optimization': 'Estrategias y técnicas de SEO para YouTube. Desde investigación de palabras clave hasta optimización de títulos, miniaturas y transcripciones.',
    'monetization': 'Gana dinero en YouTube: ingresos por anuncios, membresías, Super Chat, marketing de afiliación y patrocinios. Maximiza tus ganancias por visualización.',
    'content-strategy': 'Planifica, crea y haz crecer tu canal con una estrategia de contenido ganadora. Pilares de contenido, formatos de video y calendarios editoriales.',
    'youtube-features': 'Domina las funciones integradas de YouTube: pantallas finales, tarjetas, publicaciones de la comunidad, listas de reproducción y transmisiones en vivo.',
  };
  return catContent;
}

// ── Generate the "Why It Matters" and "How To" in ES ──────────

function generateSpanishWhyItMatters(term, category) {
  const templates = {
    'analytics': `${term} es una métrica crítica en YouTube Analytics que impacta directamente tu estrategia de contenido y el crecimiento de tu canal. Al monitorear este dato regularmente, puedes identificar qué funciona, detectar problemas temprano y tomar decisiones basadas en datos en lugar de suposiciones.`,
    'algorithm': `${term} es una de las señales clave que el algoritmo de YouTube evalúa al decidir qué videos recomendar y posicionar. Entender este factor te ayuda a alinear tu estrategia con lo que el algoritmo realmente recompensa.`,
    'seo-optimization': `${term} afecta directamente cómo YouTube entiende y posiciona tu contenido en los resultados de búsqueda. Con más de 500 horas de video subidas cada minuto, la optimización adecuada separa los videos descubiertos de los invisibles.`,
    'monetization': `${term} juega un papel directo en cuántos ingresos genera tu canal de YouTube. Entender este aspecto del sistema de monetización te ayuda a maximizar las ganancias de cada visualización.`,
    'content-strategy': `${term} es un concepto fundamental que determina cómo los creadores exitosos planifican, producen y publican su contenido. Sin un enfoque estratégico, estás creando videos de forma reactiva.`,
    'youtube-features': `${term} es una función poderosa de YouTube que puede mejorar significativamente el alcance, la participación o los ingresos de tu canal cuando se usa correctamente.`,
  };
  return templates[category] || `${term} es un concepto importante de YouTube que todo creador debe entender para hacer crecer su canal de manera efectiva.`;
}

function generateSpanishHowToOptimize(term, category) {
  const templates = {
    'analytics': `Para mejorar tu ${term.toLowerCase()}, comienza revisando tu línea base en YouTube Studio Analytics. Identifica dónde estás hoy para poder medir la mejora. Establece un objetivo específico, por ejemplo, aumentar un 10% en los próximos 30 días.`,
    'algorithm': `Para optimizar para ${term.toLowerCase()}, comienza auditando tu rendimiento actual en YouTube Studio. Revisa tus 10 mejores videos y los 10 peores: ¿qué patrones emergen? Implementa un cambio a la vez y evalúa después de 2-4 semanas.`,
    'seo-optimization': `Para implementar ${term.toLowerCase()} efectivo, comienza con una auditoría completa de tu contenido existente. Usa las herramientas gratuitas de YT SEO Architect para identificar mejoras específicas. Investiga qué palabras clave busca tu audiencia.`,
    'monetization': `Para maximizar ${term.toLowerCase()}, primero asegúrate de entender las políticas actuales de monetización de YouTube, ya que cambian frecuentemente. Revisa el estado de tu canal en YouTube Studio.`,
    'content-strategy': `Para construir ${term.toLowerCase()} efectivo, comienza definiendo los pilares temáticos de tu canal: los 3-5 temas sobre los que crearás contenido consistentemente. Crea un calendario editorial con 4-8 semanas de anticipación.`,
    'youtube-features': `Para aprovechar al máximo ${term.toLowerCase()}, comienza explorando la función en YouTube Studio para entender todas sus capacidades. Muchas funciones tienen opciones ocultas que la mayoría de los creadores desconocen.`,
  };
  return templates[category] || `Para empezar con ${term.toLowerCase()}, investiga cómo otros creadores en tu nicho abordan este concepto. Comienza con una técnica nueva por video.`;
}

// ── FAQ questions in Spanish ───────────────────────────────

function generateSpanishFAQ(term, category) {
  const faqs = {
    'analytics': {
      q1: `¿Qué es un buen ${term.toLowerCase()} en YouTube?`,
      a1: `Un buen ${term.toLowerCase()} depende de tu nicho, tamaño de audiencia y duración del video. Para canales establecidos, un ${term.toLowerCase()} en el percentil 25 superior de tu nicho se considera fuerte. Usa YT SEO Architect para monitorear y mejorar esta métrica.`,
      q2: `¿Cómo mejorar ${term.toLowerCase()} en YouTube?`,
      a2: `Para mejorar ${term.toLowerCase()}, comienza auditando tu rendimiento actual en YouTube Studio. Prueba una variable a la vez y da a cada cambio al menos 2 semanas de datos antes de evaluar.`,
    },
    'algorithm': {
      q1: `¿Cómo funciona ${term.toLowerCase()} en 2026?`,
      a1: `${term} en 2026 opera en tres superficies principales: Búsqueda (coincide tu metadata con consultas), Videos Sugeridos (recomienda basado en sesiones de visualización) y la Página Principal (recomendaciones personalizadas).`,
      q2: `¿Qué señales usa ${term.toLowerCase()}?`,
      a2: `${term} evalúa más de 200 señales, pero las más importantes incluyen: coincidencia de palabras clave en título y descripción, tasa de clics, tiempo de visualización y retención de audiencia.`,
    },
    'seo-optimization': {
      q1: `¿Por qué ${term.toLowerCase()} importa para el ranking?`,
      a1: `${term} es un factor crítico de ranking porque el algoritmo de búsqueda de YouTube se basa en él para coincidir videos con la intención de búsqueda del espectador. Los videos optimizados reciben 2-5 veces más impresiones.`,
      q2: `¿Cómo implementar ${term.toLowerCase()} correctamente?`,
      a2: `Comienza con investigación de palabras clave para encontrar lo que tu audiencia busca. Coloca las palabras clave naturalmente en tu título, descripción y contenido del video. Evita el exceso de palabras clave.`,
    },
    'monetization': {
      q1: `¿Qué significa ${term.toLowerCase()} para los creadores?`,
      a1: `${term} afecta directamente los ingresos que tu canal genera. Los canales optimizados para ${term.toLowerCase()} ganan 2-4 veces más por visualización.`,
      q2: `¿Cómo mejorar ${term.toLowerCase()} en tu canal?`,
      a2: `Primero, entiende cómo funciona el sistema de monetización de YouTube. Crea videos de más de 8 minutos para habilitar anuncios mid-roll y diversifica tus ingresos más allá de los anuncios.`,
    },
    'content-strategy': {
      q1: `¿Por qué ${term.toLowerCase()} es importante?`,
      a1: `${term} es fundamental para el crecimiento del canal. Los creadores con una ${term.toLowerCase()} sólida crecen 2-4 veces más rápido porque cada video tiene un propósito específico.`,
      q2: `¿Cómo construir ${term.toLowerCase()} que funcione?`,
      a2: `Define los pilares temáticos de tu canal. Crea un calendario de contenido con 4-8 semanas de anticipación, equilibrando contenido perenne (60-70%) con contenido de tendencia (30-40%).`,
    },
    'youtube-features': {
      q1: `¿Qué es ${term.toLowerCase()} y cómo se usa?`,
      a1: `${term} es una función de YouTube que puede mejorar el alcance y la participación de tu canal. Muchos creadores pasan por alto esta función, perdiendo oportunidades de crecimiento.`,
      q2: `Mejores prácticas para ${term.toLowerCase()}`,
      a2: `Sigue estos pasos: mira los tutoriales oficiales de YouTube, estudia cómo los usan los mejores creadores, experimenta con diferentes enfoques y documenta qué funciona.`,
    },
  };
  return faqs[category] || {
    q1: `¿Qué es ${term.toLowerCase()} en YouTube?`,
    a1: `${term} es un concepto que todo creador debe entender para crecer efectivamente. Conocer cómo funciona te ayuda a tomar mejores decisiones de contenido.`,
    q2: `¿Cómo optimizar para ${term.toLowerCase()} en 2026?`,
    a2: `Comienza investigando cómo los mejores creadores en tu nicho abordan este concepto. Aplica una técnica nueva por video. La mejora continua, no la perfección, es la clave.`,
  };
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  console.log('\n🌐 Traduciendo glosario al español...\n');

  if (!existsSync(DATA_FILE)) {
    console.error('❌ glossary-data.json not found');
    process.exit(1);
  }

  const data = loadData();
  const terms = data.terms;
  const total = terms.length;
  console.log(`  Términos a traducir: ${total}`);
  console.log(`  Usando: Groq (llama-3.1-8b-instant)\n`);

  const translatedTerms = [];

  // Translate in batches of 10
  for (let i = 0; i < total; i += 1) {
    const batchResult = await translateBatch(terms, i);
    if (!batchResult) {
      console.error(`❌ Término ${i + 1} failed`);
      continue;
    }

    for (let j = 0; j < batchResult.length && (i + j) < total; j++) {
      const orig = terms[i + j];
      const trans = batchResult[j];
      const categoryName = CATEGORY_MAP[orig.category] || orig.category;
      const whyItMatters = generateSpanishWhyItMatters(trans.term || orig.term, orig.category);
      const howToOptimize = generateSpanishHowToOptimize(trans.term || orig.term, orig.category);
      const faq = generateSpanishFAQ(trans.term || orig.term, orig.category);

      translatedTerms.push({
        ...orig,
        term_es: trans.term || orig.term,
        shortDefinition_es: trans.shortDefinition || orig.shortDefinition,
        expandedDefinition_es: trans.expandedDefinition || orig.expandedDefinition,
        whyItMatters_es: whyItMatters,
        howToOptimize_es: howToOptimize,
        faq_es: faq,
        category_es: categoryName,
      });
    }

    console.log(`  ✅ Término ${i + 1} completado`);
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  // Build ES data
  const esData = {
    ...data,
    meta: {
      ...data.meta,
      language: 'es',
      languageName: 'Español',
      generatedAt: new Date().toISOString().split('T')[0],
      totalTerms: translatedTerms.length,
    },
    terms: translatedTerms,
    categories: data.categories.map(c => ({
      ...c,
      name_es: CATEGORY_MAP[c.slug] || c.name,
    })),
    _source: 'translated',
  };

  if (DRY_RUN) {
    console.log(`\n🔍 DRY RUN — no se guardó.`);
    console.log(`  Términos traducidos: ${translatedTerms.length}`);
    console.log(`  Ejemplo: "${translatedTerms[0].term}" → "${translatedTerms[0].term_es}"\n`);
    return;
  }

  writeFileSync(ES_DATA_FILE, JSON.stringify(esData, null, 2));
  console.log(`\n✅ Traducción completada:`);
  console.log(`  Términos traducidos: ${translatedTerms.length}/${total}`);
  console.log(`  Guardado en: scripts/glossary-data-es.json\n`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
