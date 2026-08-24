#!/usr/bin/env python3
"""Rebuild the 5 broken tool pages (tool-root rendered 'undefined').
Replaces the placeholder div with a real, SEO-visible UI (forms + result boxes)
and removes the broken innerHTML='undefined' assignment."""
import re, json

def fix_tool(path, ui_html, logic_call):
    s = open(path).read()
    # 1. Replace the placeholder div with the real UI (SEO-visible, works without JS)
    old_div = '<div id="tool-root">undefined</div>'
    assert old_div in s, f"{path}: placeholder div not found"
    s = s.replace(old_div, f'<div id="tool-root">\n{ui_html}\n    </div>', 1)
    # 2. Remove the broken assignment that overwrote the UI with the string "undefined"
    old_assign = "  document.getElementById('tool-root').innerHTML = `undefined`;"
    assert old_assign in s, f"{path}: broken assignment not found"
    s = s.replace(old_assign, "  // tool UI rendered statically; logic wired via onclick", 1)
    open(path, 'w').write(s)
    # 3. Validate: no more 'undefined' overwrite, UI present, JSON-LD still valid
    assert 'innerHTML = `undefined`' not in s, f"{path}: broken assignment remains"
    assert 'tool-root' in s
    for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        json.loads(b)
    print(f"OK {path}")

INPUT = '<div class="input-group"><label for="{i}">{l}</label><input id="{i}" type="{t}" placeholder="{p}"{extra} /></div>'
SELECT = '<div class="input-group"><label for="{i}">{l}</label><select id="{i}">{opts}</select></div>'
BTN = '<button onclick="{call}">Calculate</button>'

# ---------- 1. keyword-difficulty-scorer ----------
kd_ui = f'''
      <div class="tool-card">
        <h2>Score Your Keyword</h2>
        <div class="input-group"><label for="kd-keyword">Keyword</label><input id="kd-keyword" type="text" placeholder="e.g. how to grow a youtube channel" /></div>
        <div class="input-row">
          <div class="input-group"><label for="kd-volume">Monthly search volume (est.)</label><input id="kd-volume" type="number" placeholder="e.g. 1500" /></div>
          <div class="input-group"><label for="kd-competition">Competition level</label><select id="kd-competition"><option value="1">Very Low</option><option value="2">Low</option><option value="3" selected>Medium</option><option value="4">High</option><option value="5">Very High</option></select></div>
        </div>
        <button onclick="document.getElementById('kd-result-box').classList.add('show');ToolLogic.scoreKeyword()">Score Keyword</button>
        <div class="result-box" id="kd-result-box">
          <div class="result-big" id="kd-score">—</div>
          <div class="result-detail">Keyword difficulty score (0-100)</div>
          <div class="result-row"><span class="label">Opportunity score</span><span class="value" id="kd-opportunity">—</span></div>
          <div class="result-row"><span class="label">Difficulty grade</span><span class="value" id="kd-grade">—</span></div>
          <div class="advice-box" id="kd-advice">💡 Enter a keyword to get scoring advice.</div>
          <div id="kd-factors"></div>
        </div>
      </div>'''

fix_tool('public/tools/keyword-difficulty-scorer.html', kd_ui, 'ToolLogic.scoreKeyword()')

# ---------- 2. watch-time-estimator ----------
wt_ui = f'''
      <div class="tool-card">
        <h2>Estimate Watch Time</h2>
        <div class="input-group"><label for="wt-views">Total views</label><input id="wt-views" type="number" placeholder="e.g. 100000" /></div>
        <div class="input-group"><label for="wt-duration">Average view duration (seconds)</label><input id="wt-duration" type="number" placeholder="e.g. 240" /></div>
        <button onclick="document.getElementById('wt-result-box').classList.add('show');ToolLogic.calcWatchTime()">Calculate Watch Time</button>
        <div class="result-box" id="wt-result-box">
          <div class="result-big" id="wt-minutes">—</div>
          <div class="result-detail">total watch minutes</div>
          <div class="result-row"><span class="label">Watch hours</span><span class="value" id="wt-hours">—</span></div>
          <div class="result-row"><span class="label">Calculation</span><span class="value" id="wt-per-video">—</span></div>
          <div class="advice-box" id="wt-eligibility">⏳ Enter views + duration to check YPP eligibility.</div>
        </div>
      </div>'''

fix_tool('public/tools/watch-time-estimator.html', wt_ui, 'ToolLogic.calcWatchTime()')

