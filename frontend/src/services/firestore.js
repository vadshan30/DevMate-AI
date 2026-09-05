// Firestore persistence layer for DevMate AI conversations.
//
// All functions operate under `users/{uid}/conversations/{conversationId}`.
// The `uid` argument is the *authenticated* uid (from `auth.currentUser.uid`).
// Callers must NEVER supply a uid collected from a UI input — `requireUid()`
// below enforces that by reading from `auth.currentUser`.
//
// Errors are normalized into `FirestoreError` objects with a `code` so the
// UI can render a clean message without leaking stack traces.

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

const ALLOWED_MODES = new Set(['debug', 'optimize', 'secure']);
const MAX_TITLE_LENGTH = 60;
const MAX_MESSAGE_LENGTH = 8000;
const MAX_MESSAGES_PER_CONVERSATION = 500;
const LIST_LIMIT = 100;

export class FirestoreError extends Error {
  /**
   * @param {string} message - User-friendly message
   * @param {string} code - 'unauthenticated' | 'permission' | 'not-found' | 'network' | 'invalid' | 'unknown'
   * @param {Error} [cause]
   */
  constructor(message, code, cause) {
    super(message);
    this.name = 'FirestoreError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

function requireUid(uid) {
  // Reject UI-supplied UIDs that disagree with the currently signed-in user.
  // This is the LAST line of defense; Firestore Security Rules are the first.
  const current = auth.currentUser?.uid;
  if (!current) {
    throw new FirestoreError('You must be signed in.', 'unauthenticated');
  }
  if (uid && uid !== current) {
    throw new FirestoreError('User mismatch.', 'permission');
  }
  return current;
}

function normalizeMode(mode) {
  if (typeof mode !== 'string' || !ALLOWED_MODES.has(mode)) {
    throw new FirestoreError('Invalid mode.', 'invalid');
  }
  return mode;
}

function normalizeContent(content) {
  if (typeof content !== 'string') {
    throw new FirestoreError('Message content must be a string.', 'invalid');
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new FirestoreError('Message content cannot be empty.', 'invalid');
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new FirestoreError(
      `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
      'invalid'
    );
  }
  return trimmed;
}

function truncateTitle(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_TITLE_LENGTH) return clean;
  return clean.slice(0, MAX_TITLE_LENGTH - 1) + '…';
}

function toMillis(value) {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return null;
}

function mapError(err) {
  const raw = err?.code || err?.message || 'unknown';
  if (raw.includes('permission-denied') || raw.includes('unauthorized')) {
    return new FirestoreError(
      'You do not have permission to perform this action.',
      'permission',
      err
    );
  }
  if (raw.includes('not-found')) {
    return new FirestoreError('Conversation not found.', 'not-found', err);
  }
  if (raw.includes('unavailable') || raw.includes('network')) {
    return new FirestoreError(
      'Network error. Please check your connection and try again.',
      'network',
      err
    );
  }
  return new FirestoreError('Firestore operation failed.', 'unknown', err);
}

function conversationsCollection(uid) {
  return collection(db, 'users', uid, 'conversations');
}

function conversationDoc(uid, conversationId) {
  return doc(db, 'users', uid, 'conversations', conversationId);
}

/**
 * Create a brand-new conversation with the first user message.
 *
 * @param {string} [uid] - Optional. Must match `auth.currentUser.uid` if provided.
 * @param {{ role: 'user', content: string, mode: string }} initialMessage
 * @returns {Promise<{ id: string, title: string, mode: string }>}
 */
export async function createConversation(uid, initialMessage) {
  const currentUid = requireUid(uid);
  const mode = normalizeMode(initialMessage?.mode);
  const content = normalizeContent(initialMessage?.content);

  const now = serverTimestamp();
  const data = {
    title: truncateTitle(content),
    mode,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        role: 'user',
        content,
        mode,
        timestamp: Timestamp.now(),
      },
    ],
  };

  try {
    const ref = await addDoc(conversationsCollection(currentUid), data);
    return { id: ref.id, title: data.title, mode };
  } catch (err) {
    throw mapError(err);
  }
}

/**
 * Append a single message to an existing conversation.
 *
 * @param {string} [uid]
 * @param {string} conversationId
 * @param {{ role: 'user' | 'assistant', content: string, mode: string }} message
 */
export async function addMessage(uid, conversationId, message) {
  if (!conversationId || typeof conversationId !== 'string') {
    throw new FirestoreError('Missing conversation id.', 'invalid');
  }
  const currentUid = requireUid(uid);
  const role = message?.role;
  if (role !== 'user' && role !== 'assistant') {
    throw new FirestoreError('Invalid message role.', 'invalid');
  }
  const mode = normalizeMode(message?.mode);
  const content = normalizeContent(message?.content);

  const docRef = conversationDoc(currentUid, conversationId);

  try {
    // Read first to enforce the max-messages cap and avoid corrupting
    // local cache with an unbounded array.
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new FirestoreError('Conversation not found.', 'not-found');
    }
    const current = Array.isArray(snap.data()?.messages) ? snap.data().messages : [];
    if (current.length >= MAX_MESSAGES_PER_CONVERSATION) {
      throw new FirestoreError(
        'This conversation has reached the maximum message length.',
        'invalid'
      );
    }
    const next = [
      ...current,
      { role, content, mode, timestamp: Timestamp.now() },
    ];
    await updateDoc(docRef, {
      messages: next,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (err instanceof FirestoreError) throw err;
    throw mapError(err);
  }
}

/**
 * List the current user's conversations, newest updatedAt first.
 *
 * @param {string} [uid]
 * @returns {Promise<Array<{ id, title, mode, updatedAt, createdAt, preview }>>}
 */
export async function getConversations(uid) {
  const currentUid = requireUid(uid);
  try {
    const q = query(
      conversationsCollection(currentUid),
      orderBy('updatedAt', 'desc'),
      limit(LIST_LIMIT)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      const messages = Array.isArray(data.messages) ? data.messages : [];
      const lastMsg = messages[messages.length - 1];
      return {
        id: d.id,
        title: typeof data.title === 'string' ? data.title : 'Untitled',
        mode: ALLOWED_MODES.has(data.mode) ? data.mode : 'debug',
        updatedAt: toMillis(data.updatedAt),
        createdAt: toMillis(data.createdAt),
        preview: lastMsg ? truncatePreview(lastMsg.content) : '',
        messageCount: messages.length,
      };
    });
  } catch (err) {
    throw mapError(err);
  }
}

/**
 * Subscribe to the current user's conversation list. Returns the
 * unsubscribe function.
 */
export function subscribeConversations(uid, onNext, onError) {
  let currentUid;
  try {
    currentUid = requireUid(uid);
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
  try {
    const q = query(
      conversationsCollection(currentUid),
      orderBy('updatedAt', 'desc'),
      limit(LIST_LIMIT)
    );
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data = d.data();
          const messages = Array.isArray(data.messages) ? data.messages : [];
          const lastMsg = messages[messages.length - 1];
          return {
            id: d.id,
            title: typeof data.title === 'string' ? data.title : 'Untitled',
            mode: ALLOWED_MODES.has(data.mode) ? data.mode : 'debug',
            updatedAt: toMillis(data.updatedAt),
            createdAt: toMillis(data.createdAt),
            preview: lastMsg ? truncatePreview(lastMsg.content) : '',
            messageCount: messages.length,
          };
        });
        onNext(items);
      },
      (err) => onError && onError(mapError(err))
    );
  } catch (err) {
    if (onError) onError(mapError(err));
    return () => {};
  }
}

function truncatePreview(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= 80) return clean;
  return clean.slice(0, 79) + '…';
}

/**
 * Load a single conversation's full message list.
 *
 * @param {string} [uid]
 * @param {string} conversationId
 * @returns {Promise<{ id, title, mode, messages }>}
 */
export async function getConversation(uid, conversationId) {
  if (!conversationId || typeof conversationId !== 'string') {
    throw new FirestoreError('Missing conversation id.', 'invalid');
  }
  const currentUid = requireUid(uid);
  try {
    const snap = await getDoc(conversationDoc(currentUid, conversationId));
    if (!snap.exists()) {
      throw new FirestoreError('Conversation not found.', 'not-found');
    }
    const data = snap.data();
    const messages = Array.isArray(data.messages) ? data.messages : [];
    return {
      id: snap.id,
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      mode: ALLOWED_MODES.has(data.mode) ? data.mode : 'debug',
      messages: messages.map((m) => ({
        role: m?.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m?.content === 'string' ? m.content : '',
        mode: ALLOWED_MODES.has(m?.mode) ? m.mode : 'debug',
        timestamp: toMillis(m?.timestamp),
      })),
    };
  } catch (err) {
    if (err instanceof FirestoreError) throw err;
    throw mapError(err);
  }
}

/**
 * Delete a conversation. Hard delete; Firestore is the source of truth.
 */
export async function deleteConversation(uid, conversationId) {
  if (!conversationId || typeof conversationId !== 'string') {
    throw new FirestoreError('Missing conversation id.', 'invalid');
  }
  const currentUid = requireUid(uid);
  try {
    await deleteDoc(conversationDoc(currentUid, conversationId));
  } catch (err) {
    throw mapError(err);
  }
}

/**
 * Optional: rename a conversation. Kept for future use; the Dashboard
 * does not currently expose a rename UI.
 */
export async function renameConversation(uid, conversationId, title) {
  if (!conversationId || typeof conversationId !== 'string') {
    throw new FirestoreError('Missing conversation id.', 'invalid');
  }
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new FirestoreError('Title must be a non-empty string.', 'invalid');
  }
  const currentUid = requireUid(uid);
  try {
    await updateDoc(conversationDoc(currentUid, conversationId), {
      title: truncateTitle(title),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw mapError(err);
  }
}

export const FIRESTORE_LIMITS = Object.freeze({
  MAX_TITLE_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGES_PER_CONVERSATION,
  LIST_LIMIT,
});

export { setDoc };
