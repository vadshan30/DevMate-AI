import { useCallback, useRef, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '../firebase/AuthContext';
import { sendChatMessage } from '../services/api';

/* ───────────────────────────── constants ────────────────────────────── */

const MODES = [
  {
    id: 'debug',
    icon: '🐛',
    label: 'Debug',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
    description: 'Find bugs, understand root causes, and fix your code.',
    placeholder: 'Describe a bug, paste error output, or share problematic code…',
    badgeColor: '#ef4444',
  },
  {
    id: 'optimize',
    icon: '⚡',
    label: 'Optimize',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)',
    description: 'Improve time and space complexity and remove bottlenecks.',
    placeholder: 'Share code to analyze, describe a slow operation…',
    badgeColor: '#f59e0b',
  },
  {
    id: 'secure',
    icon: '🔐',
    label: 'Secure',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    description: 'Find vulnerabilities and strengthen your application.',
    placeholder: 'Share code to audit, describe an auth flow…',
    badgeColor: '#10b981',
  },
];

const MODE_SUGGESTIONS = {
  debug: [
    'Why does my Java code throw NullPointerException?',
    'Find the bug in this Python function.',
    'React useEffect runs twice in development — why?',
    'TypeError: Cannot read property "map" of undefined',
  ],
  optimize: [
    'How can I optimize this O(n²) nested loop?',
    'Analyze the time and space complexity of this algorithm.',
    'This database query is slow for large tables.',
    'Reduce bundle size of my React application.',
  ],
  secure: [
    'Review this login endpoint for security vulnerabilities.',
    'Find security issues in this SQL query.',
    'Is storing JWT in localStorage safe?',
    'Audit this code for injection risks.',
  ],
};

/* ───────────────────────────── error mapping ──────────────────────── */

