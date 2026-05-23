// Uses parent project's AI provider (no separate Groq SDK needed)
import { TOOL_URL, BLOG_POSTS_TO_LINK } from './config.js';

let askAI = null;

async function getAI() {
  if (askAI) return askAI;
  try {
    const mod = await import('../api/_lib/ai-provider.js');
    askAI = mod.askAI;
    return askAI;
  } catch (e) {
    console.warn('[AI] Could not load parent AI provider:', e.message);
    return null;
  }
}

export async function generateReply(post, helpOnly = false) {
  const ai = await getAI();
  const postText = (post.title + ' ' + (post.text || '')).toLowerCase();
  
  // Match to a relevant blog post if available
  let blogLink = '';
  if (!helpOnly && BLOG_POSTS_TO_LINK && BLOG_POSTS_TO_LINK.length > 0) {
    const matched = BLOG_POSTS_TO_LINK.find(b => postText.includes(b.keyword));
    if (matched) {
      blogLink = ` (I wrote a more detailed ${matched.text} at ${matched.url} if you want to go deeper.)`;
    }
  }

  if (ai) {
    const toolMention = helpOnly ? '' : `If it feels natural, mention that you built a free tool called YT SEO Architect (${TOOL_URL}) that helps with this — but only if it actually fits the advice you're giving. Don't force it.`;
    
    const prompt = `You're a YouTube creator who has been through this exact struggle. Someone posted this in r/${post.subreddit}:

Title: "${post.title}"
Body: "${(post.text || '').substring(0, 500)}"

Write a genuinely helpful Reddit reply. Rules:
- Write 3-5 paragraphs of actual, specific advice. Not generic. Reference their exact situation.
- Start by acknowledging their frustration — you've been there. Make them feel heard.
- Give concrete steps. Numbers. Examples. "Do X, then Y, then check Z."
- Share a personal experience: what you tried, what failed, what finally worked.
- End with encouragement. Growth takes time but the specific thing they're struggling with IS fixable.
- Sound like a real person who actually makes videos. Casual, warm, but detailed.
- Never say "Hey!" "Great question!" "I understand how you feel!" or generic fluff.${toolMention ? '\\n' + toolMention : ''}
- Never use words like "game-changer," "leveraged," "revolutionized," or "skyrocketed." 

${blogLink ? 'After your main advice, naturally add: "' + blogLink + '"' : ''}`;

    try {
      const raw = await ai(
        'You are a YouTube creator with 3+ years of experience. You write helpful, specific, warm Reddit replies that actually solve problems. You never sound like a bot or a marketer.',
        prompt,
        { temperature: 0.8 + Math.random() * 0.15, maxTokens: 600 }
      );
      console.log('[AI] Generated reply for:', post.title.substring(0, 60));
      return raw.trim();
    } catch (e) {
      console.warn('[AI] Generation failed:', e.message);
    }
  }
  
  return generateFallbackReply(post, helpOnly);
}

function generateFallbackReply(post, helpOnly = false) {
  const url = 'https://yt-seo-architect.vercel.app';
  const text = (post.title + ' ' + (post.text || '')).toLowerCase();
  const baseAdvice = getAdviceForTopic(text);

  // Random sign-offs for variation on regenerate
  const signoffs = [
    "Hope this helps — you got this.",
    "Seriously, these changes made a real difference for me. Stick with it.",
    "It won’t happen overnight, but these fundamentals work. Trust the process.",
    "This is what I wish someone told me a year ago. Good luck!",
  ];
  const signoff = signoffs[Math.floor(Math.random() * signoffs.length)];

  const toolLine = helpOnly ? '' : "\n\nOne thing that saved me time — I built a free tool called YT SEO Architect (" + url + ") that handles keyword research and tag generation. 100 free credits/month, no card. It won’t fix everything overnight, but it cuts out the tedious parts.";

  return baseAdvice + "\n\n" + signoff + toolLine;
}

