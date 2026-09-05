import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
  Alert,
  Divider,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../firebase/AuthContext';

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // While Firebase is still resolving the initial auth state, show a spinner.
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

  // Already signed in → bounce to dashboard.
  if (user) {
    return <Navigate to="/dashboard" replace />;
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
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        px: 2,
        py: 6,
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={4} alignItems="center">
          {/* Brand */}
          <Stack spacing={1} alignItems="center" textAlign="center">
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 12px 30px rgba(99, 102, 241, 0.4)',
                fontSize: 36,
              }}
            >
              🤖
            </Box>
            <Typography variant="h3" component="h1" fontWeight={700} color="white">
              DevMate AI
            </Typography>
            <Typography variant="body1" color="rgba(255,255,255,0.7)" maxWidth={420}>
              Your senior software engineering assistant. Debug, optimize, and secure
              your code with AI.
            </Typography>
          </Stack>

          {/* Card */}
          <Paper
            elevation={8}
            sx={{
              width: '100%',
              p: { xs: 3, sm: 4 },
              borderRadius: 4,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Stack spacing={3}>
              <Stack spacing={0.5}>
                <Typography variant="h5" fontWeight={600} color="white">
                  Welcome back
                </Typography>
                <Typography variant="body2" color="rgba(255,255,255,0.6)">
                  Sign in to continue to your dashboard.
                </Typography>
              </Stack>

              {error && (
                <Alert severity="error" variant="outlined" onClose={() => setError('')}>
                  {error}
                </Alert>
              )}

              <Button
                onClick={handleSignIn}
                disabled={submitting}
                variant="contained"
                size="large"
                startIcon={
                  submitting ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <GoogleIcon />
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
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    color: '#475569',
                  },
                }}
              >
                {submitting ? 'Signing in…' : 'Continue with Google'}
              </Button>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <Typography variant="caption" color="rgba(255,255,255,0.5)">
                  Secure authentication via Firebase
                </Typography>
              </Divider>

              <Typography variant="caption" color="rgba(255,255,255,0.5)" textAlign="center">
                By continuing, you agree to DevMate AI&apos;s Terms of Service and
                Privacy Policy.
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