function friendlyErrorMessage(apiError) {
  switch (apiError?.status) {
    case 'unauthenticated':
      return 'Your session has expired. Please sign in again.';
    case 'invalid':
      return 'Please enter a valid message.';
    case 'unavailable':
      return 'AI service is temporarily unavailable.';
    case 'network':
      return apiError.message || 'Network error. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/* ───────────────────────────── component ──────────────────────────── */

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('debug');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'error' });
  const [signingOut, setSigningOut] = useState(false);

  const inputRef = useRef(null);

  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];
  const canSend = !sending && input.trim().length > 0;

  const showToast = useCallback((message, severity = 'error') => {
    setToast({ open: true, message, severity });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('[Dashboard] sign-out failed:', err);
      setSigningOut(false);
      showToast('Sign-out failed. Please try again.');
    }
  };

  const handleSend = async (textOverride) => {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || sending) return;

    const userMessage = { role: 'user', content: trimmed, mode };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const { response } = await sendChatMessage(trimmed, mode);
      setMessages([...nextMessages, { role: 'assistant', content: response, mode }]);
    } catch (err) {
      console.error('[Dashboard] chat error:', err);
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: friendlyErrorMessage(err), isError: true, mode },
      ]);
      if (err?.status === 'unauthenticated') {
        showToast(friendlyErrorMessage(err));
        try {
          await signOut();
        } catch {
          /* noop */
        }
        navigate('/login', { replace: true });
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text) => {
    setInput(text);
    inputRef.current?.focus();
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const displayName = user.displayName || user.email || 'Developer';
  const photoURL = user.photoURL;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
      }}
    >
      {/* ─── App bar ──────────────────────────────────────────── */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexGrow: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: activeMode.gradient,
                fontSize: 20,
              }}
            >
              🤖
            </Box>
            <Stack>
              <Typography variant="h6" fontWeight={700} color="white" lineHeight={1.1}>
                DevMate AI
              </Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.55)">
                Debug · Optimize · Secure
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Tooltip title={user.email || ''}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Avatar
                  src={photoURL || undefined}
                  alt={displayName}
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: 14,
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </Avatar>
                <Typography
                  variant="body2"
                  color="rgba(255,255,255,0.85)"
                  sx={{ display: { xs: 'none', sm: 'block' }, maxWidth: 160 }}
                  noWrap
                >
                  {displayName}
                </Typography>
              </Stack>
            </Tooltip>
            <Button
              onClick={handleSignOut}
              disabled={signingOut}
              variant="outlined"
              size="small"
              startIcon={
                signingOut ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <LogoutIcon fontSize="small" />
                )
              }
              sx={{
                textTransform: 'none',
                color: 'white',
                borderColor: 'rgba(255,255,255,0.2)',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.4)',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </Button>
          </Stack>
        </Toolbar>

        {/* ─── Mode strip ─────────────────────────────────────── */}
        <Box
          sx={{
            px: 2,
            pb: 1.5,
            display: 'flex',
            gap: 1,
          }}
        >
          {MODES.map((m) => {
            const active = m.id === mode;
            return (
              <Button
                key={m.id}
                onClick={() => setMode(m.id)}
                variant={active ? 'contained' : 'text'}
                size="small"
                startIcon={<span style={{ fontSize: 16 }}>{m.icon}</span>}
                sx={{
                  textTransform: 'none',
                  fontWeight: active ? 700 : 500,
                  color: active ? 'white' : 'rgba(255,255,255,0.6)',
                  background: active ? m.gradient : 'transparent',
                  border: active ? 'none' : '1px solid rgba(255,255,255,0.15)',
                  px: 2,
                  py: 0.75,
                  borderRadius: 2,
                  '&:hover': {
                    background: active ? m.gradient : 'rgba(255,255,255,0.06)',
                  },
                }}
              >
                {m.label}
              </Button>
            );
          })}
        </Box>
      </AppBar>

      {/* ─── Mode accent bar ──────────────────────────────────── */}
      <Box sx={{ height: 3, background: activeMode.gradient }} />

      {/* ─── Main chat area ───────────────────────────────────── */}
      <Container
        maxWidth="md"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 3, md: 5 },
        }}
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <Stack spacing={3} sx={{ mb: 4, textAlign: 'center', alignItems: 'center' }}>
            <Stack spacing={1} alignItems="center">
              <Typography
                variant="h3"
                component="h1"
                fontWeight={700}
                color="white"
                sx={{ fontSize: { xs: '2rem', md: '2.5rem' } }}
              >
                {activeMode.icon} {activeMode.label}
              </Typography>
              <Typography variant="body1" color="rgba(255,255,255,0.7)" maxWidth={520}>
                {activeMode.description}
              </Typography>
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                width: '100%',
                borderRadius: 3,
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${activeMode.badgeColor}30`,
                textAlign: 'left',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Chip
                  icon={<span style={{ fontSize: 12 }}>💡</span>}
                  label="Try asking"
                  size="small"
                  sx={{
                    backgroundColor: `${activeMode.badgeColor}20`,
                    color: activeMode.badgeColor,
                    fontWeight: 600,
                    border: `1px solid ${activeMode.badgeColor}40`,
                  }}
                />
              </Stack>
              <Stack spacing={0.75}>
                {MODE_SUGGESTIONS[mode].map((s) => (
                  <Button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    variant="text"
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: '0.875rem',
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 2,
                      '&:hover': {
                        backgroundColor: `${activeMode.badgeColor}15`,
                        color: 'white',
                      },
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </Stack>
            </Paper>
          </Stack>
        )}

        {/* Message list */}
        {messages.length > 0 && (
          <Stack spacing={2} sx={{ flexGrow: 1, mb: 3 }}>
            {messages.map((msg, idx) => (
              <MessageBubble
                key={idx}
                message={msg}
                activeMode={MODES.find((m) => m.id === msg.mode) || MODES[0]}
              />
            ))}
            {sending && <TypingIndicator activeMode={activeMode} />}
          </Stack>
        )}

        {/* Input */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: 3,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
            mt: messages.length > 0 ? 'auto' : 0,
          }}
        >
          <TextField
            inputRef={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              sending ? 'DevMate is thinking…' : activeMode.placeholder
            }
            disabled={sending}
            multiline
            maxRows={6}
            fullWidth
            variant="standard"
            autoFocus
            slotProps={{
              input: {
                disableUnderline: true,
                sx: {
                  color: 'white',
                  fontSize: '0.95rem',
                  padding: '8px 10px',
                  '& ::placeholder': { color: 'rgba(255,255,255,0.4)' },
                },
              },
            }}
            sx={{ flexGrow: 1 }}
          />
          <Tooltip title="Send (Enter)">
            <span>
              <IconButton
                onClick={() => handleSend()}
                disabled={!canSend}
                aria-label="Send message"
                sx={{
                  background: activeMode.gradient,
                  color: 'white',
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  '&:hover': {
                    opacity: 0.9,
                  },
                  '&.Mui-disabled': {
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.3)',
                  },
                }}
              >
                {sending ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SendIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Paper>
        <Typography
          variant="caption"
          color="rgba(255,255,255,0.4)"
          sx={{ display: 'block', textAlign: 'center', mt: 1 }}
        >
          Press <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for newline
        </Typography>
      </Container>

      {/* Toast for non-chat errors */}
      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={closeToast} severity={toast.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

/* ───────────────────────────── sub-components ────────────────────── */

function MessageBubble({ message, activeMode }) {
  const isUser = message.role === 'user';
  const bubbleBg = isUser
    ? activeMode.gradient
    : message.isError
    ? 'rgba(220, 38, 38, 0.12)'
    : 'rgba(15, 23, 42, 0.85)';
  const bubbleBorder = !isUser
    ? `1px solid ${message.isError ? 'rgba(220, 38, 38, 0.3)' : 'rgba(255,255,255,0.08)'}`
    : 'none';
  const bubbleColor = isUser ? 'white' : message.isError ? '#fca5a5' : 'rgba(255,255,255,0.92)';

  return (
    <Stack
      direction="row"
      spacing={1.5}
      justifyContent={isUser ? 'flex-end' : 'flex-start'}
      alignItems="flex-start"
    >
      {!isUser && (
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: activeMode.gradient,
            fontSize: 16,
            flexShrink: 0,
          }}
          aria-hidden
        >
          🤖
        </Box>
      )}

      <Paper
        elevation={0}
        sx={{
          maxWidth: '85%',
          p: 2,
          borderRadius: 3,
          background: bubbleBg,
          border: bubbleBorder,
          color: bubbleColor,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
          {message.isError && (
            <Typography variant="caption" sx={{ color: '#fca5a5', fontWeight: 600 }}>
              Error
            </Typography>
          )}
          {isUser && message.mode && (
            <Chip
              label={`${MODES.find((m) => m.id === message.mode)?.icon ?? ''} ${
                MODES.find((m) => m.id === message.mode)?.label ?? message.mode
              }`}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            />
          )}
        </Stack>
        <Typography
          component="div"
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.6,
            fontSize: '0.9rem',
            '& code': {
              fontFamily: 'ui-monospace, Consolas, monospace',
              fontSize: '0.85em',
              backgroundColor: 'rgba(0,0,0,0.3)',
              padding: '1px 6px',
              borderRadius: 1,
            },
            '& pre': {
              backgroundColor: 'rgba(0,0,0,0.35)',
              padding: 2,
              borderRadius: 2,
              overflowX: 'auto',
              margin: '8px 0',
            },
            '& pre code': {
              backgroundColor: 'transparent',
              padding: 0,
            },
          }}
        >
          {renderMessageText(message.content)}
        </Typography>
      </Paper>

      {isUser && (
        <Avatar
          sx={{
            width: 32,
            height: 32,
            fontSize: 14,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
            flexShrink: 0,
          }}
        >
          {message.content?.charAt(0)?.toUpperCase() || '👤'}
        </Avatar>
      )}
    </Stack>
  );
}

function TypingIndicator({ activeMode }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: activeMode.gradient,
          fontSize: 16,
        }}
        aria-hidden
      >
        🤖
      </Box>
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          borderRadius: 3,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          {[0, 150, 300].map((delay) => (
            <Box
              key={delay}
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.5)',
                animation: 'bounce 1.2s infinite',
                animationDelay: `${delay}ms`,
                '@keyframes bounce': {
                  '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.4 },
                  '40%': { transform: 'scale(1)', opacity: 1 },
                },
              }}
            />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}

/* ────────────────────── minimal markdown renderer ─────────────────── */

function renderMessageText(text) {
  const safe = String(text ?? '');
  if (!safe) return null;
  const fenceParts = safe.split(/```([a-zA-Z0-9_+\-#]*)\n?([\s\S]*?)```/g);
  return fenceParts.map((part, i) => {
    if (i % 3 === 0) return renderInline(part, `f-${i}`);
    if (i % 3 === 1) return null; // language tag
    return (
      <pre key={`f-${i}`}>
        <code>{part.replace(/\n$/, '')}</code>
      </pre>
    );
  });
}

function renderInline(text, keyPrefix) {
  const parts = String(text).split(/(`[^`\n]+`)/g);
  return parts.map((p, j) =>
    p.startsWith('`') && p.endsWith('`') ? (
      <code key={`${keyPrefix}-${j}`}>{p.slice(1, -1)}</code>
    ) : (
      <span key={`${keyPrefix}-${j}`}>{p}</span>
    )
  );
}
