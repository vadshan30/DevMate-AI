import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
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

/* ───────────────────────────── palette ────────────────────────────── */

const C = {
  bg: '#080c14',
  sidebarBg: '#0d1117',
  surface: '#0f172a',
  surfaceGlass: 'rgba(15, 23, 42, 0.75)',
  border: 'rgba(255, 255, 255, 0.07)',
  borderMid: 'rgba(255, 255, 255, 0.11)',
  textPrimary: 'rgba(255, 255, 255, 0.92)',
  textSecondary: 'rgba(255, 255, 255, 0.55)',
  textDim: 'rgba(255, 255, 255, 0.32)',
  primaryFrom: '#6366f1',
  primaryTo: '#8b5cf6',
  debug: '#22c55e',
  optimize: '#f59e0b',
  secure: '#06b6d4',
  error: '#ef4444',
};

const SIDEBAR_W = 268;
const primaryGradient = `linear-gradient(135deg, ${C.primaryFrom}, ${C.primaryTo})`;

/* ───────────────────────────── mode definitions ─────────────────── */

const MODES = [
  {
    id: 'debug',
    icon: '🐛',
    label: 'Debug',
    gradient: `linear-gradient(135deg, #15803d, #22c55e)`,
    color: C.debug,
    description: 'Find bugs, explain root causes, and propose fixes.',
    placeholder: 'Paste your code or describe the bug…',
    featureLabel: 'Issue · Root Cause · Fix',
  },
  {
    id: 'optimize',
    icon: '⚡',
    label: 'Optimize',
    gradient: `linear-gradient(135deg, #d97706, #f59e0b)`,
    color: C.optimize,
    description: 'Improve time and space complexity, remove bottlenecks.',
    placeholder: 'Share code to analyze or describe what to optimize…',
    featureLabel: 'Complexity · Bottleneck · Trade-offs',
  },
  {
    id: 'secure',
    icon: '🔐',
    label: 'Secure',
    gradient: `linear-gradient(135deg, #0891b2, #06b6d4)`,
    color: C.secure,
    description: 'Find vulnerabilities and strengthen your application.',
    placeholder: 'Share code to audit or describe the security concern…',
    featureLabel: 'Vulnerability · Severity · Mitigation',
  },
];

const SUGGESTIONS = {
  debug: [
    { label: 'Why does this Java code throw NullPointerException?', example: 'String s = null;\nSystem.out.println(s.length());' },
    { label: 'Find the bug in this function', example: 'def get_user(id):\n    users = {1: "Alice"}\n    return users[id]' },
    { label: 'React useEffect runs twice in dev — why?', example: 'useEffect(() => {\n  fetchData();\n}, []);' },
  ],
  optimize: [
    { label: 'Optimize this O(n²) nested loop', example: 'for i in range(n):\n  for j in range(n):\n    print(i, j)' },
    { label: 'Analyze time complexity of this algorithm', example: 'def binary_search(arr, x):\n    lo, hi = 0, len(arr)-1\n    while lo <= hi:\n        mid = (lo+hi)//2\n        if arr[mid] == x: return mid\n        elif arr[mid] < x: lo = mid+1\n        else: hi = mid-1' },
    { label: 'Reduce this slow database query', example: 'SELECT * FROM orders o\nJOIN customers c ON o.cid=c.id\nWHERE c.active=1' },
  ],
  secure: [
    { label: 'Check this SQL query for injection', example: 'query = "SELECT * FROM users WHERE id=" + userId' },
    { label: 'Audit this JWT storage approach', example: 'localStorage.setItem("token", response.token)' },
    { label: 'Find vulnerabilities in this auth flow', example: 'app.post("/login", (req, res) => {\n  const { user, pass } = req.body;\n  db.query("SELECT * FROM users WHERE u=?"+user); })' },
  ],
};

function getMode(id) {
  return MODES.find((m) => m.id === id) || MODES[0];
}

/* ───────────────────────────── error helpers ────────────────────── */

