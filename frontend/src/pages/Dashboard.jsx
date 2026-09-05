import { useCallback, useEffect, useRef, useState } from 'react';
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import SendIcon from '@mui/icons-material/Send';
import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import { useAuth } from '../firebase/AuthContext';
import { sendChatMessage } from '../services/api';
import {
  subscribeConversations,
  createConversation,
  addMessage,
  getConversation,
  deleteConversation,
  FirestoreError,
} from '../services/firestore';

/* ───────────────────────────── constants ────────────────────────────── */

const SIDEBAR_WIDTH = 280;

const MODES = [
  {
    id: 'debug',
    icon: '🐛',
    label: 'Debug',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
    badgeColor: '#ef4444',
    description: 'Find bugs, understand root causes, and fix your code.',
    placeholder: 'Describe a bug, paste error output, or share problematic code…',
    modeIcon: BugReportOutlinedIcon,
  },
  {
    id: 'optimize',
    icon: '⚡',
    label: 'Optimize',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)',
    badgeColor: '#f59e0b',
    description: 'Improve time and space complexity and remove bottlenecks.',
    placeholder: 'Share code to analyze, describe a slow operation…',
    modeIcon: SpeedOutlinedIcon,
  },
  {
    id: 'secure',
    icon: '🔐',
    label: 'Secure',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    badgeColor: '#10b981',
    description: 'Find vulnerabilities and strengthen your application.',
    placeholder: 'Share code to audit, describe an auth flow…',
    modeIcon: SecurityOutlinedIcon,
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

function getMode(id) {
  return MODES.find((m) => m.id === id) || MODES[0];
}

/* ───────────────────────────── error helpers ──────────────────────── */

function friendlyErrorMessage(err) {
  if (err instanceof FirestoreError) {
    switch (err.code) {
      case 'permission':
        return 'Permission denied. Please sign in again.';
      case 'network':
        return 'Network error. Please check your connection.';
      case 'not-found':
        return 'Conversation not found.';
      case 'invalid':
        return err.message;
      default:
        return 'Failed to save. Please try again.';
    }
  }
  switch (err?.status) {
    case 'unauthenticated':
      return 'Your session has expired. Please sign in again.';
    case 'invalid':
      return 'Please enter a valid message.';
    case 'unavailable':
      return 'AI service is temporarily unavailable.';
    case 'network':
      return err.message || 'Network error. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/* ───────────────────────────── top-level wrapper ─────────────────── */

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return <DashboardContent user={user} signOut={signOut} navigate={navigate} />;
}

/* ───────────────────────────── main content (all hooks live here) ── */

function DashboardContent({ user, signOut, navigate }) {
  // ── Responsive helpers (replaces removed MUI <Hidden />) ────
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  // ── Conversation state ──────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversationTitle, setConversationTitle] = useState('');

  // ── UI state ────────────────────────────────────────────────
  const [mode, setMode] = useState('debug');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [savingConversation, setSavingConversation] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'error' });
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const activeMode = getMode(mode);
  const canSend = !sending && input.trim().length > 0;

  // ── Subscribe to conversation list ────────────────────────────
  useEffect(() => {
    const unsub = subscribeConversations(
      user.uid,
      (items) => {
        setConversations(items);
        setConversationsLoading(false);
      },
      (err) => {
        console.error('[Dashboard] conversation list error:', err);
        setConversationsLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  // ── Auto-scroll when messages change ────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Helpers ─────────────────────────────────────────────────
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

  const handleModeChange = (newMode) => {
    setMode(newMode);
  };

  // ── Load a conversation ─────────────────────────────────────
  const loadConversation = useCallback(
    async (convId) => {
      try {
        const conv = await getConversation(user.uid, convId);
        setActiveConversationId(conv.id);
        setConversationTitle(conv.title);
        setMessages(conv.messages || []);
        setMode(conv.mode || 'debug');
        setSidebarOpen(false);
        inputRef.current?.focus();
      } catch (err) {
        console.error('[Dashboard] loadConversation error:', err);
        showToast(friendlyErrorMessage(err));
        if (err instanceof FirestoreError && err.code === 'not-found') {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    },
    [user, showToast]
  );

  // ── New chat ────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setConversationTitle('');
    setMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, []);

  // ── Delete conversation ────────────────────────────────────
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteConversation(user.uid, id);
      if (activeConversationId === id) handleNewChat();
    } catch (err) {
      console.error('[Dashboard] delete error:', err);
      showToast(friendlyErrorMessage(err));
    }
  }, [deleteTarget, user, activeConversationId, handleNewChat, showToast]);

  const openDelete = (conv) => {
    setDeleteTarget({ id: conv.id, title: conv.title });
  };

  // ── Send message ────────────────────────────────────────────
  const handleSend = async (textOverride) => {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || sending || savingConversation) return;

    const userMsg = { role: 'user', content: trimmed, mode };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    // 1. Persist user message
    try {
      if (activeConversationId) {
        await addMessage(user.uid, activeConversationId, userMsg);
      }
    } catch (err) {
      console.error('[Dashboard] save user message error:', err);
      showToast(`Failed to save: ${friendlyErrorMessage(err)}`);
    }

    // 2. Call Gemini — pass prior messages as conversation history.
    // `messages` contains only the previous turns (before `userMsg` was appended).
    // The backend appends the current turn before sending to Gemini.
    let response;
    try {
      const result = await sendChatMessage(trimmed, mode, messages);
      response = result.response;
    } catch (err) {
      console.error('[Dashboard] chat error:', err);
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: friendlyErrorMessage(err), isError: true, mode },
      ]);
      setSending(false);
      inputRef.current?.focus();
      if (err?.status === 'unauthenticated') {
        showToast(friendlyErrorMessage(err));
        try { await signOut(); } catch { /* noop */ }
        navigate('/login', { replace: true });
      }
      return;
    }

    // 3. Persist assistant message
    const assistantMsg = { role: 'assistant', content: response, mode };
    setMessages([...nextMessages, assistantMsg]);

    try {
      if (activeConversationId) {
        await addMessage(user.uid, activeConversationId, assistantMsg);
      } else {
        setSavingConversation(true);
        const conv = await createConversation(user.uid, userMsg);
        await addMessage(user.uid, conv.id, assistantMsg);
        setActiveConversationId(conv.id);
        setConversationTitle(conv.title);
        setSavingConversation(false);
      }
    } catch (err) {
      console.error('[Dashboard] save assistant message error:', err);
      showToast(`Response received but failed to save: ${friendlyErrorMessage(err)}`);
    }

    setSending(false);
    inputRef.current?.focus();
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

  const displayName = user.displayName || user.email || 'Developer';
  const photoURL = user.photoURL;

  // ── Sidebar content ─────────────────────────────────────────
  const sidebarContent = (
    <Stack
      sx={{
        height: '100%',
        backgroundColor: '#0c1220',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        flexDirection: 'column',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          🤖
        </Box>
        <Stack>
          <Typography variant="body2" fontWeight={700} color="white" lineHeight={1.2}>
            DevMate AI
          </Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.45)">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ px: 2, pb: 1.5 }}>
        <Button
          onClick={handleNewChat}
          variant="contained"
          fullWidth
          startIcon={<AddIcon />}
          sx={{
            py: 1.25,
            textTransform: 'none',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            },
          }}
        >
          New Chat
        </Button>
      </Box>

      <Box sx={{ px: 2, pb: 2 }}>
        <Typography
          variant="caption"
          color="rgba(255,255,255,0.35)"
          sx={{ px: 0.5, mb: 0.75, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
        >
          Mode
        </Typography>
        <Stack spacing={0.5}>
          {MODES.map((m) => {
            const isActive = m.id === mode;
            const ModeIcon = m.modeIcon;
            return (
              <Button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                variant="text"
                fullWidth
                startIcon={<ModeIcon sx={{ fontSize: 18, color: isActive ? m.badgeColor : 'rgba(255,255,255,0.4)' }} />}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                  fontWeight: isActive ? 600 : 400,
                  background: isActive ? `${m.badgeColor}18` : 'transparent',
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.75,
                  '&:hover': {
                    background: `${m.badgeColor}22`,
                    color: 'white',
                  },
                }}
              >
                {m.icon} {m.label}
              </Button>
            );
          })}
        </Stack>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        <Typography
          variant="caption"
          color="rgba(255,255,255,0.35)"
          sx={{ px: 2, mb: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
        >
          History
        </Typography>
        {conversationsLoading ? (
          <Stack spacing={0.5} px={2} py={1}>
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} variant="rounded" height={56} sx={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 2 }} />
            ))}
          </Stack>
        ) : conversations.length === 0 ? (
          <Typography
            variant="caption"
            color="rgba(255,255,255,0.3)"
            sx={{ px: 2, py: 2, display: 'block', fontStyle: 'italic' }}
          >
            No conversations yet. Start a new chat!
          </Typography>
        ) : (
          <List disablePadding>
            {conversations.map((conv) => {
              const m = getMode(conv.mode);
              const isActive = conv.id === activeConversationId;
              return (
                <ListItem
                  key={conv.id}
                  disablePadding
                  secondaryAction={
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); openDelete(conv); }}
                      sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#ef4444' } }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    selected={isActive}
                    onClick={() => loadConversation(conv.id)}
                    sx={{
                      mx: 1,
                      borderRadius: 2,
                      mb: 0.25,
                      py: 1.25,
                      '&.Mui-selected': {
                        backgroundColor: `${m.badgeColor}22`,
                        borderLeft: `3px solid ${m.badgeColor}`,
                        '&:hover': { backgroundColor: `${m.badgeColor}30` },
                      },
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: m.gradient,
                          fontSize: 12,
                        }}
                      >
                        {m.icon}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={conv.title}
                      secondary={conv.preview}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? 'white' : 'rgba(255,255,255,0.8)',
                        noWrap: true,
                      }}
                      secondaryTypographyProps={{
                        variant: 'caption',
                        color: 'rgba(255,255,255,0.4)',
                        noWrap: true,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', p: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
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
          <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="white" noWrap sx={{ fontWeight: 500 }}>
              {displayName}
            </Typography>
            <Typography variant="caption" color="rgba(255,255,255,0.4)" noWrap>
              {user.email}
            </Typography>
          </Stack>
          <Tooltip title="Sign out">
            <IconButton
              onClick={handleSignOut}
              disabled={signingOut}
              size="small"
              sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}
            >
              {signingOut ? <CircularProgress size={16} /> : <LogoutIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a' }}>
      {/* Sidebar (drawer on mobile, permanent on desktop) */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              backgroundColor: '#0c1220',
              border: 'none',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}
      {isDesktop && (
        <Drawer
          variant="permanent"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              backgroundColor: '#0c1220',
              border: 'none',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Main chat area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar
          position="static"
          elevation={0}
          sx={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Toolbar>
            {isMobile && (
              <IconButton
                onClick={() => setSidebarOpen(true)}
                edge="start"
                sx={{ color: 'white', mr: 1 }}
                aria-label="Open sidebar"
              >
                <MenuIcon />
              </IconButton>
            )}

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
                <Typography variant="h6" fontWeight={700} color="white" lineHeight={1.2}>
                  {conversationTitle || `${activeMode.icon} ${activeMode.label}`}
                </Typography>
                {activeConversationId && (
                  <Typography variant="caption" color="rgba(255,255,255,0.45)">
                    {messages.length} message{messages.length !== 1 ? 's' : ''}
                  </Typography>
                )}
              </Stack>
            </Stack>

            {isDesktop && (
              <Stack direction="row" spacing={0.75}>
                {MODES.map((m) => {
                  const isActive = m.id === mode;
                  return (
                    <Button
                      key={m.id}
                      onClick={() => handleModeChange(m.id)}
                      variant={isActive ? 'contained' : 'text'}
                      size="small"
                      startIcon={<span style={{ fontSize: 14 }}>{m.icon}</span>}
                      sx={{
                        textTransform: 'none',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                        background: isActive ? m.gradient : 'transparent',
                        border: isActive ? 'none' : '1px solid rgba(255,255,255,0.15)',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '0.8rem',
                        '&:hover': {
                          background: isActive ? m.gradient : 'rgba(255,255,255,0.06)',
                        },
                      }}
                    >
                      {m.label}
                    </Button>
                  );
                })}
              </Stack>
            )}
          </Toolbar>
        </AppBar>

        <Box sx={{ height: 3, background: activeMode.gradient }} />

        <Container
          maxWidth="md"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            py: { xs: 2, md: 4 },
            px: { xs: 2, md: 3 },
          }}
        >
          {messages.length === 0 && (
            <Stack spacing={3} sx={{ mb: 3, textAlign: 'center', alignItems: 'center', mt: 3 }}>
              <Stack spacing={1} alignItems="center">
                <Typography
                  variant="h4"
                  component="h1"
                  fontWeight={700}
                  color="white"
                  sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' } }}
                >
                  {activeMode.icon} {activeMode.label}
                </Typography>
                <Typography variant="body1" color="rgba(255,255,255,0.65)" maxWidth={500}>
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
                  border: `1px solid ${activeMode.badgeColor}28`,
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
                        color: 'rgba(255,255,255,0.82)',
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

          {messages.length > 0 && (
            <Stack spacing={2} sx={{ flex: 1, mb: 2 }}>
              {messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} activeMode={getMode(msg.mode)} />
              ))}
              {(sending || savingConversation) && <TypingIndicator activeMode={activeMode} />}
              <div ref={messagesEndRef} />
            </Stack>
          )}

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
              mt: 'auto',
            }}
          >
            <TextField
              inputRef={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                sending || savingConversation
                  ? 'DevMate is thinking…'
                  : activeMode.placeholder
              }
              disabled={sending || savingConversation}
              multiline
              maxRows={6}
              fullWidth
              variant="standard"
              slotProps={{
                input: {
                  disableUnderline: true,
                  sx: {
                    color: 'white',
                    fontSize: '0.95rem',
                    padding: '8px 10px',
                    '& ::placeholder': { color: 'rgba(255,255,255,0.38)' },
                  },
                },
              }}
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
                    '&:hover': { opacity: 0.9 },
                    '&.Mui-disabled': {
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.3)',
                    },
                  }}
                >
                  {sending || savingConversation ? (
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
            color="rgba(255,255,255,0.35)"
            sx={{ display: 'block', textAlign: 'center', mt: 1 }}
          >
            Press <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for newline
          </Typography>
        </Container>
      </Box>

      {/* Delete confirmation dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        PaperProps={{ sx: { backgroundColor: '#1e293b', borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: 'white' }}>Delete conversation?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'rgba(255,255,255,0.7)' }}>
            &ldquo;{deleteTarget?.title}&rdquo; will be permanently deleted and cannot be recovered.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteTarget(null)}
            sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            sx={{ textTransform: 'none' }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={closeToast}
          severity={toast.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
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
          {!isUser && message.mode && (
            <Chip
              label={`${getMode(message.mode)?.icon ?? ''} ${getMode(message.mode)?.label ?? message.mode}`}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: 'rgba(255,255,255,0.65)',
                border: '1px solid rgba(255,255,255,0.12)',
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
            '& pre code': { backgroundColor: 'transparent', padding: 0 },
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

function renderMessageText(text) {
  const safe = String(text ?? '');
  if (!safe) return null;
  const fenceParts = safe.split(/```([a-zA-Z0-9_+\-#]*)\n?([\s\S]*?)```/g);
  return fenceParts.map((part, i) => {
    if (i % 3 === 0) return renderInline(part, `f-${i}`);
    if (i % 3 === 1) return null;
    return <pre key={`f-${i}`}><code>{part.replace(/\n$/, '')}</code></pre>;
  });
}

function renderInline(text, keyPrefix) {
  const parts = String(text).split(/(`[^`\n]+`)/g);
  return parts.map((p, j) =>
    p.startsWith('`') && p.endsWith('`')
      ? <code key={`${keyPrefix}-${j}`}>{p.slice(1, -1)}</code>
      : <span key={`${keyPrefix}-${j}`}>{p}</span>
  );
}
