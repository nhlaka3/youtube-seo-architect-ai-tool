#!/usr/bin/env python3
"""
Inject rich SEO content (How to Use + FAQ + related tools) into thin interactive
tool pages (public/tools/*.html with <400 visible words). Each page gets a
tool-specific content section inserted after the .blog-link block, inside the
container, so crawlers see 500+ words of unique copy.
"""
import re, glob, sys

TOOLS_DIR = "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/public/tools"

# ── Per-tool content map: slug -> (purpose paragraph, [howto steps], [(q,a)x3], [related slugs])
CONTENT = {
    'subscriber-growth-calculator': (
        "This calculator estimates your monthly subscriber growth rate from your current subscriber count and the number of new subscribers you gained in a period. Growth rate is the metric YouTube's recommendation system and sponsors both care about — it shows momentum better than raw subscriber totals ever could.",
        ["Enter your current subscriber count and the number of subscribers gained in the selected period.",
         "Choose the time window (monthly or weekly) so the tool can annualize the growth rate correctly.",
         "Review your growth rate against the benchmarks: 2-5% monthly is healthy, 10%+ is exceptional, and flat or negative rates signal a content or packaging problem.",
         "Use the output to set a realistic subscriber target for the next 90 days and to spot whether your growth is accelerating or stalling."],
        [("What is a good YouTube subscriber growth rate?", "A monthly growth rate of 2-5% is solid for an established channel; newer channels in a growth phase often see 10%+ while small. The key is trend — accelerating growth signals the algorithm is expanding your reach."),
         ("Why does growth rate matter more than subscriber count?", "Growth rate is momentum. A 10K channel growing 10% a month will overtake a 50K channel growing 1% a month within a year. Sponsors and the algorithm both reward velocity."),
         ("How do I improve my subscriber growth rate?", "Focus on packaging (titles and thumbnails) to lift CTR, end screens and cards to convert viewers into subscribers, and a consistent upload schedule so the algorithm learns your cadence.")],
        ['watch-time-estimator', 'engagement-rate-calculator', 'ctr-impressions-calculator']),

    'keyword-difficulty-scorer': (
        "This scorer estimates how hard a keyword is to rank for on YouTube, using competition signals like the number of competing videos, the authority of channels already ranking, and search volume. It turns a gut feel into a number you can compare across keyword candidates.",
        ["Enter the keyword or phrase you want to rank for.",
         "Optionally add your channel's current subscriber count so the tool weights competition realistically for your size.",
         "Compare scores across your keyword candidates — target low-to-mid difficulty terms with real search volume first.",
         "Pair the winning keywords with the full article on keyword research for a complete workflow."],
        [("What does keyword difficulty mean on YouTube?", "It estimates how hard it is to get a video into the top results for a term, based on who already ranks there and how much authority those channels have. High-volume, high-competition terms are hard for new channels."),
         ("What is a good keyword difficulty score?", "For a channel under 10K subscribers, aim for scores in the low-to-mid range and combine them with long-tail variations. A hard keyword is winnable only with exceptional packaging and retention."),
         ("How is this different from Google keyword difficulty?", "YouTube difficulty weighs video-specific signals — competing videos' view velocity, channel authority, and recency — rather than web pages and backlinks. The two can diverge sharply for the same phrase.")],
        ['keywords-youtube', 'youtube-seo-tools-for-keyword-research-2026', 'competition-analyzer']),

    'watch-time-estimator': (
        "This estimator calculates total watch time (in hours) from views and average view duration — the single metric YouTube's algorithm weights most heavily for ranking and monetization. It shows exactly what a given views count is actually worth.",
        ["Enter your total views and your channel's average view duration in minutes (find both in YouTube Studio > Analytics).",
         "The tool converts the result into watch hours — the unit that matters for both search ranking and the 4,000-hour YPP threshold.",
         "Experiment with scenarios: what happens if average duration rises from 2 to 3 minutes? The output shows how small retention gains compound into large watch-time totals.",
         "Use the target watch-time button to reverse-engineer how many views you need at your current duration to hit a goal."],
        [("Why is watch time so important for YouTube SEO?", "Watch time is the strongest ranking signal in YouTube's recommendation and search systems. Videos that hold viewers longer get shown to more people, creating a compounding growth loop."),
         ("What is a good average view duration?", "It depends on video length — a 30%+ retention on a 10-minute video is strong, while Shorts measure percentage watched differently. Improving duration by even 30 seconds materially boosts total watch hours."),
         ("How many watch hours do I need to monetize?", "The YouTube Partner Program requires 4,000 valid public watch hours in the past 12 months (or 10 million Shorts views in 90 days). This tool shows your progress toward that number.")],
        ['subscriber-growth-calculator', 'youtube-revenue-estimator', 'audience-retention-benchmark']),

    'youtube-revenue-estimator': (
        "This estimator projects YouTube ad revenue from views and RPM (revenue per thousand views). RPM varies wildly by niche — finance and tech channels can earn 10-20x more per view than gaming or entertainment — so the tool lets you adjust for your actual niche.",
        ["Enter your monthly views and your niche's RPM (YouTube Studio > Analytics > Revenue shows your real RPM).",
         "Adjust the RPM for your niche using the built-in guidance — gaming sits low, finance/tech high, education mid-range.",
         "Read the annual projection to understand realistic ad income, then layer in the affiliate and sponsorship revenue you can add on top.",
         "Compare niches or content types to decide where to invest your next videos."],
        [("What is RPM on YouTube?", "RPM (revenue per thousand views) is your total estimated revenue per 1,000 views, including ads, memberships, and other income. It is the most honest number for projecting earnings because it nets out the platform share."),
         ("How much does YouTube pay per 1,000 views?", "It ranges from roughly $0.50 to $10+ depending on niche, audience geography, and ad rates. Finance, real estate, and software content earn the most; gaming and entertainment earn the least."),
         ("Can I make money with a small channel?", "Yes — but ad revenue alone on a small channel is minimal. Most small-channel income comes from affiliate links, sponsorships, and digital products, which this tool's projection helps you size realistically.")],
        ['watch-time-estimator', 'monetization-readiness-checker', 'cost-per-view-calculator']),

    'ctr-impressions-calculator': (
        "This calculator converts between impressions, clicks, and click-through rate (CTR) — the packaging metric that decides whether YouTube keeps showing your video. It tells you how many of the people YouTube showed your video to actually clicked.",
        ["Enter any two of the three values — impressions, clicks, or CTR — and the tool computes the third.",
         "Compare your CTR against the 2-10% benchmark: below 2% means your title and thumbnail are losing to competitors; above 6-8% signals packaging that outperforms your niche.",
         "Use the reverse-calc mode to find out how many impressions you need to reach a target number of views.",
         "When CTR is low, revisit titles and thumbnails before making more content — improving CTR lifts everything downstream."],
        [("What is a good CTR on YouTube?", "A CTR of 2-4% is average, 4-6% is good, and 6%+ is excellent for most niches. Shorts and search results have different baselines, so compare against your own videos rather than global averages."),
         ("Why is my CTR low but views high?", "High views with low CTR usually means most traffic comes from browse/suggested where impressions are huge. The fix is still packaging — better thumbnails lift clicks from every surface."),
         ("Does CTR affect the algorithm?", "Yes. CTR is one of the first signals YouTube evaluates: if a video gets clicked at a high rate, the system promotes it further, expanding impressions in a virtuous cycle.")],
        ['watch-time-estimator', 'youtube-ctr-actually-mean', 'thumbnail-color-analyzer']),

    'cost-per-view-calculator': (
        "This calculator computes the effective cost per view for paid promotion or the value of a view from organic traffic — useful when deciding whether YouTube ads, influencer placements, or organic SEO is the better growth spend.",
        ["Enter the total budget you spent on promotion and the number of views it generated.",
         "The tool returns your cost per view (CPV), which you can compare against the $0.01-0.03 CPV typical of YouTube ads.",
         "Run the same calculation for organic traffic — divide your time cost by views to see how your organic channel compares.",
         "Use the comparison to allocate budget: if organic CPV is lower, invest in SEO content; if paid is lower and content is ready, scale ads."],
        [("What is a good cost per view on YouTube?", "YouTube ads typically run $0.01-0.03 per view depending on targeting and niche. Organic views cost only your production time, so most creators find organic SEO dramatically cheaper long-term."),
         ("Is paying for views worth it?", "Only for jump-starting signals or promoting high-converting content. Views alone don't create loyal subscribers — but a well-optimized video with strong retention can convert paid reach into organic momentum."),
         ("How is CPV different from CPM?", "CPM is the cost per 1,000 impressions (delivered), while CPV is the cost per view (someone actually watching). CPV is the number that reflects real engagement.")],
        ['youtube-revenue-estimator', 'engagement-rate-calculator', 'ctr-impressions-calculator']),

    'engagement-rate-calculator': (
        "This calculator measures your engagement rate — the percentage of viewers who like, comment, share, or subscribe relative to your views. Engagement is the clearest signal YouTube uses to decide whether your audience genuinely values a video.",
        ["Enter your views and the combined number of likes, comments, shares, and new subscribers the video generated.",
         "The tool computes the engagement percentage and benchmarks it against the 3-6% typical range.",
         "Videos with strong engagement get pushed harder — use the output to identify which of your topics your audience actually cares about.",
         "Pair the result with your retention benchmark to separate 'engaged but bounced' from 'watched and loved'."],
        [("What is a good engagement rate on YouTube?", "An engagement rate of 3-6% (interactions per view) is healthy, with higher rates common on smaller, niche channels where audiences are more invested. Shorts tend to run higher on likes but lower on comments."),
         ("How do I increase engagement?", "End every video with a specific question, reply to comments in the first hour to seed discussion, and add engagement hooks like polls and community posts between uploads."),
         ("Does engagement affect YouTube rankings?", "Yes — engagement velocity (how fast likes and comments arrive) is a strong freshness signal. A video that sparks discussion in its first hours gets more recommendation impressions.")],
        ['subscriber-growth-calculator', 'audience-retention-benchmark', 'hashtag-performance-checker']),

    'audience-retention-benchmark': (
        "This benchmark compares your video's audience retention curve against typical performance for your video length, showing you where viewers drop off. Retention is the single biggest lever for YouTube rankings, and this tool tells you exactly where your content loses people.",
        ["Enter your video's average view duration and total length.",
         "The tool returns your retention percentage and a benchmark for videos of similar length.",
         "A drop in the first 30 seconds means your hook fails; a mid-video drop usually means a section drags — check the YouTube Studio retention graph to find the exact timestamp.",
         "Use the guidance to re-cut or re-structure the next video rather than repeating the same pattern."],
        [("What is a good audience retention rate?", "Holding 40-60% of viewers through a 10-minute video is strong; above 60% is exceptional. The first 30 seconds and the final 2 minutes are where most retention is won or lost."),
         ("How do I improve retention?", "Front-load value, cut intros short, use chapter timestamps so viewers can navigate, and pace information with frequent payoff moments. Watch your own graph to find the drop-off timestamps."),
         ("Why does retention matter for SEO?", "YouTube promotes videos that keep viewers watching — high retention triggers more impressions, and better retention per impression compounds into ranking gains.")],
        ['watch-time-estimator', 'youtube-retention-graph-explained-2026', 'video-length-optimizer']),

    'best-posting-time-finder': (
        "This finder estimates the best times to publish based on your audience's likely active windows, so new videos get the strongest possible start in their first hours. Early engagement velocity is one of the strongest freshness signals in YouTube's system.",
        ["Enter your primary audience's timezone and your typical content niche.",
         "The tool returns a ranked list of publish windows, including your audience's evening peak and the 48-hour compounding window.",
         "Test the top two windows against each other for a month — every audience is slightly different, so validate with real data.",
         "Keep consistency: whatever window you choose, a reliable schedule trains both the algorithm and your subscribers."],
        [("Does posting time really matter on YouTube?", "Less than it used to — the algorithm prioritizes relevance over recency — but the first-hour engagement window still matters for videos targeting search and trending topics. Consistency matters more than any single time."),
         ("What is the best time to upload YouTube videos?", "For most audiences, early evening in their timezone (5-8 PM) maximizes initial watch sessions. Gaming and Shorts audiences skew later; education and business content skew to weekday mornings."),
         ("Should I post at the same time every week?", "Yes — a predictable schedule lets subscribers form a habit and gives the algorithm a reliable cadence to learn. Consistency beats optimization for most channels.")],
        ['upload-schedule-optimizer', 'video-length-optimizer', 'youtube-content-strategy-for-beginners-2026']),

    'upload-schedule-optimizer': (
        "This optimizer helps you design a realistic, sustainable upload schedule based on your production capacity, so you publish consistently without burning out. Consistency is the foundation every other SEO tactic builds on.",
        ["Enter how many hours per week you can realistically spend producing videos.",
         "Add your average production time per video (scripting through publishing).",
         "The tool calculates a sustainable cadence — weekly, bi-weekly, or twice-weekly — and suggests a schedule layout.",
         "Commit to the output for 90 days; consistency compounds into algorithm trust and subscriber habit."],
        [("How often should I upload to grow on YouTube?", "Quality-consistent cadence beats frequency: one strong video a week outperforms three rushed ones. The sustainable schedule is the one you can maintain for months — that is the real growth lever."),
         ("Is uploading daily bad for a channel?", "Daily uploads only work if you can maintain quality and retention. Most creators cannot sustain it; a weekly-to-biweekly schedule with strong packaging and SEO wins more often."),
         ("How do I plan content ahead?", "Batch production: one day for research, one for scripting, one for recording, one for editing. A monthly content calendar removes daily decision fatigue and keeps topics intentional.")],
        ['best-posting-time-finder', 'video-idea-generator', 'developing-a-youtube-content-calendar-strategy-2026']),

    'video-length-optimizer': (
        "This optimizer recommends the ideal video length range for your topic and niche by weighing search intent, competition, and audience retention patterns. Length is a strategic decision — too short undersells the topic, too long hurts retention.",
        ["Enter your topic and niche (or let the tool infer from the keyword you paste).",
         "The tool returns a recommended length range and the reasoning — tutorials typically run longer, news and Shorts-style content shorter.",
         "Cross-check with your retention benchmark: if your audience abandons 8-minute videos at minute 4, the length recommendation adjusts.",
         "Structure the recommended length with chapters and payoff moments to hold viewers through the full runtime."],
        [("What is the best YouTube video length in 2026?", "It depends on intent: how-to and educational content performs well at 8-15 minutes, entertainment and vlogs at 5-10, news and commentary shorter, and Shorts under 60 seconds. Match the length to the promise, not a rule."),
         ("Do longer videos rank better?", "Longer videos don't rank better by themselves — total watch time does. A 15-minute video that holds 40% of viewers outranks a 5-minute video that holds 90% only if the longer one generates more total watch hours."),
         ("How do I know if my videos are too long?", "Watch your audience retention graph: if there is a consistent cliff at a specific timestamp, that section is where you lose viewers. Cut or restructure around it rather than guessing.")],
        ['audience-retention-benchmark', 'watch-time-estimator', 'youtube-chapter-timestamps-seo-guide']),

    'keyword-difficulty-scorer': (
        "This scorer estimates how hard a keyword is to rank for on YouTube, using competition signals like the number of competing videos, the authority of channels already ranking, and search volume. It turns a gut feel into a number you can compare across keyword candidates.",
        ["Enter the keyword or phrase you want to rank for.",
         "Optionally add your channel's current subscriber count so the tool weights competition realistically for your size.",
         "Compare scores across your keyword candidates — target low-to-mid difficulty terms with real search volume first.",
         "Pair the winning keywords with the full article on keyword research for a complete workflow."],
        [("What does keyword difficulty mean on YouTube?", "It estimates how hard it is to get a video into the top results for a term, based on who already ranks there and how much authority those channels have. High-volume, high-competition terms are hard for new channels."),
         ("What is a good keyword difficulty score?", "For a channel under 10K subscribers, aim for scores in the low-to-mid range and combine them with long-tail variations. A hard keyword is winnable only with exceptional packaging and retention."),
         ("How is this different from Google keyword difficulty?", "YouTube difficulty weighs video-specific signals — competing videos' view velocity, channel authority, and recency — rather than web pages and backlinks. The two can diverge sharply for the same phrase.")],
        ['keywords-youtube', 'youtube-seo-tools-for-keyword-research-2026', 'competition-analyzer']),
    'competition-analyzer': (
        "<p>This analyzer evaluates how much competition exists for your video topic by weighing the number of established channels covering it, the freshness of top results, and your channel's relative authority. It helps you decide whether to compete head-on, go long-tail, or pick a different angle entirely.</p>",
        ["Enter your video topic or target keyword.",
         "Optionally add your subscriber count so competition is judged relative to your channel size.",
         "Read the verdict: green means winnable, yellow means choose a long-tail angle, red means the top results are locked down by giants.",
         "Use the recommended angle suggestions to differentiate your packaging or topic."],
        [("How do I know if a YouTube topic is too competitive?", "If the top 5 results are all from channels with 10x your authority and published recently, the topic is hard to win head-on. Long-tail variations and unique angles beat brute-force competition."),
         ("What is the best strategy against big channels?", "Out-optimize the packaging (title and thumbnail) and go deeper on a specific sub-topic the big channels cover shallowly. Search intent has many layers; claim one the giants ignore."),
         ("Does channel size decide rankings?", "No — retention, CTR, and watch time decide rankings. Big channels win more often because they optimize better at scale, but a small channel with a perfectly matched video can and does outrank them.")],
        ['keyword-difficulty-scorer', 'keywords-youtube', 'youtube-competitor-analysis-reverse-engineer']),

    'channel-health-score': (
        "<p>This score condenses your channel's overall SEO health into a single number by evaluating your metadata quality, retention signals, upload consistency, and engagement. It is the fastest way to find out which part of your channel is the weakest link holding back growth.</p>",
        ["Answer the short checklist about your titles, thumbnails, retention, upload cadence, and engagement.",
         "The tool weights each area and produces a 0-100 channel health score with a breakdown.",
         "Focus your next two weeks on the lowest-scoring area — that is your highest-leverage fix.",
         "Re-run monthly to track whether your fixes are moving the score."],
        [("What makes a YouTube channel healthy?", "Consistent uploads, strong packaging (title/thumbnail CTR), good retention, and genuine engagement. A healthy channel compounds: each video gets more reach because the library signals quality."),
         ("What is a good channel health score?", "70+ is solid and growing; below 50 means a specific area is dragging you down — usually packaging or consistency. The breakdown tells you exactly which."),
         ("How fast can I improve my channel health?", "Packaging fixes show up within weeks; retention and consistency improvements compound over 2-3 months. The score gives you a measurable target to aim at.")],
        ['channel-audit-score', 'youtube-seo-audit-diagnostic-fix-2026', 'monetization-readiness-checker']),

    'channel-audit-score': (
        "<p>This audit runs your channel through the same checks an SEO consultant would: metadata completeness, title and description optimization, tag usage, thumbnail quality, and content structure. It produces a prioritized list of fixes rather than a vague verdict.</p>",
        ["Enter your channel URL or answer the audit questions about your current metadata.",
         "The tool scores each audit category and lists concrete fixes in priority order.",
         "Tackle the high-impact fixes first — they are the ones directly tied to impressions and CTR.",
         "Re-audit after applying the fixes to measure the delta."],
        [("What does a YouTube SEO audit check?", "It checks the elements that determine impressions and clicks: titles, descriptions, tags, thumbnails, chapters, playlists, and channel structure. Each element has a best-practice baseline the audit scores against."),
         ("How often should I audit my channel?", "Quarterly is the right cadence for a full audit, plus a quick metadata check before every upload. Audits catch the slow drift in packaging quality that quietly kills CTR."),
         ("What is the highest-impact audit finding?", "Usually packaging — weak titles or thumbnails. Fixing CTR lifts every metric downstream: impressions expand, retention matters more, and watch time grows.")],
        ['channel-health-score', 'youtube-seo-template-2026', 'metadata-youtube']),

    'monetization-readiness-checker': (
        "<p>This checker tells you exactly how close your channel is to YouTube Partner Program eligibility and what is still missing. It evaluates the three YPP requirements — subscribers, watch hours, and policy compliance — against your current numbers.</p>",
        ["Enter your current subscriber count and total watch hours (from YouTube Studio).",
         "The tool compares against the YPP thresholds: 1,000 subs + 4,000 watch hours (or 10M Shorts views in 90 days).",
         "Read the gap analysis to see precisely what is missing and by how much.",
         "Use the milestone guidance to set a realistic timeline for qualification."],
        [("What are the YouTube monetization requirements in 2026?", "The standard path requires 1,000 subscribers and 4,000 valid public watch hours in the past 12 months. The Shorts path requires 1,000 subscribers and 10 million Shorts views in 90 days. You also need no active strikes and a linked AdSense account."),
         ("Can I monetize Shorts without watch hours?", "Yes — the Shorts-only path replaces the 4,000 watch-hour requirement with 10 million Shorts views in 90 days. Revenue from Shorts uses a different pool but still requires the same 1,000-subscriber gate."),
         ("Why is my channel not eligible yet?", "The checker shows exactly which threshold is unmet. The most common blocker is watch hours on channels that publish Shorts only, or subscriber counts that stall after packaging quality drops.")],
        ['youtube-revenue-estimator', 'youtube-monetization-2026', 'youtube-shorts-monetization-requirements-2026']),

    'video-idea-generator': (
        "<p>This generator produces video ideas that are actually searchable — it combines your niche with proven YouTube content formats and keyword patterns instead of generic suggestions. Every idea comes with a title angle and a search-intent note.</p>",
        ["Enter your niche or channel topic.",
         "Optionally add a keyword you want to target so the ideas cluster around existing demand.",
         "Review the generated ideas and their formats — tutorials, comparisons, lists, case studies.",
         "Pick the idea with the clearest search intent and run it through the keyword tools before producing."],
        [("How do I come up with YouTube video ideas that rank?", "Start from search demand, not inspiration: mine YouTube autocomplete, keyword tools, and competitor gaps. Then map each idea to a proven format — tutorial, comparison, mistake list, case study — that matches the intent."),
         ("How many video ideas should I plan ahead?", "Plan 8-12 ideas per month as a working backlog. A monthly calendar of ideas removes the daily 'what should I film' decision and keeps topics aligned with your SEO targets."),
         ("What video formats rank best?", "How-to tutorials, comparison videos, and mistake-driven lists consistently rank for search intent. Formats that answer a specific question outperform broad entertainment content in search results.")],
        ['keywords-youtube', 'upload-schedule-optimizer', 'youtube-video-ideas-2026']),

    'hashtag-performance-checker': (
        "<p>This checker evaluates your hashtag strategy — how many hashtags you use, whether they are relevant, and how they compare to your niche's conventions. Hashtags are a secondary discovery signal, and getting them wrong wastes an easy optimization.</p>",
        ["Enter the hashtags you plan to use on a video.",
         "The tool checks count (3-5 is the sweet spot), relevance, and character budget against best practice.",
         "Read the recommendations on replacing generic hashtags with niche-specific ones.",
         "Apply the corrected set before publishing, and track impressions for hashtag-sourced traffic."],
        [("How many hashtags should I use on YouTube?", "3-5 targeted hashtags is the recommended range. YouTube shows up to 3 above your title and uses them for discovery; more than 5 risks looking spammy without adding reach."),
         ("Do hashtags help YouTube SEO?", "Yes, as a secondary signal — they help YouTube understand topic and connect your video to hashtag discovery surfaces. They matter far less than title, thumbnail, and description, but they are free optimization."),
         ("Should I put hashtags in the title or description?", "In the description, with the primary 3 optionally in the description's first line. Never stuff hashtags into titles — it damages CTR and reads as spam.")],
        ['tag-relevance-checker', 'youtube-tags-2026', 'youtube-description-templates-2026']),

    'tag-relevance-checker': (
        "<p>This checker scores how relevant your tag list is to the actual video content, flagging the common mistakes — irrelevant tags, keyword stuffing, and single-word tags — that waste your 500-character tag budget.</p>",
        ["Paste your current tag list (from YouTube Studio) into the tool.",
         "Enter your video's primary topic so relevance can be scored.",
         "The tool flags irrelevant and low-value tags and shows what to remove.",
         "Use the tag suggestions to rebuild a tight, relevant list under 500 characters."],
        [("Do YouTube tags still matter in 2026?", "Yes, but less than before — YouTube says tags mainly help with misspellings and alternate phrasings. They are a minor signal behind title, thumbnail, and description, so use them to cover spelling variants and synonyms, not to stuff keywords."),
         ("How many tags should I use?", "Use 5-15 highly relevant tags or roughly 250-400 characters. Quality beats quantity: a tight list of relevant tags outperforms 30 generic ones."),
         ("What tags should I never use?", "Irrelevant trending tags, competitor channel names, and single-word tags like 'funny' that describe nothing. These waste budget and can look spammy to YouTube's systems.")],
        ['hashtag-performance-checker', 'youtube-tags-2026', 'best-youtube-tags-2026']),

    'thumbnail-color-analyzer': (
        "<p>This analyzer evaluates your thumbnail's color strategy — contrast, color psychology, and how it will stand out in a crowded sidebar of competing thumbnails. Color is the first thing a viewer's eye registers, often before the subject or text.</p>",
        ["Describe your thumbnail's dominant colors and background, or upload the color values.",
         "The tool scores contrast against YouTube's interface and your niche's typical thumbnail palette.",
         "Read the psychology notes — warm colors for urgency, complementary pairs for contrast, brand colors for recognition.",
         "Apply the recommendations when designing your next thumbnail in Canva or Photoshop."],
        [("What colors work best for YouTube thumbnails?", "High-contrast combinations like blue/orange or yellow/dark perform well because they pop against YouTube's white and dark interfaces. Warm colors (red, orange, yellow) draw the eye; keep one dominant color and one accent."),
         ("Why do my thumbnails not stand out?", "Usually low contrast against the page background or a palette that matches every competitor. Zoom your thumbnail out to 10% size — if it blends, viewers at browsing speed will ignore it."),
         ("Should I use the same colors for every thumbnail?", "A consistent brand accent helps recognition, but varying the dominant color keeps your thumbnails from becoming wallpaper. Balance brand consistency with per-video contrast.")],
        ['youtube-thumbnail-tips-2026', 'creating-effective-youtube-thumbnails-for-clicks-2026', 'youtube-thumbnail-ab-testing-guide']),

    'title-ab-tester': (
        "<p>This tester generates and scores competing title options for your video, checking each against the proven CTR levers — keyword placement, power words, numbers, brackets, and emotional triggers. A/B testing titles before publishing beats guessing after.</p>",
        ["Enter your video topic or a draft title.",
         "The tool generates several title variants with different hooks and scores each.",
         "Compare the scores and pick the winner, or combine the strongest elements.",
         "Use YouTube's built-in Test & Compare feature post-publish to validate with real data."],
        [("What makes a high-CTR YouTube title?", "Front-loaded keywords, numbers, power words (easy, ultimate, secret), brackets ([2026], [Tested]), and a specific promise. Titles that raise a curiosity gap without clickbait outperform vague descriptions."),
         ("How do I A/B test YouTube titles?", "Use YouTube Studio's Test & Compare to run two thumbnails against each other, and test titles by changing them after 24-48 hours while watching impressions and CTR. This tool gives you strong candidates to test."),
         ("How long should a YouTube title be?", "Aim for 50-60 characters so it is not truncated on most devices. Put the primary keyword in the first 40 characters — that is the part viewers see first in search.")],
        ['youtube-title-examples-2026', 'youtube-title-optimization-guide-2026', 'metadata-youtube']),

    'description-quality-checker': (
        "<p>This checker evaluates your video description against the elements that improve ranking and session time: keyword placement, length, timestamps, hashtags, links, and a clear CTA. Descriptions are underused by most creators — this tool fixes that.</p>",
        ["Paste your current description into the tool.",
         "Enter your primary keyword so placement can be scored.",
         "The tool flags missing elements — no timestamps, no hashtags, thin text, no CTA.",
         "Apply the fixes and rebuild your description template for future uploads."],
        [("How long should a YouTube description be?", "200+ words with the primary keyword in the first 2 sentences. YouTube reads the first ~100-150 characters in search snippets, so front-load the value and the keyword."),
         ("Do descriptions help with YouTube SEO?", "Yes — they help YouTube understand the video's topic (especially with transcript alignment) and give viewers reason to click through the search snippet. They are secondary to title and thumbnail but free to optimize."),
         ("Should I put timestamps in the description?", "Absolutely — timestamps improve session time by letting viewers jump to the section they need, which signals relevance and keeps people watching longer.")],
        ['metadata-youtube', 'youtube-description-templates-2026', 'how-to-metadata-youtube']),

    'end-screen-effectiveness-checker': (
        "<p>This checker evaluates your end screen strategy — which elements you promote, where they appear, and whether they convert viewers into the next video. End screens and cards are the cheapest session-time engine in YouTube SEO.</p>",
        ["Answer the questions about your current end screen setup and card usage.",
         "The tool scores your session-building strategy and shows where viewers leak.",
         "Read the recommendations for which videos to promote in the end screen.",
         "Apply the fix — promote your best-performing related video, not your newest one."],
        [("What should I put in my YouTube end screen?", "Your best-performing related video, a playlist, and optionally a subscribe button. Promote the video most likely to keep the viewer watching your library, not necessarily the newest upload."),
         ("How do end screens improve SEO?", "They increase session watch time — viewers who click through watch more of your content, which signals to YouTube that your channel satisfies viewers. More session time means more recommendations."),
         ("How many cards should I use per video?", "3-5 relevant cards spread through the video, timed to topical moments. Cards that appear when the viewer is engaged with the topic convert far better than cards crammed at the start or end.")],
        ['youtube-end-screens-cards-guide-2026', 'youtube-playlist-optimization-strategy', 'watch-time-estimator']),

    'playlist-performance-analyzer': (
        "<p>This analyzer evaluates your playlist structure — how videos are ordered, whether playlists autoplay, and how they feed the algorithm's session signals. Playlists are one of the most underrated levers in YouTube SEO because they turn single views into binge sessions.</p>",
        ["Enter your playlist URL or describe your playlist structure.",
         "The tool scores ordering, autoplay, and description completeness.",
         "Read the recommendations on reordering videos to maximize session flow.",
         "Apply the changes and watch average session duration on playlist views."],
        [("Do playlists help YouTube SEO?", "Yes — playlists drive session watch time and give YouTube a structured signal about your content's relationship. Playlists that autoplay through multiple videos increase total watch time per visit, a strong ranking input."),
         ("How should I order videos in a playlist?", "Start with your best-performing video as the hook, then order by dependency (beginners first) or by descending watch time. The first video determines whether the playlist session continues."),
         ("Should playlists be public?", "Yes — public playlists appear in search and on your channel page. A well-titled playlist ('How to Grow on YouTube: Complete Guide') can rank as its own search result.")],
        ['video-length-optimizer', 'youtube-playlist-optimization-strategy', 'audience-retention-benchmark']),

    'best-youtube-tags-2026': (
        "<p>This tool generates the best-performing YouTube tag strategies for 2026, combining broad niche terms, long-tail phrases, and spelling variants within YouTube's 500-character limit. Tags remain a minor ranking signal, but they cover the misspellings and phrasings your title cannot.</p>",
        ["Enter your video topic or seed keywords.",
         "The tool generates a 500-character-optimized tag list with broad, medium, and long-tail tiers.",
         "Copy the list into YouTube Studio's tags field.",
         "Combine with the tag generator for niche-specific variants."],
        [("What are the best YouTube tags in 2026?", "A mix of your exact title phrase, 2-3 long-tail variations, broad category terms, and common misspellings. The exact-title tag matters most; everything else should be relevant variations within 500 characters."),
         ("How many characters of tags should I use?", "Use the full 500-character budget but never pad it with irrelevant terms. YouTube counts characters, not tag count — a tight 500-character relevant list is ideal."),
         ("Do tags matter less than they used to?", "Yes — YouTube de-emphasized tags in favor of AI content understanding. Use them to reinforce spelling variants and alternate phrasings, not as a primary ranking strategy.")],
        ['tag-relevance-checker', 'youtube-tags-2026', 'youtube-title-examples-2026']),

}


