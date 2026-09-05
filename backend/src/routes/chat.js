import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { askDevMate } from '../services/geminiService.js';
import { isValidMode } from '../config/modeInstructions.js';

const router = Router();

const MAX_MESSAGE_LENGTH = 8000;
const MAX_HISTORY_TURNS = 20;
const MAX_HISTORY_TOTAL_CHARS = 20000;

/**
 * Validate and sanitize a client-supplied conversation history array.
 *
 * Rules:
 *   - Must be an array (or omitted / null, in which case it is treated as empty).
 *   - Each turn must be an object with string `role` of exactly "user" or
 *     "assistant", and a non-empty string `content`.
 *   - Any additional fields on a turn are stripped.
 *   - The total combined `content` length is capped to avoid oversized
 *     requests. Excess turns are dropped from the oldest end.
 *
 * History is never used for system-instruction content. The backend
 * controls the system prompt; history is conversation context only.
 *
 * @returns {{ ok: true, history: Array<{role:'user'|'assistant', content:string}> }
 *           | { ok: false, error: string }}
 */
function sanitizeHistory(raw) {
  if (raw === undefined || raw === null) return { ok: true, history: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'History must be an array.' };
  }
  const cleaned = [];
  for (const turn of raw) {
    if (!turn || typeof turn !== 'object') {
      return { ok: false, error: 'Each history turn must be an object.' };
    }
    const { role, content } = turn;
    if (role !== 'user' && role !== 'assistant') {
      return { ok: false, error: 'History turn role must be "user" or "assistant".' };
    }
    if (typeof content !== 'string' || content.length === 0) {
      return { ok: false, error: 'Each history turn must have a non-empty string content.' };
    }
    cleaned.push({ role, content });
  }
  // Keep at most MAX_HISTORY_TURNS most-recent turns.
  const trimmed = cleaned.slice(-MAX_HISTORY_TURNS);
  // Cap total content size; drop oldest first.
  let total = 0;
  const startIndex = trimmed.findIndex((t) => {
    total += t.content.length;
    return total > MAX_HISTORY_TOTAL_CHARS;
  });
  const limited = startIndex === -1 ? trimmed : trimmed.slice(startIndex + 1);
  return { ok: true, history: limited };
}

router.post('/', requireAuth, async (req, res) => {
  const { message, mode, history } = req.body || {};

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

  // ── History validation ────────────────────────────────────────
  const histResult = sanitizeHistory(history);
  if (!histResult.ok) {
    return res.status(400).json({
      success: false,
      error: histResult.error,
    });
  }

  // ── Gemini ───────────────────────────────────────────────────
  try {
    const { text, model, mode: resolvedMode } = await askDevMate(
      trimmed,
      mode,
      histResult.history
    );
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
