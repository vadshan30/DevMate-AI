import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Typography,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../firebase/AuthContext';

/* ───────────────────────────── palette ────────────────────────────── */

const PALETTE = {
  bg: '#080c14',
  surface: 'rgba(13, 17, 23, 0.7)',
  surfaceCard: 'rgba(15, 23, 42, 0.85)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderCard: 'rgba(255, 255, 255, 0.10)',
  textPrimary: 'rgba(255, 255, 255, 0.92)',
  textSecondary: 'rgba(255, 255, 255, 0.55)',
  textDim: 'rgba(255, 255, 255, 0.35)',
  primaryFrom: '#6366f1',
  primaryTo: '#8b5cf6',
  debug: '#22c55e',
  optimize: '#f59e0b',
  secure: '#06b6d4',
};

const primaryGradient = `linear-gradient(135deg, ${PALETTE.primaryFrom} 0%, ${PALETTE.primaryTo} 100%)`;

/* ───────────────────────────── left panel ────────────────────────── */

function LeftPanel() {
  return (
    <Box
      sx={{
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        background: `linear-gradient(160deg, #0d0f1a 0%, #1a1040 50%, #0f172a 100%)`,
        position: 'relative',
        overflow: 'hidden',
        /* subtle dot-grid overlay */
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(99,102,241,0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        },
        /* gradient glow from bottom-left */
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '-20%',
          left: '-10%',
          width: '60%',
          height: '60%',
          background:
            'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Stack
        spacing={4}
        alignItems="flex-start"
        sx={{
          position: 'relative',
          zIndex: 1,
          px: { md: 6, lg: 10 },
          maxWidth: 480,
        }}
      >
        {/* Logo mark */}
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: primaryGradient,
            fontSize: 32,
            boxShadow: `0 0 40px rgba(99,102,241,0.35)`,
          }}
        >
          🤖
        </Box>

        {/* Brand heading */}
        <Stack spacing={1.5}>
          <Typography
            variant="h3"
            component="h1"
            fontWeight={800}
            color={PALETTE.textPrimary}
            lineHeight={1.1}
            sx={{ fontSize: { xs: '2rem', md: '2.5rem' } }}
          >
            DevMate AI
          </Typography>
          <Typography
            variant="body1"
            color={PALETTE.textSecondary}
            sx={{ fontSize: '1.05rem', lineHeight: 1.65, maxWidth: 400 }}
          >
            Your AI-powered developer assistant for debugging, optimization, and security.
          </Typography>
        </Stack>

        {/* Feature highlights */}
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {[
            { icon: '🐛', label: 'Debug', desc: 'Find bugs and root causes', color: PALETTE.debug },
            { icon: '⚡', label: 'Optimize', desc: 'Improve efficiency & complexity', color: PALETTE.optimize },
            { icon: '🔐', label: 'Secure', desc: 'Audit vulnerabilities', color: PALETTE.secure },
          ].map((f) => (
            <Stack
              key={f.label}
              direction="row"
              spacing={1.5}
              alignItems="center"
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${f.color}18`,
                  border: `1px solid ${f.color}30`,
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {f.icon}
              </Box>
              <Stack spacing={0}>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  color={PALETTE.textPrimary}
                  lineHeight={1.2}
                >
                  {f.label}
                </Typography>
                <Typography variant="caption" color={PALETTE.textDim} lineHeight={1.2}>
                  {f.desc}
                </Typography>
              </Stack>
            </Stack>
          ))}
        </Stack>

        {/* Footer note */}
        <Typography variant="caption" color={PALETTE.textDim} sx={{ mt: 2 }}>
          Built with Firebase Authentication · Powered by Gemini
        </Typography>
      </Stack>
    </Box>
  );
}

/* ───────────────────────────── right panel ────────────────────────── */

function RightPanel() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: PALETTE.bg,
        }}
      >
        <CircularProgress sx={{ color: PALETTE.primaryFrom }} />
      </Box>
    );
  }

  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSignIn = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('[Login] Google sign-in failed:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (err?.code === 'auth/popup-blocked') {
        setError('Pop-up was blocked by your browser. Please allow pop-ups and retry.');
      } else if (err?.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(err?.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        flex: { xs: 1, md: 0.7 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: PALETTE.bg,
        px: { xs: 2, sm: 4 },
        py: { xs: 6, sm: 0 },
        minHeight: { xs: '100vh', md: '100vh' },
      }}
    >
      {/* Auth card */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 3, sm: 4 },
          borderRadius: '16px',
          background: PALETTE.surfaceCard,
          backdropFilter: 'blur(24px)',
          border: `1px solid ${PALETTE.borderCard}`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`,
        }}
      >
        <Stack spacing={3.5}>
          {/* Card header */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: primaryGradient,
                fontSize: 22,
                flexShrink: 0,
                boxShadow: `0 0 20px rgba(99,102,241,0.25)`,
              }}
            >
              🤖
            </Box>
            <Stack spacing={0}>
              <Typography
                variant="h6"
                fontWeight={700}
                color={PALETTE.textPrimary}
                lineHeight={1.2}
              >
                Welcome to DevMate AI
              </Typography>
              <Typography variant="caption" color={PALETTE.textSecondary}>
                Sign in to continue to your dashboard.
              </Typography>
            </Stack>
          </Stack>

          {/* Error */}
          {error && (
            <Alert
              severity="error"
              variant="outlined"
              onClose={() => setError('')}
              sx={{
                borderColor: 'rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                background: 'rgba(239, 68, 68, 0.08)',
              }}
            >
              {error}
            </Alert>
          )}

          {/* Sign-in button */}
          <Button
            onClick={handleSignIn}
            disabled={submitting}
            variant="contained"
            size="large"
            startIcon={
              submitting ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <GoogleIcon sx={{ fontSize: 20 }} />
              )
            }
            sx={{
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              backgroundColor: 'white',
              color: '#0f172a',
              '&:hover': {
                backgroundColor: '#e2e8f0',
              },
              '&.Mui-disabled': {
                backgroundColor: 'rgba(255,255,255,0.75)',
                color: '#64748b',
              },
            }}
          >
            {submitting ? 'Signing in…' : 'Continue with Google'}
          </Button>

          <Divider sx={{ borderColor: PALETTE.border }}>
            <Typography variant="caption" color={PALETTE.textDim}>
              Secure authentication via Firebase
            </Typography>
          </Divider>

          <Typography
            variant="caption"
            color={PALETTE.textDim}
            textAlign="center"
            display="block"
          >
            By continuing, you agree to DevMate AI&apos;s Terms of Service and Privacy Policy.
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

/* ───────────────────────────── root ──────────────────────────────── */

export default function Login() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        backgroundColor: PALETTE.bg,
      }}
    >
      {/* Left branding panel — hidden on mobile */}
      {!isMobile && <LeftPanel />}

      {/* Right auth panel */}
      <RightPanel />
    </Box>
  );
}