function friendlyError(err) {
  if (err instanceof FirestoreError) {
    switch (err.code) {
      case 'permission': return 'Permission denied. Please sign in again.';
      case 'network': return 'Network error. Please check your connection.';
      case 'not-found': return 'Conversation not found.';
      default: return 'Failed to save. Please try again.';
    }
  }
  switch (err?.status) {
    case 'unauthenticated': return 'Your session has expired. Please sign in again.';
    case 'invalid': return 'Please enter a valid message.';
    case 'unavailable': return 'AI service is temporarily unavailable.';
    case 'network': return err.message || 'Network error. Please try again.';
    default: return 'Something went wrong. Please try again.';
  }
}

/* ───────────────────────────── top-level ───────────────────────── */

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: C.bg,
        }}
      >
        <CircularProgress sx={{ color: C.primaryFrom }} />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return <DashboardContent user={user} signOut={signOut} navigate={navigate} />;
}

/* ───────────────────────────── main content ─────────────────────── */

function DashboardContent({ user, signOut, navigate }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ── state ────────────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
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

  // ── subscribe to conversations ────────────────────────────────
  useEffect(() => {
    const unsub = subscribeConversations(
      user.uid,
      (items) => { setConversations(items); setConversationsLoading(false); },
      () => setConversationsLoading(false)
    );
    return () => unsub();
  }, [user]);

  // ── scroll to bottom ─────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── helpers ──────────────────────────────────────────────────
  const showToast = useCallback((message, severity = 'error') => {
    setToast({ open: true, message, severity });
  }, []);

  const closeToast = () => setToast((p) => ({ ...p, open: false }));

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      setSigningOut(false);
      showToast('Sign-out failed. Please try again.');
    }
  };

  const loadConversation = useCallback(
    async (convId) => {
      try {
        const conv = await getConversation(user.uid, convId);
        setActiveConversationId(conv.id);
        setMessages(conv.messages || []);
        setMode(conv.mode || 'debug');
        setSidebarOpen(false);
        inputRef.current?.focus();
      } catch (err) {
        showToast(friendlyError(err));
        if (err instanceof FirestoreError && err.code === 'not-found') {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    },
    [user, showToast]
  );

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteConversation(user.uid, id);
      if (activeConversationId === id) handleNewChat();
    } catch (err) {
      showToast(friendlyError(err));
    }
  }, [deleteTarget, user, activeConversationId, handleNewChat, showToast]);

  // ── send message ──────────────────────────────────────────────
  const handleSend = async (textOverride) => {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || sending || savingConversation) return;

    const userMsg = { role: 'user', content: trimmed, mode };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      if (activeConversationId) await addMessage(user.uid, activeConversationId, userMsg);
    } catch (err) {
      showToast(`Failed to save: ${friendlyError(err)}`);
    }

    let response;
    try {
      const result = await sendChatMessage(trimmed, mode, messages);
      response = result.response;
    } catch (err) {
      setMessages([...nextMessages, { role: 'assistant', content: friendlyError(err), isError: true, mode }]);
      setSending(false);
      inputRef.current?.focus();
      if (err?.status === 'unauthenticated') {
        showToast(friendlyError(err));
        try { await signOut(); } catch { /* noop */ }
        navigate('/login', { replace: true });
      }
      return;
    }

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
        setSavingConversation(false);
      }
    } catch (err) {
      showToast(`Response received but failed to save: ${friendlyError(err)}`);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const displayName = user.displayName || user.email || 'Developer';
  const photoURL = user.photoURL;

  /* ───────────── sidebar ───────────── */
  const sidebarContent = (
    <Stack
      sx={{
        height: '100%',
        backgroundColor: C.sidebarBg,
        borderRight: `1px solid ${C.border}`,
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ px: 2, py: 2, borderBottom: `1px solid ${C.border}` }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: primaryGradient,
            fontSize: 18,
            flexShrink: 0,
            boxShadow: `0 0 16px rgba(99,102,241,0.3)`,
          }}
        >
          🤖
        </Box>
        <Stack spacing={0}>
          <Typography variant="body2" fontWeight={700} color={C.textPrimary} lineHeight={1.2}>
            DevMate AI
          </Typography>
          <Typography variant="caption" color={C.textDim}>
            AI Developer Assistant
          </Typography>
        </Stack>
      </Stack>

      {/* New Chat */}
      <Box sx={{ px: 2, py: 1.5 }}>
        <Button
          onClick={handleNewChat}
          variant="contained"
          fullWidth
          aria-label="Start new conversation"
          startIcon={<AddIcon sx={{ fontSize: 18 }} />}
          sx={{
            py: 1.1,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            background: primaryGradient,
            '&:hover': {
              background: `linear-gradient(135deg, ${C.primaryFrom}, ${C.primaryTo})`,
              opacity: 0.9,
            },
          }}
        >
          New Chat
        </Button>
      </Box>

      {/* Modes */}
      <Box sx={{ px: 2, pb: 1.5 }}>
        <Typography
          variant="caption"
          color={C.textDim}
          sx={{
            px: 0.5,
            mb: 0.75,
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
            fontSize: '0.65rem',
          }}
        >
          Assistant Mode
        </Typography>
        <Stack spacing={0.5}>
          {MODES.map((m) => {
            const isActive = m.id === mode;
            return (
              <Box
                key={m.id}
                onClick={() => setMode(m.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 1.5,
                  py: 0.875,
                  borderRadius: 2,
                  cursor: 'pointer',
                  background: isActive ? `${m.color}14` : 'transparent',
                  borderLeft: `3px solid ${isActive ? m.color : 'transparent'}`,
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    background: `${m.color}10`,
                    borderLeftColor: isActive ? m.color : `${m.color}50`,
                  },
                }}
                role="button"
                aria-pressed={isActive}
                aria-label={`Switch to ${m.label} mode`}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setMode(m.id)}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? m.gradient : 'rgba(255,255,255,0.05)',
                    fontSize: 14,
                    flexShrink: 0,
                    transition: 'background 0.15s ease',
                  }}
                >
                  {m.icon}
                </Box>
                <Stack spacing={0.1}>
                  <Typography
                    variant="body2"
                    fontWeight={isActive ? 600 : 400}
                    color={isActive ? C.textPrimary : C.textSecondary}
                    lineHeight={1.2}
                    sx={{ transition: 'color 0.15s ease' }}
                  >
                    {m.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={C.textDim}
                    sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}
                  >
                    {m.featureLabel}
                  </Typography>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Box>

      <Divider sx={{ borderColor: C.border }} />

      {/* History */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        <Typography
          variant="caption"
          color={C.textDim}
          sx={{
            px: 2,
            mb: 0.5,
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
            fontSize: '0.65rem',
          }}
        >
          Recent Chats
        </Typography>

        {conversationsLoading ? (
          <Stack spacing={0.5} px={1.5} py={0.5}>
            {[1, 2, 3].map((n) => (
              <Skeleton
                key={n}
                variant="rounded"
                height={52}
                sx={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 2 }}
              />
            ))}
          </Stack>
        ) : conversations.length === 0 ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 4, px: 2 }}>
            <Typography sx={{ fontSize: '1.5rem' }}>💬</Typography>
            <Typography variant="caption" color={C.textDim} textAlign="center">
              No conversations yet.
            </Typography>
            <Typography variant="caption" color={C.textDim} textAlign="center">
              Start a new chat above.
            </Typography>
          </Stack>
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
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: conv.id, title: conv.title }); }}
                      aria-label="Delete conversation"
                      sx={{
                        color: 'rgba(255,255,255,0.2)',
                        opacity: 0,
                        '.MuiListItem-root:hover &': { opacity: 1 },
                        '&:hover': { color: C.error },
                        transition: 'opacity 0.15s, color 0.15s',
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  }
                  sx={{ '.MuiListItem-root:hover &': { opacity: 1 } }}
                >
                  <ListItemButton
                    selected={isActive}
                    onClick={() => loadConversation(conv.id)}
                    sx={{
                      mx: 1,
                      borderRadius: 2,
                      mb: 0.25,
                      py: 1,
                      '&.Mui-selected': {
                        backgroundColor: `${m.color}16`,
                        borderLeft: `3px solid ${m.color}`,
                        '&:hover': { backgroundColor: `${m.color}22` },
                      },
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 30 }}>
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: m.gradient,
                          fontSize: 11,
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
                        color: isActive ? C.textPrimary : C.textSecondary,
                        noWrap: true,
                        title: conv.title,
                      }}
                      secondaryTypographyProps={{
                        variant: 'caption',
                        color: C.textDim,
                        noWrap: true,
                        title: conv.preview,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      {/* User footer */}
      <Box sx={{ borderTop: `1px solid ${C.border}`, p: 1.5 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar
            src={photoURL || undefined}
            alt={displayName}
            sx={{
              width: 30,
              height: 30,
              fontSize: 13,
              fontWeight: 600,
              background: primaryGradient,
              flexShrink: 0,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
          <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color={C.textPrimary} noWrap sx={{ fontWeight: 500 }} title={displayName}>
              {displayName}
            </Typography>
            <Typography variant="caption" color={C.textDim} noWrap title={user.email}>
              {user.email}
            </Typography>
          </Stack>
          <Tooltip title="Sign out">
            <IconButton
              onClick={handleSignOut}
              disabled={signingOut}
              size="small"
              sx={{ color: C.textDim, '&:hover': { color: C.textPrimary } }}
            >
              {signingOut ? <CircularProgress size={16} /> : <LogoutIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Stack>
  );

  /* ───────────── main workspace ───────────── */
  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: '100vh',
        backgroundColor: C.bg,
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? sidebarOpen : true}
        onClose={() => setSidebarOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: SIDEBAR_W,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDEBAR_W,
            backgroundColor: C.sidebarBg,
            border: 'none',
            borderRight: isMobile ? 'none' : `1px solid ${C.border}`,
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Main workspace — fills remaining width */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          backgroundColor: C.bg,
        }}
      >
        {/* Header — full width of main workspace */}
        <Box
          sx={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            px: { xs: 2, md: 3 },
            borderBottom: `1px solid ${C.border}`,
            backgroundColor: C.surface,
            gap: 1.5,
            flexShrink: 0,
          }}
        >
          {isMobile && (
            <IconButton
              onClick={() => setSidebarOpen(true)}
              edge="start"
              size="small"
              sx={{ color: C.textSecondary, mr: 0.5 }}
              aria-label="Open sidebar"
            >
              <MenuIcon />
            </IconButton>
          )}

          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: activeMode.gradient,
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {activeMode.icon}
          </Box>
          <Stack spacing={0} sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              color={C.textPrimary}
              lineHeight={1.2}
              noWrap
            >
              {activeMode.label}
            </Typography>
            <Typography
              variant="caption"
              color={C.textDim}
              lineHeight={1.2}
              noWrap
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              {activeMode.description}
            </Typography>
          </Stack>

          <Box sx={{ flex: 1 }} />

          {!isMobile && (
            <Stack direction="row" spacing={0.5}>
              {MODES.map((m) => {
                const isActive = m.id === mode;
                return (
                  <Box
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? C.textPrimary : C.textSecondary,
                      background: isActive ? `${m.color}18` : 'transparent',
                      border: `1px solid ${isActive ? `${m.color}40` : C.border}`,
                      transition: 'all 0.15s ease',
                      '&:hover': { background: `${m.color}12`, borderColor: `${m.color}30` },
                    }}
                    role="button"
                    aria-pressed={isActive}
                    aria-label={`Switch to ${m.label}`}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setMode(m.id)}
                  >
                    {m.icon} {m.label}
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>

        {/* Chat + Composer area — flex column that fills remaining height */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Scrollable messages / empty-state area */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              px: { xs: 2, sm: 3, md: 4 },
              py: { xs: 2, md: 3 },
            }}
          >
            <Box
              sx={{
                maxWidth: 960,
                width: '100%',
                mx: 'auto',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100%',
              }}
            >
              {/* Empty state */}
              {messages.length === 0 && (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    py: { xs: 4, md: 6 },
                  }}
                >
                  {/* Big logo */}
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: activeMode.gradient,
                      fontSize: 28,
                      mb: 2.5,
                      boxShadow: `0 0 24px ${activeMode.color}30`,
                    }}
                  >
                    🤖
                  </Box>

                  <Typography
                    variant="h5"
                    fontWeight={700}
                    color={C.textPrimary}
                    sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, mb: 0.75 }}
                  >
                    How can I help you today?
                  </Typography>
                  <Typography
                    variant="body2"
                    color={C.textSecondary}
                    sx={{ mb: 4, maxWidth: 460, lineHeight: 1.55 }}
                  >
                    {activeMode.description}
                  </Typography>

                  {/* Suggestion cards — equal-height row */}
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{ width: '100%', maxWidth: 760 }}
                  >
                    {SUGGESTIONS[mode].map((s) => (
                      <Box
                        key={s.label}
                        onClick={() => handleSuggestion(s.label)}
                        sx={{
                          flex: 1,
                          minHeight: 110,
                          p: 2,
                          borderRadius: 2.5,
                          background: `rgba(15, 23, 42, 0.7)`,
                          border: `1px solid ${C.borderMid}`,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                          textAlign: 'left',
                          transition: 'all 0.18s ease',
                          '&:hover': {
                            border: `1px solid ${activeMode.color}55`,
                            background: `${activeMode.color}0c`,
                            transform: 'translateY(-2px)',
                            boxShadow: `0 8px 24px rgba(0,0,0,0.3)`,
                          },
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleSuggestion(s.label)}
                        aria-label={s.label}
                      >
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: activeMode.gradient,
                            fontSize: 16,
                            flexShrink: 0,
                          }}
                        >
                          {activeMode.icon}
                        </Box>
                        <Typography
                          variant="body2"
                          color={C.textPrimary}
                          sx={{ lineHeight: 1.45, fontWeight: 500, fontSize: '0.85rem' }}
                        >
                          {s.label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Messages list */}
              {messages.length > 0 && (
                <Stack spacing={2} sx={{ pb: 2 }}>
                  {messages.map((msg, idx) => (
                    <MessageBubble key={idx} message={msg} activeMode={getMode(msg.mode)} />
                  ))}
                  {(sending || savingConversation) && <TypingIndicator activeMode={activeMode} />}
                  <div ref={messagesEndRef} />
                </Stack>
              )}
            </Box>
          </Box>

          {/* Composer — pinned to bottom of workspace, full width with inner max-width */}
          <Box
            sx={{
              flexShrink: 0,
              px: { xs: 2, sm: 3, md: 4 },
              py: 2,
              borderTop: messages.length > 0 ? `1px solid ${C.border}` : 'none',
              backgroundColor: C.bg,
            }}
          >
            <Box sx={{ maxWidth: 960, width: '100%', mx: 'auto' }}>
              <Composer
                inputRef={inputRef}
                input={input}
                setInput={setInput}
                onKeyDown={handleKeyDown}
                onSend={() => handleSend()}
                canSend={canSend}
                sending={sending || savingConversation}
                activeMode={activeMode}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Delete dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        PaperProps={{
          sx: {
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            border: `1px solid ${C.borderMid}`,
          },
        }}
      >
        <DialogTitle sx={{ color: C.textPrimary, fontWeight: 600 }}>Delete conversation?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: C.textSecondary }}>
            &ldquo;{deleteTarget?.title}&rdquo; will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setDeleteTarget(null)}
            sx={{ color: C.textSecondary, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            sx={{
              textTransform: 'none',
              backgroundColor: C.error,
              '&:hover': { backgroundColor: '#dc2626' },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
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

/* ───────────────────────────── Composer ─────────────────────────── */

function Composer({ inputRef, input, setInput, onKeyDown, onSend, canSend, sending, activeMode }) {
  return (
    <Stack spacing={0.75}>
      {/* Input card */}
      <Paper
        elevation={0}
        sx={{
          p: 1.25,
          borderRadius: '14px',
          background: C.surfaceGlass,
          backdropFilter: 'blur(12px)',
          border: `1px solid ${C.borderMid}`,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0.75,
        }}
      >
        <TextField
          inputRef={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            sending
              ? 'DevMate is thinking…'
              : activeMode.placeholder
          }
          disabled={sending}
          multiline
          maxRows={8}
          fullWidth
          variant="standard"
          slotProps={{
            input: {
              disableUnderline: true,
              sx: {
                color: C.textPrimary,
                fontSize: '0.9rem',
                lineHeight: 1.6,
                padding: '8px 10px',
                '& ::placeholder': { color: C.textDim },
              },
            },
          }}
        />
        <Tooltip title="Send (Enter)">
          <span>
            <IconButton
              onClick={onSend}
              disabled={!canSend}
              aria-label="Send message"
              sx={{
                background: activeMode.gradient,
                color: 'white',
                width: 42,
                height: 42,
                borderRadius: '12px',
                flexShrink: 0,
                transition: 'all 0.15s ease',
                '&:hover': { opacity: 0.88, transform: 'scale(1.05)' },
                '&.Mui-disabled': {
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              {sending ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <SendIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Paper>

      {/* Keyboard hint */}
      <Typography
        variant="caption"
        color={C.textDim}
        textAlign="center"
        sx={{ fontSize: '0.68rem' }}
      >
        Press <kbd style={{ color: C.textSecondary }}>Enter</kbd> to send &nbsp;·&nbsp; <kbd style={{ color: C.textSecondary }}>Shift+Enter</kbd> for newline
      </Typography>
    </Stack>
  );
}

/* ───────────────────────────── message bubble ───────────────────── */

function MessageBubble({ message, activeMode }) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  const userBg = activeMode.gradient;
  const assistantBg = isError ? 'rgba(239, 68, 68, 0.08)' : 'rgba(15, 23, 42, 0.9)';
  const bubbleBg = isUser ? userBg : assistantBg;
  const bubbleColor = isUser ? 'white' : isError ? '#fca5a5' : C.textPrimary;
  const leftAccent = !isUser && !isError
    ? `2px solid ${activeMode.color}`
    : !isUser && isError
    ? `2px solid ${C.error}80`
    : 'none';

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
            width: 30,
            height: 30,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: activeMode.gradient,
            fontSize: 15,
            flexShrink: 0,
            mt: 0.25,
          }}
          aria-hidden
        >
          🤖
        </Box>
      )}
      <Paper
        elevation={0}
        sx={{
          maxWidth: isUser ? '75%' : '85%',
          p: 2,
          borderRadius: '12px',
          borderLeft: leftAccent,
          background: bubbleBg,
          borderTop: `1px solid ${isUser ? 'rgba(255,255,255,0.12)' : C.border}`,
          borderRight: `1px solid ${isUser ? 'rgba(255,255,255,0.12)' : C.border}`,
          borderBottom: `1px solid ${isUser ? 'rgba(255,255,255,0.12)' : C.border}`,
          color: bubbleColor,
        }}
      >
        {/* Mode chip on assistant */}
        {!isUser && message.mode && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
            {isError && (
              <Typography variant="caption" sx={{ color: '#fca5a5', fontWeight: 600 }}>
                ⚠ Error
              </Typography>
            )}
            <Chip
              label={`${getMode(message.mode)?.icon} ${getMode(message.mode)?.label}`}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                backgroundColor: 'rgba(0,0,0,0.25)',
                color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          </Stack>
        )}
        <Typography
          component="div"
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.7,
            fontSize: '0.9rem',
            '& code': {
              fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
              fontSize: '0.83em',
              backgroundColor: 'rgba(0,0,0,0.35)',
              padding: '1px 5px',
              borderRadius: 1,
              border: '1px solid rgba(255,255,255,0.07)',
            },
            '& pre': { all: 'unset' },
          }}
        >
          {renderMessageText(message.content)}
        </Typography>
      </Paper>
      {isUser && (
        <Avatar
          sx={{
            width: 30,
            height: 30,
            fontSize: 13,
            fontWeight: 600,
            background: 'rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.7)',
            flexShrink: 0,
            mt: 0.25,
          }}
        >
          {message.content?.charAt(0)?.toUpperCase() || '👤'}
        </Avatar>
      )}
    </Stack>
  );
}

