import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './App.jsx';
import { AuthProvider } from './firebase/AuthContext';
import './index.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#6366f1' },
    secondary: { main: '#8b5cf6' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
