import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Stack,
  Toolbar,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../firebase/AuthContext';

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

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

  const displayName = user.displayName || 'Developer';
  const email = user.email || '';
  const photoURL = user.photoURL;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('[Dashboard] sign-out failed:', err);
      setSigningOut(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
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
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexGrow: 1 }}>
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
              }}
            >
              🤖
            </Box>
            <Typography variant="h6" fontWeight={700} color="white">
              DevMate AI
            </Typography>
          </Stack>

          <Button
            onClick={handleSignOut}
            disabled={signingOut}
            variant="outlined"
            startIcon={
              signingOut ? <CircularProgress size={16} color="inherit" /> : <LogoutIcon />
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
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
        <Stack spacing={4}>
          <Stack spacing={1.5}>
            <Chip
              label="Authenticated"
              size="small"
              sx={{
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                fontWeight: 600,
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            />
            <Typography variant="h3" component="h1" fontWeight={700} color="white">
              Welcome to DevMate AI
            </Typography>
            <Typography variant="body1" color="rgba(255,255,255,0.7)">
              Your authenticated session is active. The full chat experience with
              Gemini, Firestore history, and Debug / Optimize / Secure modes is
              coming next.
            </Typography>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 4 },
              borderRadius: 4,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
              <Avatar
                src={photoURL || undefined}
                alt={displayName}
                sx={{
                  width: 72,
                  height: 72,
                  fontSize: 28,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </Avatar>

              <Stack spacing={0.5} sx={{ flexGrow: 1, textAlign: { xs: 'center', sm: 'left' } }}>
                <Typography variant="h5" fontWeight={600} color="white">
                  {displayName}
                </Typography>
                {email && (
                  <Typography variant="body2" color="rgba(255,255,255,0.6)">
                    {email}
                  </Typography>
                )}
                <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />
                <Stack
                  direction="row"
                  spacing={3}
                  divider={
                    <Box
                      sx={{
                        width: '1px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                      }}
                    />
                  }
                  justifyContent={{ xs: 'center', sm: 'flex-start' }}
                >
                  <Stack>
                    <Typography variant="caption" color="rgba(255,255,255,0.5)">
                      User ID
                    </Typography>
                    <Typography
                      variant="body2"
                      color="rgba(255,255,255,0.85)"
                      sx={{ fontFamily: 'monospace' }}
                    >
                      {user.uid.slice(0, 12)}…
                    </Typography>
                  </Stack>
                  <Stack>
                    <Typography variant="caption" color="rgba(255,255,255,0.5)">
                      Provider
                    </Typography>
                    <Typography variant="body2" color="rgba(255,255,255,0.85)">
                      {user.providerData?.[0]?.providerId || 'firebase'}
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </Stack>
          </Paper>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ width: '100%' }}
          >
            {['🐛 Debug', '⚡ Optimize', '🔐 Secure'].map((label) => (
              <Paper
                key={label}
                elevation={0}
                sx={{
                  flex: 1,
                  p: 2.5,
                  borderRadius: 3,
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  opacity: 0.6,
                }}
              >
                <Typography variant="body1" fontWeight={600} color="white">
                  {label}
                </Typography>
                <Typography variant="caption" color="rgba(255,255,255,0.5)">
                  Coming soon
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
