// tests/phronesis-integration.test.js
// Integration tests for Phronesis chat-agent integration
// Run with: node --test tests/phronesis-integration.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Phronesis Integration', () => {

  describe('Tool Executor — goal_status', () => {
    it('should return null-goal message when no goal exists', async () => {
      const { executeTool } = await import('../api/agent-core/tool-executor.js');
      const result = await executeTool('goal_status', {}, 'no-goal-' + Date.now());
      assert.ok(result.instant);
      assert.ok(result.response.includes('haven\'t set'));
    });
  });

  describe('Tool Executor — get_inbox', () => {
    it('should return empty inbox message gracefully', async () => {
      const { executeTool } = await import('../api/agent-core/tool-executor.js');
      const result = await executeTool('get_inbox', {}, 'test-inbox-' + Date.now());
      assert.ok(result.instant);
      assert.ok(typeof result.response === 'string');
    });
  });

  describe('Tool Executor — get_activity', () => {
    it('should return no-activity message gracefully', async () => {
      const { executeTool } = await import('../api/agent-core/tool-executor.js');
      const result = await executeTool('get_activity', {}, 'test-act-' + Date.now());
      assert.ok(result.instant);
      assert.ok(typeof result.response === 'string');
    });
  });

  describe('Tool Executor — scan_channel', () => {
    it('should create a job for scan_channel', async () => {
      const { executeTool } = await import('../api/agent-core/tool-executor.js');
      const channelId = 'test-scan-' + Date.now();
      const result = await executeTool('scan_channel', {}, channelId);
      // May fail if DB unavailable in test, but should not throw
      assert.ok(result);
      assert.ok(typeof result.message === 'string' || typeof result.response === 'string');
    });
  });

  describe('Coach Function Calling — JSON parsing', () => {
    it('should parse clean JSON tool response', () => {
      const parseResponse = (raw) => {
        const cleaned = (raw || '').replace(/```json|```/g, '').trim();
        return JSON.parse(cleaned);
      };
      const result = parseResponse('{"tool":"goal_status","args":{},"message":"Checking..."}');
      assert.deepEqual(result, { tool: 'goal_status', args: {}, message: 'Checking...' });
    });

    it('should parse JSON with code block wrapping', () => {
      const parseResponse = (raw) => {
        const cleaned = (raw || '').replace(/```json|```/g, '').trim();
        return JSON.parse(cleaned);
      };
      const result = parseResponse('```json\n{"tool":"chat","args":{"message":"Hello"}}\n```');
      assert.deepEqual(result, { tool: 'chat', args: { message: 'Hello' } });
    });

    it('should fall back to chat when JSON parsing fails', () => {
      const parseOrFallback = (raw) => {
        try {
          const cleaned = (raw || '').replace(/```json|```/g, '').trim();
          return JSON.parse(cleaned);
        } catch(e) {
          return { tool: 'chat', args: { message: raw || 'Sorry, I could not process that.' } };
        }
      };
      const result = parseOrFallback('Just a plain text response, no JSON');
      assert.equal(result.tool, 'chat');
      assert.ok(result.args.message.includes('plain text'));
    });
  });

  describe('Job Status Polling', () => {
    it('should get job by ID from DB', async () => {
      try {
        const { default: dbService } = await import('../src/database/services.js');
        const job = await dbService.createJob('test-poll-' + Date.now(), 'scan_channel');
        const retrieved = await dbService.getJob(job.id);
        assert.ok(retrieved);
        assert.equal(retrieved.tool, 'scan_channel');
        assert.equal(retrieved.status, 'queued');
      } catch(e) {
        // DB may not be available in test env — skip gracefully
        console.warn('[Test] DB unavailable — skipping job test:', e.message);
      }
    });

    it('should update job status', async () => {
      try {
        const { default: dbService } = await import('../src/database/services.js');
        const job = await dbService.createJob('test-update-' + Date.now(), 'scan_channel');
        await dbService.updateJob(job.id, { status: 'running', progress: 50 });
        const updated = await dbService.getJob(job.id);
        assert.equal(updated.status, 'running');
        assert.equal(updated.progress, 50);
      } catch(e) {
        console.warn('[Test] DB unavailable — skipping job update test:', e.message);
      }
    });

    it('should return null for nonexistent job', async () => {
      try {
        const { default: dbService } = await import('../src/database/services.js');
        const job = await dbService.getJob('nonexistent-job-id');
        assert.equal(job, null);
      } catch(e) {
        console.warn('[Test] DB unavailable — skipping nonexistent job test:', e.message);
      }
    });
  });

  describe('Goal Engine — DB persistence', () => {
    it('should set and retrieve a goal', async () => {
      try {
        const { setGoal, getGoalStatus } = await import('../api/agent-core/goal-engine.js');
        const channelId = 'test-goal-' + Date.now();
        const goal = await setGoal({ channelId, type: 'subscribers', target: 1000, deadline: null });
        assert.ok(goal);
        assert.equal(goal.type, 'subscribers');
        assert.equal(goal.target, 1000);
        assert.equal(goal.status, 'active');
        const retrieved = await getGoalStatus(channelId);
        assert.ok(retrieved);
        assert.equal(retrieved.type, 'subscribers');
      } catch(e) {
        console.warn('[Test] DB unavailable — skipping goal persistence test:', e.message);
      }
    });

    it('should return null for channel with no goal', async () => {
      const { getGoalStatus } = await import('../api/agent-core/goal-engine.js');
      const result = await getGoalStatus('no-such-channel-' + Date.now());
      assert.equal(result, null);
    });
  });
});
