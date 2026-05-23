// Nurture cron handler — processes users through email sequence
import { sendNurtureEmail, welcomeEmail, auditEmail, reminderEmail } from './_lib/nurture-emails.js';
import dbService from '../src/database/services.js';
import * as schema from '../src/database/schema.js';
import { eq, and, lt, sql } from 'drizzle-orm';

export async function processNurture() {
  if (!dbService.db) {
    return { processed: 0 };
  }

  const now = new Date();
  let sent = 0;

  try {
    // STEP 0 → 1: Users with email but no nurture_step (new signups today)
    const newUsers = await dbService.db
      .select()
      .from(schema.users)
      .where(
        and(
          sql`${schema.users.email} IS NOT NULL`,
          eq(schema.users.nurtureStep, 0),
          sql`${schema.users.email} != ''`
        )
      )
      .limit(20);

    for (const user of newUsers) {
      const email = welcomeEmail(user.channelId);
      const ok = await sendNurtureEmail(user.email, email.subject, email.html);
      if (ok) {
        await dbService.db.update(schema.users)
          .set({ nurtureStep: 1, nurtureUpdatedAt: now })
          .where(eq(schema.users.id, user.id));
        sent++;
      }
    }

    // STEP 1 → 2: Users who got welcome 3+ days ago
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const step1Users = await dbService.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.nurtureStep, 1),
          sql`${schema.users.nurtureUpdatedAt} IS NOT NULL`,
          lt(schema.users.nurtureUpdatedAt, threeDaysAgo)
        )
      )
      .limit(20);

    for (const user of step1Users) {
      const email = auditEmail(user.channelId);
      const ok = await sendNurtureEmail(user.email, email.subject, email.html);
      if (ok) {
        await dbService.db.update(schema.users)
          .set({ nurtureStep: 2, nurtureUpdatedAt: now })
          .where(eq(schema.users.id, user.id));
        sent++;
      }
    }

    // STEP 2 → 3: Users who got audit 4+ days ago
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const step2Users = await dbService.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.nurtureStep, 2),
          sql`${schema.users.nurtureUpdatedAt} IS NOT NULL`,
          lt(schema.users.nurtureUpdatedAt, sevenDaysAgo)
        )
      )
      .limit(20);

    for (const user of step2Users) {
      const email = reminderEmail(user.channelId, user.credits);
      const ok = await sendNurtureEmail(user.email, email.subject, email.html);
      if (ok) {
        await dbService.db.update(schema.users)
          .set({ nurtureStep: 3, nurtureUpdatedAt: now })
          .where(eq(schema.users.id, user.id));
        sent++;
      }
    }

    return { processed: sent, new: newUsers.length, step1: step1Users.length, step2: step2Users.length };
  } catch (e) {
    console.error('[Nurture] Error:', e.message);
    return { processed: sent, error: e.message };
  }
}
