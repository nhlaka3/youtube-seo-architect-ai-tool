#!/usr/bin/env node
/**
 * scripts/translate-glossary.mjs
 *
 * Translates all glossary terms to a target language using an AI provider.
 * Generates scripts/glossary-data-{lang}.json with translated fields.
 *
 * Usage:
 *   node scripts/translate-glossary.mjs                  # Spanish (default, back-compat)
 *   node scripts/translate-glossary.mjs --lang pt        # Portuguese (pt-BR)
 *   node scripts/translate-glossary.mjs --lang es --limit 5   # First 5 terms only
 *   node scripts/translate-glossary.mjs --dry-run        # Preview without saving
 *
 * Provider resolution (OpenAI-compatible chat completions):
 *   1. GROQ_API_KEY        → llama-3.1-8b-instant (fast/cheap, default)
 *   2. DEEPSEEK_API_KEY    → deepseek-chat (fallback)
 *   3. GEMINI_API_KEY      → gemini-1.5-flash (last resort)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');
const DATA_FILE = resolve(PROJECT, 'scripts/glossary-data.json');

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const langArg = ARGS.indexOf('--lang');
const LANG = langArg >= 0 ? ARGS[langArg + 1] : 'es';
const limitArg = ARGS.indexOf('--limit');
const LIMIT = limitArg >= 0 ? parseInt(ARGS[limitArg + 1], 10) : null;

// ── Language configuration ────────────────────────────────────

const LANGS = {
  es: {
    code: 'es',
    name: 'Español',
    dataFile: 'glossary-data-es.json',
    suffix: '_es',
    categoryMap: {
      'analytics': 'Analíticas',
      'algorithm': 'Algoritmo',
      'seo-optimization': 'Optimización SEO',
      'monetization': 'Monetización',
      'content-strategy': 'Estrategia de Contenido',
      'youtube-features': 'Funciones de YouTube',
    },
    systemPrompt: 'Eres un traductor experto de YouTube SEO. Traduce del inglés al español. Devuelve JSON exacto. Términos técnicos (CTR, SEO, CPM, RPM) se quedan en inglés. Slugs no se traducen.',
    translatePrompt: 'Traduce al español este término de YouTube SEO. Mantén slugs iguales. Términos técnicos (CTR, SEO, CPM, RPM) en inglés. Devuelve SOLO un array JSON con: term, shortDefinition, expandedDefinition.',
    categoryDescriptions: {
      'analytics': 'Comprende tus datos de YouTube con estas métricas y KPIs de analítica. Aprende qué significa cada métrica, cómo rastrearla y cómo usar los datos para mejorar tu estrategia de contenido.',
      'algorithm': 'Cómo funciona el algoritmo de YouTube en 2026: señales de ranking, sistemas de recomendación, factores de búsqueda y las estrategias que necesitas para trabajar con el algoritmo.',
      'seo-optimization': 'Estrategias y técnicas de SEO para YouTube. Desde investigación de palabras clave hasta optimización de títulos, miniaturas y transcripciones.',
      'monetization': 'Gana dinero en YouTube: ingresos por anuncios, membresías, Super Chat, marketing de afiliación y patrocinios. Maximiza tus ganancias por visualización.',
      'content-strategy': 'Planifica, crea y haz crecer tu canal con una estrategia de contenido ganadora. Pilares de contenido, formatos de video y calendarios editoriales.',
      'youtube-features': 'Domina las funciones integradas de YouTube: pantallas finales, tarjetas, publicaciones de la comunidad, listas de reproducción y transmisiones en vivo.',
    },
    whyItMatters: {
      'analytics': (t) => `${t} es una métrica crítica en YouTube Analytics que impacta directamente tu estrategia de contenido y el crecimiento de tu canal. Al monitorear este dato regularmente, puedes identificar qué funciona, detectar problemas temprano y tomar decisiones basadas en datos en lugar de suposiciones.`,
      'algorithm': (t) => `${t} es una de las señales clave que el algoritmo de YouTube evalúa al decidir qué videos recomendar y posicionar. Entender este factor te ayuda a alinear tu estrategia con lo que el algoritmo realmente recompensa.`,
      'seo-optimization': (t) => `${t} afecta directamente cómo YouTube entiende y posiciona tu contenido en los resultados de búsqueda. Con más de 500 horas de video subidas cada minuto, la optimización adecuada separa los videos descubiertos de los invisibles.`,
      'monetization': (t) => `${t} juega un papel directo en cuántos ingresos genera tu canal de YouTube. Entender este aspecto del sistema de monetización te ayuda a maximizar las ganancias de cada visualización.`,
      'content-strategy': (t) => `${t} es un concepto fundamental que determina cómo los creadores exitosos planifican, producen y publican su contenido. Sin un enfoque estratégico, estás creando videos de forma reactiva.`,
      'youtube-features': (t) => `${t} es una función poderosa de YouTube que puede mejorar significativamente el alcance, la participación o los ingresos de tu canal cuando se usa correctamente.`,
    },
    howToOptimize: {
      'analytics': (t) => `Para mejorar tu ${t.toLowerCase()}, comienza revisando tu línea base en YouTube Studio Analytics. Identifica dónde estás hoy para poder medir la mejora. Establece un objetivo específico, por ejemplo, aumentar un 10% en los próximos 30 días.`,
      'algorithm': (t) => `Para optimizar para ${t.toLowerCase()}, comienza auditando tu rendimiento actual en YouTube Studio. Revisa tus 10 mejores videos y los 10 peores: ¿qué patrones emergen? Implementa un cambio a la vez y evalúa después de 2-4 semanas.`,
      'seo-optimization': (t) => `Para implementar ${t.toLowerCase()} efectivo, comienza con una auditoría completa de tu contenido existente. Usa las herramientas gratuitas de YT SEO Architect para identificar mejoras específicas. Investiga qué palabras clave busca tu audiencia.`,
      'monetization': (t) => `Para maximizar ${t.toLowerCase()}, primero asegúrate de entender las políticas actuales de monetización de YouTube, ya que cambian frecuentemente. Revisa el estado de tu canal en YouTube Studio.`,
      'content-strategy': (t) => `Para construir ${t.toLowerCase()} efectivo, comienza definiendo los pilares temáticos de tu canal: los 3-5 temas sobre los que crearás contenido consistentemente. Crea un calendario editorial con 4-8 semanas de anticipación.`,
      'youtube-features': (t) => `Para aprovechar al máximo ${t.toLowerCase()}, comienza explorando la función en YouTube Studio para entender todas sus capacidades. Muchas funciones tienen opciones ocultas que la mayoría de los creadores desconocen.`,
    },
    faq: {
      'analytics': (t) => ({
        q1: `¿Qué es un buen ${t.toLowerCase()} en YouTube?`,
        a1: `Un buen ${t.toLowerCase()} depende de tu nicho, tamaño de audiencia y duración del video. Para canales establecidos, un ${t.toLowerCase()} en el percentil 25 superior de tu nicho se considera fuerte. Usa YT SEO Architect para monitorear y mejorar esta métrica.`,
        q2: `¿Cómo mejorar ${t.toLowerCase()} en YouTube?`,
        a2: `Para mejorar ${t.toLowerCase()}, comienza auditando tu rendimiento actual en YouTube Studio. Prueba una variable a la vez y da a cada cambio al menos 2 semanas de datos antes de evaluar.`,
      }),
      'algorithm': (t) => ({
        q1: `¿Cómo funciona ${t.toLowerCase()} en 2026?`,
        a1: `${t} en 2026 opera en tres superficies principales: Búsqueda (coincide tu metadata con consultas), Videos Sugeridos (recomienda basado en sesiones de visualización) y la Página Principal (recomendaciones personalizadas).`,
        q2: `¿Qué señales usa ${t.toLowerCase()}?`,
        a2: `${t} evalúa más de 200 señales, pero las más importantes incluyen: coincidencia de palabras clave en título y descripción, tasa de clics, tiempo de visualización y retención de audiencia.`,
      }),
      'seo-optimization': (t) => ({
        q1: `¿Por qué ${t.toLowerCase()} importa para el ranking?`,
        a1: `${t} es un factor crítico de ranking porque el algoritmo de búsqueda de YouTube se basa en él para coincidir videos con la intención de búsqueda del espectador. Los videos optimizados reciben 2-5 veces más impresiones.`,
        q2: `¿Cómo implementar ${t.toLowerCase()} correctamente?`,
        a2: `Comienza con investigación de palabras clave para encontrar lo que tu audiencia busca. Coloca las palabras clave naturalmente en tu título, descripción y contenido del video. Evita el exceso de palabras clave.`,
      }),
      'monetization': (t) => ({
        q1: `¿Qué significa ${t.toLowerCase()} para los creadores?`,
        a1: `${t} afecta directamente los ingresos que tu canal genera. Los canales optimizados para ${t.toLowerCase()} ganan 2-4 veces más por visualización.`,
        q2: `¿Cómo mejorar ${t.toLowerCase()} en tu canal?`,
        a2: `Primero, entiende cómo funciona el sistema de monetización de YouTube. Crea videos de más de 8 minutos para habilitar anuncios mid-roll y diversifica tus ingresos más allá de los anuncios.`,
      }),
      'content-strategy': (t) => ({
        q1: `¿Por qué ${t.toLowerCase()} es importante?`,
        a1: `${t} es fundamental para el crecimiento del canal. Los creadores con una ${t.toLowerCase()} sólida crecen 2-4 veces más rápido porque cada video tiene un propósito específico.`,
        q2: `¿Cómo construir ${t.toLowerCase()} que funcione?`,
        a2: `Define los pilares temáticos de tu canal. Crea un calendario de contenido con 4-8 semanas de anticipación, equilibrando contenido perenne (60-70%) con contenido de tendencia (30-40%).`,
      }),
      'youtube-features': (t) => ({
        q1: `¿Qué es ${t.toLowerCase()} y cómo se usa?`,
        a1: `${t} es una función de YouTube que puede mejorar el alcance y la participación de tu canal. Muchos creadores pasan por alto esta función, perdiendo oportunidades de crecimiento.`,
        q2: `Mejores prácticas para ${t.toLowerCase()}`,
        a2: `Sigue estos pasos: mira los tutoriales oficiales de YouTube, estudia cómo los usan los mejores creadores, experimenta con diferentes enfoques y documenta qué funciona.`,
      }),
    },
    fallback: {
      whyItMatters: (t) => `${t} es un concepto importante de YouTube que todo creador debe entender para hacer crecer su canal de manera efectiva.`,
      howToOptimize: (t) => `Para empezar con ${t.toLowerCase()}, investiga cómo otros creadores en tu nicho abordan este concepto. Comienza con una técnica nueva por video.`,
      faq: (t) => ({
        q1: `¿Qué es ${t.toLowerCase()} en YouTube?`,
        a1: `${t} es un concepto que todo creador debe entender para crecer efectivamente. Conocer cómo funciona te ayuda a tomar mejores decisiones de contenido.`,
        q2: `¿Cómo optimizar para ${t.toLowerCase()} en 2026?`,
        a2: `Comienza investigando cómo los mejores creadores en tu nicho abordan este concepto. Aplica una técnica nueva por video. La mejora continua, no la perfección, es la clave.`,
      }),
    },
  },

  pt: {
    code: 'pt',
    name: 'Português',
    dataFile: 'glossary-data-pt.json',
    suffix: '_pt',
    categoryMap: {
      'analytics': 'Análises',
      'algorithm': 'Algoritmo',
      'seo-optimization': 'Otimização de SEO',
      'monetization': 'Monetização',
      'content-strategy': 'Estratégia de Conteúdo',
      'youtube-features': 'Recursos do YouTube',
    },
    systemPrompt: 'Você é um tradutor especialista em SEO de YouTube. Traduza do inglês para o português do Brasil. Retorne JSON exato. Termos técnicos (CTR, SEO, CPM, RPM) permanecem em inglês. Slugs não são traduzidos.',
    translatePrompt: 'Traduza para o português do Brasil este termo de SEO de YouTube. Mantenha os slugs iguais. Termos técnicos (CTR, SEO, CPM, RPM) em inglês. Retorne APENAS um array JSON com: term, shortDefinition, expandedDefinition.',
    categoryDescriptions: {
      'analytics': 'Entenda os dados do seu canal do YouTube com estas métricas e KPIs de análise. Aprenda o que cada métrica significa, como monitorá-la e como usar os dados para melhorar sua estratégia de conteúdo.',
      'algorithm': 'Como o algoritmo do YouTube funciona em 2026: sinais de ranqueamento, sistemas de recomendação, fatores de busca e as estratégias que você precisa para trabalhar com o algoritmo.',
      'seo-optimization': 'Estratégias e técnicas de SEO para YouTube. Desde pesquisa de palavras-chave até otimização de títulos, miniaturas e transcrições.',
      'monetization': 'Ganhe dinheiro no YouTube: receita de anúncios, membros, Super Chat, marketing de afiliados e patrocínios. Maximize seus ganhos por visualização.',
      'content-strategy': 'Planeje, crie e faça seu canal crescer com uma estratégia de conteúdo vencedora. Pilares de conteúdo, formatos de vídeo e calendários editoriais.',
      'youtube-features': 'Domine os recursos integrados do YouTube: telas finais, cards, postagens da comunidade, playlists e transmissões ao vivo.',
    },
    whyItMatters: {
      'analytics': (t) => `${t} é uma métrica crítica no YouTube Analytics que impacta diretamente sua estratégia de conteúdo e o crescimento do seu canal. Ao monitorar esse dado regularmente, você pode identificar o que funciona, detectar problemas cedo e tomar decisões baseadas em dados em vez de suposições.`,
      'algorithm': (t) => `${t} é um dos sinais-chave que o algoritmo do YouTube avalia ao decidir quais vídeos recomendar e posicionar. Entender esse fator ajuda você a alinhar sua estratégia com o que o algoritmo realmente recompensa.`,
      'seo-optimization': (t) => `${t} afeta diretamente como o YouTube entende e posiciona seu conteúdo nos resultados de busca. Com mais de 500 horas de vídeo enviadas por minuto, a otimização adequada separa os vídeos descobertos dos invisíveis.`,
      'monetization': (t) => `${t} tem um papel direto em quanta receita seu canal do YouTube gera. Entender esse aspecto do sistema de monetização ajuda você a maximizar os ganhos de cada visualização.`,
      'content-strategy': (t) => `${t} é um conceito fundamental que determina como criadores de sucesso planejam, produzem e publicam seu conteúdo. Sem uma abordagem estratégica, você está criando vídeos de forma reativa.`,
      'youtube-features': (t) => `${t} é um recurso poderoso do YouTube que pode melhorar significativamente o alcance, o engajamento ou a receita do seu canal quando usado corretamente.`,
    },
    howToOptimize: {
      'analytics': (t) => `Para melhorar seu ${t.toLowerCase()}, comece revisando sua linha de base no YouTube Studio Analytics. Identifique onde você está hoje para poder medir a melhoria. Estabeleça uma meta específica, por exemplo, aumentar 10% nos próximos 30 dias.`,
      'algorithm': (t) => `Para otimizar para ${t.toLowerCase()}, comece auditando seu desempenho atual no YouTube Studio. Revise seus 10 melhores vídeos e os 10 piores: quais padrões surgem? Implemente uma mudança por vez e avalie após 2-4 semanas.`,
      'seo-optimization': (t) => `Para implementar ${t.toLowerCase()} eficaz, comece com uma auditoria completa do seu conteúdo existente. Use as ferramentas gratuitas do YT SEO Architect para identificar melhorias específicas. Pesquise quais palavras-chave seu público busca.`,
      'monetization': (t) => `Para maximizar ${t.toLowerCase()}, primeiro certifique-se de entender as políticas atuais de monetização do YouTube, pois elas mudam com frequência. Verifique o status do seu canal no YouTube Studio.`,
      'content-strategy': (t) => `Para construir ${t.toLowerCase()} eficaz, comece definindo os pilares temáticos do seu canal: os 3-5 temas sobre os quais você criará conteúdo consistentemente. Crie um calendário editorial com 4-8 semanas de antecedência.`,
      'youtube-features': (t) => `Para aproveitar ao máximo ${t.toLowerCase()}, comece explorando o recurso no YouTube Studio para entender todas as suas capacidades. Muitos recursos têm opções ocultas que a maioria dos criadores desconhece.`,
    },
    faq: {
      'analytics': (t) => ({
        q1: `O que é um bom ${t.toLowerCase()} no YouTube?`,
        a1: `Um bom ${t.toLowerCase()} depende do seu nicho, tamanho do público e duração do vídeo. Para canais estabelecidos, um ${t.toLowerCase()} no percentil 25 superior do seu nicho é considerado forte. Use o YT SEO Architect para monitorar e melhorar essa métrica.`,
        q2: `Como melhorar ${t.toLowerCase()} no YouTube?`,
        a2: `Para melhorar ${t.toLowerCase()}, comece auditando seu desempenho atual no YouTube Studio. Teste uma variável por vez e dê a cada mudança pelo menos 2 semanas de dados antes de avaliar.`,
      }),
      'algorithm': (t) => ({
        q1: `Como funciona ${t.toLowerCase()} em 2026?`,
        a1: `${t} em 2026 opera em três superfícies principais: Busca (combina seus metadados com consultas), Vídeos Sugeridos (recomenda com base em sessões de visualização) e Página Inicial (recomendações personalizadas).`,
        q2: `Quais sinais ${t.toLowerCase()} usa?`,
        a2: `${t} avalia mais de 200 sinais, mas os mais importantes incluem: correspondência de palavras-chave no título e na descrição, taxa de cliques, tempo de visualização e retenção de público.`,
      }),
      'seo-optimization': (t) => ({
        q1: `Por que ${t.toLowerCase()} importa para o ranqueamento?`,
        a1: `${t} é um fator crítico de ranqueamento porque o algoritmo de busca do YouTube depende dele para combinar vídeos com a intenção de busca do espectador. Vídeos otimizados recebem 2-5 vezes mais impressões.`,
        q2: `Como implementar ${t.toLowerCase()} corretamente?`,
        a2: `Comece com pesquisa de palavras-chave para encontrar o que seu público busca. Coloque as palavras-chave naturalmente no título, na descrição e no conteúdo do vídeo. Evite excesso de palavras-chave.`,
      }),
      'monetization': (t) => ({
        q1: `O que ${t.toLowerCase()} significa para os criadores?`,
        a1: `${t} afeta diretamente a receita que seu canal gera. Canais otimizados para ${t.toLowerCase()} ganham 2-4 vezes mais por visualização.`,
        q2: `Como melhorar ${t.toLowerCase()} no seu canal?`,
        a2: `Primeiro, entenda como funciona o sistema de monetização do YouTube. Crie vídeos com mais de 8 minutos para habilitar anúncios mid-roll e diversifique sua receita além dos anúncios.`,
      }),
      'content-strategy': (t) => ({
        q1: `Por que ${t.toLowerCase()} é importante?`,
        a1: `${t} é fundamental para o crescimento do canal. Criadores com ${t.toLowerCase()} sólida crescem 2-4 vezes mais rápido porque cada vídeo tem um propósito específico.`,
        q2: `Como construir ${t.toLowerCase()} que funcione?`,
        a2: `Defina os pilares temáticos do seu canal. Crie um calendário de conteúdo com 4-8 semanas de antecedência, equilibrando conteúdo perene (60-70%) com conteúdo de tendência (30-40%).`,
      }),
      'youtube-features': (t) => ({
        q1: `O que é ${t.toLowerCase()} e como usar?`,
        a1: `${t} é um recurso do YouTube que pode melhorar o alcance e o engajamento do seu canal. Muitos criadores ignoram esse recurso, perdendo oportunidades de crescimento.`,
        q2: `Melhores práticas para ${t.toLowerCase()}`,
        a2: `Siga estes passos: veja os tutoriais oficiais do YouTube, estude como os melhores criadores usam, experimente diferentes abordagens e documente o que funciona.`,
      }),
    },
    fallback: {
      whyItMatters: (t) => `${t} é um conceito importante do YouTube que todo criador deve entender para fazer seu canal crescer de forma eficaz.`,
      howToOptimize: (t) => `Para começar com ${t.toLowerCase()}, pesquise como outros criadores do seu nicho abordam esse conceito. Comece com uma técnica nova por vídeo.`,
      faq: (t) => ({
        q1: `O que é ${t.toLowerCase()} no YouTube?`,
        a1: `${t} é um conceito que todo criador deve entender para crescer de forma eficaz. Saber como funciona ajuda você a tomar melhores decisões de conteúdo.`,
        q2: `Como otimizar para ${t.toLowerCase()} em 2026?`,
        a2: `Comece pesquisando como os melhores criadores do seu nicho abordam esse conceito. Aplique uma técnica nova por vídeo. Melhoria contínua, não perfeição, é a chave.`,
      }),
    },
  },
};

const lang = LANGS[LANG];
if (!lang) {
  console.error(`❌ Unknown language: ${LANG}. Available: ${Object.keys(LANGS).join(', ')}`);
  process.exit(1);
}

const OUT_FILE = resolve(PROJECT, 'scripts', lang.dataFile);

// ── Provider resolution (OpenAI-compatible) ───────────────────

const PROVIDERS = [
  { env: 'GROQ_API_KEY', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.1-8b-instant' },
  { env: 'DEEPSEEK_API_KEY', url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  { env: 'GEMINI_API_KEY', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-1.5-flash' },
];

function resolveProvider() {
  for (const p of PROVIDERS) {
    if (process.env[p.env]) return { ...p, apiKey: process.env[p.env] };
  }
  return null;
}

async function callAI(prompt, provider, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: lang.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1200,
        })
      });

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;

      if (data.error?.code === 'rate_limit_exceeded' || res.status === 429) {
        const wait = Math.min(10, attempt) * 2;
        console.log(`  ⏳ Rate limit. Waiting ${wait}s (attempt ${attempt}/${retries})...`);
        await new Promise(r => setTimeout(r, wait * 1000));
        continue;
      }
      throw new Error('Empty AI response: ' + JSON.stringify(data).substring(0, 300));
    } catch (e) {
      if (attempt === retries) throw e;
      const wait = Math.min(10, attempt) * 2;
      console.log(`  ⚠️ Error: ${e.message}. Retrying in ${wait}s...`);
      await new Promise(r => setTimeout(r, wait * 1000));
    }
  }
}

// ── Translate terms ──────────────────────────────────────────

function loadData() {
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

async function translateTerm(term) {
  const jsonInput = JSON.stringify([{
    term: term.term,
    shortDefinition: term.shortDefinition,
    expandedDefinition: term.expandedDefinition,
    category: term.category,
  }], null, 2);

  const prompt = `${lang.translatePrompt}

JSON:
${jsonInput}`;

  const result = await callAI(prompt, provider);

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

function generateWhyItMatters(term, category) {
  const fn = lang.whyItMatters[category] || lang.fallback.whyItMatters;
  return fn(term);
}

function generateHowToOptimize(term, category) {
  const fn = lang.howToOptimize[category] || lang.fallback.howToOptimize;
  return fn(term);
}

function generateFAQ(term, category) {
  const fn = lang.faq[category] || lang.fallback.faq;
  return fn(term);
}

// ── Main ─────────────────────────────────────────────────────

const provider = resolveProvider();
if (!provider) {
  console.error('❌ No AI provider key found. Set GROQ_API_KEY, DEEPSEEK_API_KEY, or GEMINI_API_KEY.');
  process.exit(1);
}

async function main() {
  console.log(`\n🌐 Translating glossary to ${lang.name} (${lang.code})...\n`);

  if (!existsSync(DATA_FILE)) {
    console.error('❌ glossary-data.json not found');
    process.exit(1);
  }

  const data = loadData();
  const s = lang.suffix;
  const terms = data.terms;
  const total = LIMIT ? Math.min(LIMIT, terms.length) : terms.length;
  console.log(`  Terms to translate: ${total}/${terms.length}`);
  console.log(`  Using: ${provider.model} (${provider.url.split('/')[2]})\n`);

  const translatedTerms = [];

  for (let i = 0; i < total; i++) {
    const orig = terms[i];
    const batchResult = await translateTerm(orig);
    if (!batchResult || !batchResult[0]) {
      console.error(`❌ Term ${i + 1} (${orig.slug}) failed`);
      continue;
    }

    const trans = batchResult[0];
    const translatedName = trans.term || orig.term;
    const categoryName = lang.categoryMap[orig.category] || orig.category;

    translatedTerms.push({
      ...orig,
      [`term${s}`]: translatedName,
      [`shortDefinition${s}`]: trans.shortDefinition || orig.shortDefinition,
      [`expandedDefinition${s}`]: trans.expandedDefinition || orig.expandedDefinition,
      [`whyItMatters${s}`]: generateWhyItMatters(translatedName, orig.category),
      [`howToOptimize${s}`]: generateHowToOptimize(translatedName, orig.category),
      [`faq${s}`]: generateFAQ(translatedName, orig.category),
      [`category${s}`]: categoryName,
    });

    console.log(`  ✅ Term ${i + 1}/${total}: "${orig.term}" → "${translatedName}"`);
    await new Promise(r => setTimeout(r, 500));
  }

  // Build translated data
  const outData = {
    ...data,
    meta: {
      ...data.meta,
      language: lang.code,
      languageName: lang.name,
      generatedAt: new Date().toISOString().split('T')[0],
      totalTerms: translatedTerms.length,
    },
    terms: translatedTerms,
    categories: data.categories.map(c => ({
      ...c,
      [`name${s}`]: lang.categoryMap[c.slug] || c.name,
    })),
    _source: 'translated',
  };

  if (DRY_RUN) {
    console.log(`\n🔍 DRY RUN — not saved.`);
    console.log(`  Terms translated: ${translatedTerms.length}`);
    console.log(`  Example: "${translatedTerms[0].term}" → "${translatedTerms[0][`term${s}`]}"\n`);
    return;
  }

  writeFileSync(OUT_FILE, JSON.stringify(outData, null, 2));
  console.log(`\n✅ Translation complete:`);
  console.log(`  Terms translated: ${translatedTerms.length}/${total}`);
  console.log(`  Saved to: scripts/${lang.dataFile}\n`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
