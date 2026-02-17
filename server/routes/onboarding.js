const express = require('express');
const db = require('../db');

const router = express.Router();

// Onboarding steps definition
const ONBOARDING_STEPS = [
  { id: 'verify_email', label: 'Verify your email', description: 'Confirm your email address to secure your account' },
  { id: 'complete_profile', label: 'Complete your profile', description: 'Add your name and company info' },
  { id: 'create_org', label: 'Create an organization', description: 'Set up your team workspace' },
  { id: 'create_agent', label: 'Create your first agent', description: 'Build an AI agent with custom instructions' },
  { id: 'create_project', label: 'Create your first project', description: 'Start a design project with your agent' },
];

// GET /api/onboarding/status — get onboarding progress for current user
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await db.getUserById(userId);

    // Get completed steps from DB
    const progress = await db.getOnboardingProgress(userId);
    const completedSteps = new Set(progress.filter(p => p.completed).map(p => p.step));

    // Auto-detect completion for some steps
    const autoDetected = {};

    // Email verified?
    if (user.email_verified) {
      autoDetected.verify_email = true;
    }

    // Profile complete? (has display name)
    if (user.display_name && user.display_name.trim() !== '') {
      autoDetected.complete_profile = true;
    }

    // Has at least one org?
    const orgs = await db.getUserOrganizations(userId);
    if (orgs && orgs.length > 0) {
      autoDetected.create_org = true;
    }

    // Has created at least one agent?
    const agents = await db.getAllAgentsForUser(userId);
    if (agents && agents.length > 0) {
      autoDetected.create_agent = true;
    }

    // Has created at least one project?
    const projects = await db.getProjectsByUser(userId);
    if (projects && projects.length > 0) {
      autoDetected.create_project = true;
    }

    // Merge auto-detected with explicit progress
    const steps = ONBOARDING_STEPS.map(step => ({
      ...step,
      completed: completedSteps.has(step.id) || autoDetected[step.id] || false,
    }));

    const totalSteps = steps.length;
    const completedCount = steps.filter(s => s.completed).length;
    const allComplete = completedCount === totalSteps;

    // Auto-mark onboarding as done if all steps complete
    if (allComplete && !user.onboarding_completed) {
      await db.updateUserProfile(userId, { onboarding_completed: true });
    }

    res.json({
      steps,
      completed: completedCount,
      total: totalSteps,
      percentage: Math.round((completedCount / totalSteps) * 100),
      onboarding_completed: allComplete || user.onboarding_completed,
    });
  } catch (err) {
    console.error('[Onboarding] Status error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/onboarding/complete-step — mark a step as complete
router.post('/complete-step', async (req, res) => {
  try {
    const { step } = req.body;
    if (!step || !ONBOARDING_STEPS.find(s => s.id === step)) {
      return res.status(400).json({ error: 'Invalid step' });
    }

    await db.completeOnboardingStep(req.user.userId, step);
    res.json({ ok: true, step });
  } catch (err) {
    console.error('[Onboarding] Complete step error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/onboarding/dismiss — user dismissed the onboarding
router.post('/dismiss', async (req, res) => {
  try {
    await db.updateUserProfile(req.user.userId, { onboarding_completed: true });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Onboarding] Dismiss error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
