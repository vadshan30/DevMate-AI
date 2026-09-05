import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  BASE_SYSTEM_INSTRUCTION,
  MODE_INSTRUCTIONS,
  isValidMode,
} from '../config/modeInstructions.js';

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const MAX_HISTORY_TURNS = 20;

let cachedClient = null;

// Per-mode cached model. Keyed by mode so each mode gets its own
// specialized model with the right system-instruction composition.
const modelCache = new Map();

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured.');
    err.code = 'GEMINI_NOT_CONFIGURED';
    throw err;
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenerativeAI(apiKey);
  }
  return cachedClient;
}

function getModelForMode(mode) {
  if (!isValidMode(mode)) {
    const err = new Error(`Invalid mode "${mode}".`);
    err.code = 'INVALID_MODE';
    throw err;
  }
  if (modelCache.has(mode)) return modelCache.get(mode);

  const client = getClient();
  const systemInstruction = `${BASE_SYSTEM_INSTRUCTION}\n\n${MODE_INSTRUCTIONS[mode]}`;
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
    generationConfig: {
      temperature: 0.4,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 1024,
    },
  });
  modelCache.set(mode, model);
  return model;
}

/**
 * Convert an array of history turns from the server-side format
 *   { role: 'user'|'assistant', content: string }
 * to Gemini's internal Content format:
 *   { role: 'user'|'model', parts: [{ text }] }
 *
 * Only the most recent MAX_HISTORY_TURNS turns are included to avoid
 * exceeding Gemini's context window.
 *
 * @param {Array<{role: string, content: string}>} history
 * @returns {Array<{role: string, parts: Array<{text: string}>}>}
 */
function buildGeminiHistory(history) {
  const recent = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];
  return recent.map((turn) => ({
    role: turn.role === 'user' ? 'user' : 'model',
    parts: [{ text: turn.content }],
  }));
}

/**
 * Send a user message to Gemini under one of the DevMate AI modes.
 * When `history` is provided, the message is sent as part of an
 * ongoing conversation, with the previous turns pre-loaded.
 *
 * The system instruction (BASE_SYSTEM_INSTRUCTION + mode instruction)
 * is always applied regardless of history.
 *
 * @param {string} message - The user's developer question / code problem.
 * @param {'debug'|'optimize'|'secure'} mode - Validated mode.
 * @param {Array<{role: 'user'|'assistant', content: string}>} [history] -
 *   Prior conversation turns from the database, in chronological order.
 * @returns {Promise<{ text: string, model: string, mode: string }>}
 */
export async function askDevMate(message, mode, history = []) {
  const model = getModelForMode(mode);
  const geminiHistory = buildGeminiHistory(history);

  let text;
  if (geminiHistory.length > 0) {
    // Multi-turn: use startChat so the model sees the conversation context.
    // The system instruction is already set on the model at construction time.
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(message);
    text = result?.response?.text?.() ?? '';
  } else {
    // Single-turn: use generateContent directly.
    const result = await model.generateContent(message);
    text = result?.response?.text?.() ?? '';
  }

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }
  return { text, model: MODEL_NAME, mode };
}

export { BASE_SYSTEM_INSTRUCTION, MODEL_NAME as GEMINI_MODEL_NAME };