# ---------- 3. ctr-impressions-calculator ----------
ctr_ui = f'''
      <div class="tool-card">
        <h2>Calculate CTR</h2>
        <div class="input-group"><label for="ctr-views">Views (clicks)</label><input id="ctr-views" type="number" placeholder="e.g. 5000" /></div>
        <div class="input-group"><label for="ctr-impressions">Impressions</label><input id="ctr-impressions" type="number" placeholder="e.g. 100000" /></div>
        <button onclick="document.getElementById('ctr-result-box').classList.add('show');ToolLogic.calcCTR()">Calculate CTR</button>
        <div class="result-box" id="ctr-result-box">
          <div class="result-big" id="ctr-result">—</div>
          <div class="result-detail" id="ctr-detail">click-through rate</div>
          <div class="result-row"><span class="label">Grade</span><span class="value" id="ctr-grade">—</span></div>
        </div>
      </div>
      <div class="tool-card">
        <h2>Find Impressions Needed for a Target CTR</h2>
        <div class="input-group"><label for="imp-target-views">Target views</label><input id="imp-target-views" type="number" placeholder="e.g. 10000" /></div>
        <div class="input-group"><label for="imp-target-ctr">Target CTR (%)</label><input id="imp-target-ctr" type="number" step="0.1" placeholder="e.g. 5" /></div>
        <button onclick="document.getElementById('imp-result-box').classList.add('show');ToolLogic.calcImpressions()">Calculate</button>
        <div class="result-box" id="imp-result-box">
          <div class="result-big" id="imp-result">—</div>
          <div class="result-detail" id="imp-detail">impressions needed</div>
        </div>
      </div>'''

fix_tool('public/tools/ctr-impressions-calculator.html', ctr_ui, 'ToolLogic.calcCTR()')

# ---------- 4. subscriber-growth-calculator ----------
gr_ui = f'''
      <div class="tool-card">
        <h2>Calculate Growth Rate</h2>
        <div class="input-group"><label for="gr-start">Starting subscribers</label><input id="gr-start" type="number" placeholder="e.g. 1000" /></div>
        <div class="input-group"><label for="gr-end">Subscribers now</label><input id="gr-end" type="number" placeholder="e.g. 1500" /></div>
        <div class="input-group"><label for="gr-days">Days between</label><input id="gr-days" type="number" placeholder="e.g. 30" /></div>
        <button onclick="document.getElementById('gr-result-box').classList.add('show');ToolLogic.calcGrowth()">Calculate Growth</button>
        <div class="result-box" id="gr-result-box">
          <div class="result-row"><span class="label">Subscribers gained</span><span class="value" id="gr-gained">—</span></div>
          <div class="result-row"><span class="label">Total growth</span><span class="value" id="gr-pct">—</span></div>
          <div class="result-row"><span class="label">Daily rate</span><span class="value" id="gr-daily">—</span></div>
          <div class="result-row"><span class="label">Weekly rate</span><span class="value" id="gr-weekly">—</span></div>
          <div class="result-row"><span class="label">Monthly rate</span><span class="value" id="gr-monthly">—</span></div>
          <div class="result-row"><span class="label">Projected subs (90 days)</span><span class="value" id="gr-proj-90">—</span></div>
          <div class="result-row"><span class="label">Projected subs (365 days)</span><span class="value" id="gr-proj-365">—</span></div>
          <div class="result-row"><span class="label">Growth grade</span><span class="value" id="gr-grade">—</span></div>
        </div>
      </div>'''

fix_tool('public/tools/subscriber-growth-calculator.html', gr_ui, 'ToolLogic.calcGrowth()')

# ---------- 5. youtube-revenue-estimator ----------
rev_ui = f'''
      <div class="tool-card">
        <h2>Estimate Revenue</h2>
        <div class="input-group"><label for="rev-views">Monthly views</label><input id="rev-views" type="number" placeholder="e.g. 500000" /></div>
        <div class="input-row">
          <div class="input-group"><label for="rev-cpm">CPM ($)</label><input id="rev-cpm" type="number" step="0.1" placeholder="e.g. 5" /></div>
          <div class="input-group"><label for="rev-rpm">RPM ($, optional)</label><input id="rev-rpm" type="number" step="0.1" placeholder="e.g. 2" /></div>
        </div>
        <button onclick="document.getElementById('rev-result-box').classList.add('show');ToolLogic.calcRevenue()">Estimate Revenue</button>
        <div class="result-box" id="rev-result-box">
          <div class="result-row"><span class="label">Revenue (CPM)</span><span class="value" id="rev-cpm-result">—</span></div>
          <div class="result-row"><span class="label">Revenue (RPM)</span><span class="value" id="rev-rpm-result">—</span></div>
          <div class="result-row"><span class="label">Monthly estimate</span><span class="value" id="rev-monthly">—</span></div>
          <div class="result-row"><span class="label">Yearly estimate</span><span class="value" id="rev-yearly">—</span></div>
          <div class="result-detail" id="rev-detail"></div>
          <div class="advice-box" id="rev-benchmark">📊 Enter views + CPM for a benchmark.</div>
        </div>
      </div>'''

fix_tool('public/tools/youtube-revenue-estimator.html', rev_ui, 'ToolLogic.calcRevenue()')

print("\nAll 5 tool UIs rebuilt.")