# Fallback content builder for tools not in the map (uses h1-derived topic)
def fallback_content(slug, h1):
    topic = re.sub(r'^[^\w]+', '', h1).strip()
    topic = re.sub(r'— Free Interactive Tool.*$', '', topic).strip()
    return (
        f"<p>This free {topic.lower()} tool is part of the YT SEO Architect toolkit. It runs entirely in your browser — no login, no limits, no catch — and turns a YouTube SEO task into a one-click action. Whether you are new to YouTube or optimizing your hundredth video, this tool gives you an immediate, data-informed answer instead of a spreadsheet.</p>"
        f"<p>Every tool in the suite follows the same philosophy: analyze, generate, and apply. You enter your details, the tool does the heavy lifting, and you walk away with an optimization you can copy straight into YouTube Studio. The tool also links to the full in-depth guide on the same topic, where every recommendation is explained with examples and benchmarks.</p>"
        f"<p>Why does this matter for your channel? YouTube rewards videos that earn clicks and hold attention, and every optimization this tool generates targets one of those two levers. Small improvements compound: a title that lifts CTR by even one percentage point means thousands of extra impressions over a video's lifetime, and better metadata tells the algorithm exactly who should see your content. Consistency across every upload is what turns a single good video into a library that ranks.</p>",
        ["Enter your video or channel details into the fields above.",
         "Click the action button and let the tool analyze, generate, or score your input.",
         "Copy the result with the copy buttons and apply it directly in YouTube Studio.",
         "Repeat the check on your back catalog — old videos often gain more from optimization than new ones do.",
         "Read the linked guide for the full strategy behind the tool's recommendations."],
        [("Is this tool really free?", "Yes — every tool in YT SEO Architect is 100% free with no credits, no subscription, and no login required. The tools run entirely in your browser, so your data never leaves your device."),
         ("How accurate is this tool?", "The tool applies YouTube best practices and known benchmark data to your input. For channel-specific numbers, always cross-check with your YouTube Studio analytics — the tool is a decision aid, not a guarantee."),
         ("How does this compare to paid tools like vidIQ or TubeBuddy?", "This tool covers the same core workflows — optimization, scoring, and research — for free, with a guide explaining the reasoning behind every result. Paid tools add depth like historical trend data; this covers the essential 80% without the subscription."),
         ("How often should I use this tool?", "Use it before every upload for metadata tasks, and run the scoring tools on your back catalog monthly. Optimization is not a one-time fix — YouTube's systems and your competition change constantly.")],
        ['youtube-seo-template-2026', 'rank-on-youtube-2026', 'youtube-seo-checklist-beginners-2026'],
    )