/* ───────────────────────────── typing indicator ────────────────── */

function TypingIndicator({ activeMode }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: activeMode.gradient,
          fontSize: 15,
          flexShrink: 0,
        }}
        aria-hidden
      >
        🤖
      </Box>
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.5,
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.9)',
          border: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {[0, 160, 320].map((delay) => (
          <Box
            key={delay}
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: activeMode.color,
              animation: 'pulse 1.4s ease-in-out infinite',
              animationDelay: `${delay}ms`,
              '@keyframes pulse': {
                '0%, 60%, 100%': { transform: 'scale(0.7)', opacity: 0.4 },
                '30%': { transform: 'scale(1)', opacity: 1 },
              },
            }}
          />
        ))}
        <Typography variant="caption" color={C.textDim} sx={{ fontSize: '0.75rem', ml: 0.5 }}>
          DevMate is analyzing…
        </Typography>
      </Paper>
    </Stack>
  );
}

/* ───────────────────────────── code block ──────────────────────── */

function CodeBlock({ language, content }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — fail silently
    }
  };

  return (
    <Box
      component="pre"
      sx={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: '8px',
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        my: 1,
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          px: 1.5,
          py: 0.75,
          borderBottom: `1px solid ${C.border}`,
          backgroundColor: 'rgba(0,0,0,0.25)',
        }}
      >
        <Typography
          component="span"
          variant="caption"
          sx={{
            color: C.textDim,
            textTransform: 'uppercase',
            fontSize: '0.65rem',
            letterSpacing: '0.07em',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          }}
        >
          {language || 'code'}
        </Typography>
        <Button
          size="small"
          onClick={handleCopy}
          aria-label={copied ? 'Code copied' : 'Copy code'}
          tabIndex={0}
          sx={{
            minWidth: 'auto',
            px: 1,
            py: 0.25,
            fontSize: '0.68rem',
            fontWeight: 600,
            textTransform: 'none',
            color: copied ? '#4ade80' : C.textDim,
            backgroundColor: copied ? 'rgba(74,222,128,0.1)' : 'transparent',
            border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : C.border}`,
            borderRadius: 1,
            '&:hover': {
              color: '#4ade80',
              backgroundColor: 'rgba(74,222,128,0.1)',
              borderColor: 'rgba(74,222,128,0.3)',
            },
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </Button>
      </Stack>
      <Box
        component="code"
        sx={{
          display: 'block',
          fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
          fontSize: '0.83em',
          lineHeight: 1.65,
          color: C.textPrimary,
          padding: '12px 16px',
          overflowX: 'auto',
          whiteSpace: 'pre',
          tabSize: 2,
        }}
      >
        {content}
      </Box>
    </Box>
  );
}

/* ───────────────────────────── text renderer ──────────────────── */

function renderMessageText(text) {
  const safe = String(text ?? '');
  if (!safe) return null;
  const parts = safe.split(/```([a-zA-Z0-9_+\-#]*)\n?([\s\S]*?)```/g);
  const elements = [];
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i]) elements.push(renderInline(parts[i], `t-${i}`));
    if (i + 2 < parts.length) {
      const lang = parts[i + 1] || '';
      const content = parts[i + 2].replace(/\n$/, '');
      elements.push(<CodeBlock key={`c-${i}`} language={lang} content={content} />);
    }
  }
  return elements.length > 0 ? elements : null;
}

function renderInline(text, keyPrefix) {
  const parts = String(text).split(/(`[^`\n]+`)/g);
  return parts.map((p, j) =>
    p.startsWith('`') && p.endsWith('`')
      ? <code key={`${keyPrefix}-${j}`}>{p.slice(1, -1)}</code>
      : <span key={`${keyPrefix}-${j}`}>{p}</span>
  );
}
