import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { askDevMate } from '../services/geminiService.js';
import { isValidMode } from '../config/modeInstructions.js';

const router = Router();

const MAX_MESSAGE_LENGTH = 8000;

router.post('/', requireAuth, async (req, res) => {
  const { message, mode } = req.body || {};

  // ── Message validation ────────────────────────────────────────
  if (typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Request body must include a "message" string field.',
    });
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot be empty.',
    });
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
    });
  }

  // ── Mode validation ───────────────────────────────────────────
  if (!isValidMode(mode)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid mode.',
    });
  }

  // ── Gemini ───────────────────────────────────────────────────
  try {
    const { text, model, mode: resolvedMode } = await askDevMate(trimmed, mode);
    return res.json({
      success: true,
      response: text,
      model,
      mode: resolvedMode,
    });
  } catch (err) {
    const code = err?.code;
    console.error('[chat] error:', code || err.message);

    if (code === 'GEMINI_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        error: 'AI service is not configured. Please contact the administrator.',
      });
    }
    if (code === 'INVALID_MODE') {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode.',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to generate a response. Please try again.',
    });
  }
});

export default router;