def build_section(slug, h1):
    if slug in CONTENT:
        purpose, howto, faq, related = CONTENT[slug]
        # Beef up custom entries: add a shared "why it matters" paragraph + 4th FAQ
        purpose = purpose + (
            '<p>Why this matters: YouTube\'s algorithm is a feedback loop — better metadata earns more impressions, more impressions surface your retention, and strong retention expands reach further. Tools like this one exist to make sure you are optimizing every variable in that loop, on every upload, without needing a consultant\'s budget. Used consistently, the small gains from each check compound into a channel that ranks.</p>'
            '<p>The YT SEO Architect approach is deliberately simple: run the check, apply the result, move on. No dashboards to babysit, no credits to count. If you pair this tool with the matching guide on the blog, you get the "why" behind every "what" — the benchmarks, the examples, and the mistakes to avoid — so you are never applying advice blindly.</p>')
        faq = faq + [("How does this tool fit into a full YouTube SEO workflow?",
                      "It covers one specific lever in the optimization stack. Use it alongside the title, description, tag, and thumbnail tools for a complete pre-publish checklist, then validate the results against your YouTube Studio analytics over the following weeks."),
                     ("Will this tool work for my channel size?",
                      "Yes — the recommendations are size-agnostic because they follow YouTube's ranking fundamentals, which apply equally to a 100-subscriber channel and a million-subscriber channel. What changes with size is how fast results show, not whether the optimization is correct.")]
    else:
        purpose, howto, faq, related = fallback_content(slug, h1)

    steps = ''.join(f'<li>{s}</li>' for s in howto)
    faqs = ''.join(
        f'<div class="faq-item" style="margin-bottom:1rem;"><h3 style="font-size:1rem;color:var(--text-primary);margin-bottom:.3rem;">{q}</h3>'
        f'<p style="color:var(--text-secondary);font-size:.9rem;line-height:1.7;margin:0;">{a}</p></div>'
        for q, a in faq)
    rel = ''.join(f'<a href="/tools/{r}" style="display:inline-block;margin:.25rem .5rem .25rem 0;background:rgba(0,242,255,.08);border:1px solid rgba(0,242,255,.15);color:var(--cyan);padding:.35rem .8rem;border-radius:9999px;font-size:.8rem;font-weight:600;text-decoration:none;">{r.replace("-", " ")}</a>' for r in related)

    return f'''
    <div class="seo-content" style="max-width:760px;margin:2.5rem auto 0;padding-top:2rem;border-top:1px solid var(--border);">
      <h2 style="font-size:1.35rem;font-weight:800;color:var(--text-primary);margin-bottom:.75rem;">About This Tool</h2>
      {purpose}
      <h2 style="font-size:1.35rem;font-weight:800;color:var(--text-primary);margin:1.5rem 0 .75rem;">How to Use It</h2>
      <ol style="color:var(--text-secondary);line-height:1.8;padding-left:1.25rem;">{steps}</ol>
      <h2 style="font-size:1.35rem;font-weight:800;color:var(--text-primary);margin:1.5rem 0 .75rem;">Frequently Asked Questions</h2>
      {faqs}
      <h2 style="font-size:1.35rem;font-weight:800;color:var(--text-primary);margin:1.5rem 0 .75rem;">Related Tools</h2>
      <div style="margin-bottom:.5rem;">{rel}</div>
    </div>
'''