function getAdviceForTopic(text) {
  if (text.includes('shadow ban') || text.includes('shadowban') || text.includes('shadow banned')) {
    return `I went through this exact panic last year. My channel flatlined for two weeks — zero impressions on new uploads, existing videos stopped getting suggested. I was convinced I was shadow banned. Here's what I learned after way too much research and testing:

First — and this is the part nobody tells you — actual shadow banning on YouTube is incredibly rare. What usually happens is your content hit a quality threshold that stopped the algorithm from pushing it. YouTube doesn't "punish" channels. It just stops recommending content that isn't performing well on CTR and retention.

Here's what I did to fix it:
1. I ran a full audit on my last 10 videos. Checked titles, tags, descriptions, and thumbnails. Found that 6 of them had keyword cannibalization — multiple videos targeting the same search terms, which confused the algorithm.
2. I deleted or unlisted the worst-performing duplicates and re-optimized the remaining ones with distinct keyword targets.
3. I took a 5-day break from uploading. Sounds counterintuitive, but it resets your channel's performance baseline. When I came back with a properly optimized video, the algorithm treated it as a fresh signal.

It took about 2 weeks for impressions to recover, but they came back stronger — my CTR actually improved because I was more targeted with my keywords. The algorithm isn't broken. It just stopped trusting your content. Give it a reason to trust you again.`;
  }

  if (text.includes('tag') || text.includes('keyword') || text.includes('seo') || text.includes('metadata')) {
    return `I was doing tags completely wrong for my first year on YouTube. I thought more tags = better, so I'd stuff 40-50 broad tags on every video. Turns out that's worse than using 10 specific ones.

Here's the approach that actually moved the needle for me:

1. Your first 3-5 tags should be exact-match long-tail phrases people actually type into search. Not "gaming" — that's useless. Something like "best budget gaming mouse for fps 2026." Use YouTube's search autocomplete to find these. Start typing your topic and see what YouTube suggests. Those are real searches.

2. The next 5-10 tags should be related variations. If your main keyword is "budget gaming mouse," related tags would be "affordable gaming mouse review," "gaming mouse under 50 dollars," "best fps mouse budget." These help YouTube understand the context of your video.

3. Your last few tags should be broad category tags — just 2-3: "gaming mouse," "pc gaming," "tech review." These signal what niche you're in.

4. Don't copy competitor tags blindly. I made this mistake. A 500K sub channel can rank for "gaming" because they have authority. You can't. Find the long-tail versions of their tags that have less competition.

The other thing that helped: make sure your title includes your main keyword in the first 3-4 words, and your description's first sentence repeats it naturally. YouTube weights these three elements together — tags tell it what you're about, title and description confirm it.`;
  }

  if (text.includes('view') || text.includes('grow') || text.includes('stuck') || text.includes('algorithm')) {
    return `I hit the exact same wall about 8 months into my channel. 47 videos, barely cracking 200 views each, and I was ready to quit. The algorithm felt random — some garbage video would get 10K views and my best work got 150. It's demoralizing in a way only creators understand.

Here's what I changed that actually worked:

I stopped treating YouTube like a lottery and started treating it like a system. I went back and analyzed every video that did well (200+ views at the time was "well" for me) and found the pattern: my tutorial-style videos with specific, searchable titles consistently outperformed my personality-driven vlogs. The algorithm wasn't random — it was rewarding content that matched search intent.

Then I did three things differently:
1. I only made videos around keywords with proven search volume. I used YouTube's search bar to find terms with 1K-10K monthly searches and low competition. If I couldn't find a keyword that met those criteria, I didn't make the video.
2. I optimized every piece of metadata BEFORE uploading — not after. Title, description with timestamps, a full tag strategy, and a thumbnail that passed the "squint test" (can you tell what the video is about with the thumbnail at 200px wide?).
3. I focused on retention over everything. I cut my intros from 40 seconds to under 10. I added pattern interrupts every 60-90 seconds with B-roll, text overlays, or a joke. My average view duration went from 1:40 to 3:20 on 8-minute videos.

It took 6 more videos before the algorithm caught on, but video #7 hit 1,200 views in the first 48 hours — which was more than my previous 10 videos combined. The algorithm didn't change. My content did.`;
  }

  if (text.includes('thumbnail') || text.includes('ctr') || text.includes('click')) {
    return `Thumbnails were my blind spot for way too long. I'd spend hours editing a video and 5 minutes slapping text on a freeze frame. My CTR was stuck at 2-3% while channels my size were getting 6-8%. That difference alone was costing me thousands of views.

Here's what I changed:

1. High contrast first. Dark backgrounds with bright text or bright backgrounds with dark text. Look at MrBeast's thumbnails — every single one uses extreme contrast. It's not about looking pretty. It's about being readable when someone is scrolling at full speed on their phone.

2. Faces work — but only if you're showing an emotion. A neutral face is worse than no face. Confused, shocked, excited — the face needs to tell a story in 0.2 seconds. Practice making exaggerated expressions. They feel ridiculous to shoot but they work.

3. Text should be 3-4 words max. Not a title. Not a description. A hook. "This Changed Everything" or "Don't Buy These" or "I Was Wrong About..." The text teases the emotion, the thumbnail image delivers the context.

4. I test everything now. I make 3 thumbnail variations per video and swap them after 24 hours if CTR is below 5%. I've had videos go from 2.8% to 7.1% CTR just from changing the thumbnail text from white to yellow.

Your thumbnail isn't decoration. It's the most important marketing asset for your video. Spend as much time on it as you do on the intro.`;
  }

  // Default: general YouTube growth advice
  return `Real talk — growing on YouTube in 2026 is harder than it was in 2020, but it's not harder than it was in 2024. The algorithm has actually gotten better at recommending smaller creators. The bar for production quality has gone up, but the bar for "content that helps someone solve a problem" hasn't changed.

Here's what I'd focus on if I was starting over today:

First, pick ONE format and stick with it for 20 videos. I made the mistake of doing tutorials, vlogs, reviews, and commentary all on the same channel. The algorithm had no idea who to recommend my content to. Pick one. Tutorials? Do 20 tutorials. Commentary? Do 20 commentary videos. Let YouTube figure out your audience before you try to serve multiple audiences.

Second, every video should answer exactly one question. "How do I fix X?" "What's the best Y for Z?" "Why does A happen when B?" If your video can't be summarized as answering one specific question, it's going to struggle. People don't browse YouTube anymore — they search for answers.

Third, your first 30 seconds are everything. I used to spend 45 seconds explaining what the video was about. Nobody cares. Show them the result in the first 5 seconds, then explain how you got there. My retention on the first 30 seconds went from 55% to 82% when I started leading with the payoff instead of the setup.

These aren't secrets. They're just the fundamentals that most creators skip because they're not exciting. But they work.`;
}
