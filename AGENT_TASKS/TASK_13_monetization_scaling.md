# TASK 13 — Monetization: Team Scaling & Viral Referral Engine

## Goal
Transform the platform into a multi-user B2B SaaS with advanced monetization features. This task implements Team Workspaces, a Credit Intelligence Dashboard (to prevent token leakage), and a Viral Referral Engine to lower customer acquisition costs (CAC).

---

## STEP 1 — Monetization & Team Tables

**Modify file: `src/database/services.js`**

```js
db.exec(`
  -- Team Workspaces
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    plan_tier TEXT DEFAULT 'free', -- 'free', 'pro', 'agency'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Team Memberships
  CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8))),
    workspace_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    role TEXT DEFAULT 'editor', -- 'admin', 'editor', 'viewer'
    status TEXT DEFAULT 'pending', -- 'pending', 'active'
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  );

  -- Viral Referral System
  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8))),
    referrer_id TEXT NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,
    referred_email TEXT UNIQUE,
    status TEXT DEFAULT 'invited', -- 'invited', 'signed_up', 'converted'
    reward_granted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Credit Intelligence Log (Predictive Billing)
  CREATE TABLE IF NOT EXISTS credit_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    feature TEXT NOT NULL, -- 'ai_generation', 'seo_scan', 'thumbnail'
    tokens_used INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_usage_user ON credit_usage_logs(user_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_referral_code ON referrals(referral_code);
`);
```

---

## STEP 2 — Team Collaboration API

**Create file: `api/monetization/team-ops.js`**

```js
import express from 'express';
export const router = express.Router();

const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

// ── Route: Invite member to team ──
router.post('/invite', async (req, res) => {
  try {
    const { workspaceId, email, role } = req.body;
    const { default: db } = await import('../../src/database/services.js');
    
    // Check if user is workspace owner
    // ... logic here ...

    db.prepare(`
      INSERT INTO team_members (workspace_id, user_email, role)
      VALUES (?, ?, ?)
    `).run(workspaceId, email, role || 'editor');

    // In production, send invitation email here
    sendRes(res, 200, { success: true, message: `Invite sent to ${email}` });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Get team usage stats ──
router.get('/usage/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { default: db } = await import('../../src/database/services.js');
    
    const usage = db.prepare(`
      SELECT feature, SUM(tokens_used) as total_tokens, SUM(cost_usd) as total_cost
      FROM credit_usage_logs
      WHERE user_id IN (SELECT user_email FROM team_members WHERE workspace_id = ?)
      GROUP BY feature
    `).all(workspaceId);

    sendRes(res, 200, { usage });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 3 — Viral Referral API

**Create file: `api/monetization/referrals.js`**

```js
import express from 'express';
export const router = express.Router();

const sendRes = (res, s, d) => !res.headersSent && res.status(s).json(d);

// ── Route: Get my referral code & stats ──
router.get('/my-stats', async (req, res) => {
  try {
    const { userId } = req.query; // Auth middleware should provide this
    const { default: db } = await import('../../src/database/services.js');
    
    let ref = db.prepare(`SELECT * FROM referrals WHERE referrer_id = ?`).get(userId);
    if (!ref) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      db.prepare(`INSERT INTO referrals (referrer_id, referral_code) VALUES (?, ?)`).run(userId, code);
      ref = { referral_code: code };
    }

    const stats = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM referrals WHERE referrer_id = ? 
      GROUP BY status
    `).all(userId);

    sendRes(res, 200, { code: ref.referral_code, stats });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 4 — Dashboard UI: "Billing & Team"

**Modify file: `dashboard.html`**

Add a dedicated tab for managing monetization, teams, and referrals.

```html
<!-- Tab Link -->
<div class="nav-item" onclick="showTab('billing-team')">
  <i class="fas fa-wallet"></i> Billing & Team
</div>

<!-- Billing & Team Content -->
<div id="billing-team" class="tab-content" style="display:none">
  <div class="grid-2">
    <!-- Credit Intelligence -->
    <div class="section-card">
      <h3>Credit Intelligence</h3>
      <div class="usage-chart-container">
        <canvas id="credit-usage-chart"></canvas>
      </div>
      <div class="mt-1">
        <p>Estimated Token Cost (MTD): <span id="token-cost-mtd">$0.00</span></p>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:45%"></div></div>
        <small>4,500 / 10,000 Credits Used</small>
      </div>
    </div>

    <!-- Referral Engine -->
    <div class="section-card">
      <h3>Viral Growth</h3>
      <div class="referral-box">
        <p>Invite friends and earn 5,000 bonus credits!</p>
        <div class="share-link-group">
          <input type="text" id="ref-link" readonly value="https://ytseo.ai/join/REF123">
          <button onclick="copyRef()">Copy</button>
        </div>
      </div>
      <div class="referral-stats mt-2">
        <div class="stat-pill">Pending: 3</div>
        <div class="stat-pill success">Earned: 10,000</div>
      </div>
    </div>
  </div>

  <div class="section-card mt-2">
    <h3>Team Collaboration</h3>
    <table id="team-table">
      <thead>
        <tr><th>Member</th><th>Role</th><th>Status</th><th>Action</th></tr>
      </thead>
      <tbody id="team-body">
        <!-- Members here -->
      </tbody>
    </table>
    <button class="btn-sm mt-1" onclick="openInviteModal()">+ Invite Member</button>
  </div>
</div>
```

---

## Acceptance Criteria

1. "Billing & Team" tab displays real credit usage data from `credit_usage_logs`.
2. Referral system generates unique codes for every user and tracks signups.
3. Users can invite team members by email; invited members are added to the workspace.
4. Usage stats can be aggregated at the workspace level (Agency view).
5. UI follows the "Cyber-Luxe" design language (HSL colors, glassmorphism).

## Files Changed
- `src/database/services.js` — MODIFIED (4 new tables)
- `api/monetization/team-ops.js` — NEW
- `api/monetization/referrals.js` — NEW
- `dashboard.html` — MODIFIED (Billing tab)
- `main.js` — MODIFIED (Router registration + UI logic)
- `AGENT_TASKS/README.md` — MODIFIED (Index update)