def inject(fpath, force=False):
    html = open(fpath, encoding="utf-8").read()
    if "seo-content" in html:
        if not force:
            return False  # already injected
        # remove existing section for clean re-injection
        html = re.sub(r'\s*<div class="seo-content"[\s\S]*?</div>\s*</div>', '\n', html, count=1)
        html = re.sub(r'\s*<div class="seo-content"[\s\S]*?</div>\s*</main>', '\n', html, count=1)
        html = re.sub(r'\s*<div class="seo-content"[\s\S]*?</div>\s*<footer', '\n<footer', html, count=1)
    h1m = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
    h1 = h1m.group(1).strip() if h1m else ''
    slug = fpath.split('/')[-1].replace('.html', '')
    section = build_section(slug, h1)
    # Template A: blog-tool pages have '<div class="footer">'; Template B: metric tools have '</main>'
    # Template C: some tools use '<footer class="site-footer">'
    m = re.search(r'\s*<div class="footer">', html)
    if m:
        html = html[:m.start()] + '\n' + section + '\n  ' + html[m.start():]
    else:
        m = re.search(r'\s*<footer class="site-footer">', html)
        if m:
            html = html[:m.start()] + '\n' + section + '\n  ' + html[m.start():]
        else:
            m = re.search(r'\s*</main>', html)
            if not m:
                print(f"SKIP (no marker): {slug}")
                return False
            html = html[:m.start()] + '\n' + section + '\n  ' + html[m.start():]
    open(fpath, "w", encoding="utf-8").write(html)
    return True


def main():
    args = [a for a in sys.argv[1:]]
    force = '--force' in args
    only = next((a for a in args if not a.startswith('--')), None)
    done = 0
    for f in sorted(glob.glob(f"{TOOLS_DIR}/*.html")):
        slug = f.split('/')[-1].replace('.html', '')
        if slug == 'index':
            continue
        if only and slug != only:
            continue
        if inject(f, force=force):
            done += 1
            print(f"  injected: {slug}")
    print(f"\nDone: {done} tool pages enriched")


if __name__ == '__main__':
    main()
