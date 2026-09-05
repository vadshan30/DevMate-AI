import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  BASE_SYSTEM_INSTRUCTION,
  MODE_INSTRUCTIONS,
  isValidMode,
} from '../config/modeInstructions.js';

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

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
 * Send a user message to Gemini under one of the DevMate AI modes.
 *
 * @param {string} message - The user's developer question / code problem.
 * @param {'debug'|'optimize'|'secure'} mode - Validated mode.
 * @returns {Promise<{ text: string, model: string, mode: string }>}
 */
export async function askDevMate(message, mode) {
  const model = getModelForMode(mode);
  const result = await model.generateContent(message);
  const text = result?.response?.text?.() ?? '';
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }
  return { text, model: MODEL_NAME, mode };
}

export { BASE_SYSTEM_INSTRUCTION, MODEL_NAME as GEMINI_MODEL_NAME };
