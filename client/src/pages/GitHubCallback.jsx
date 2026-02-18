import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken, setRefreshToken, setUser } from '../api';

export default function GitHubCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const hash = window.location.hash.slice(1);
      if (!hash) {
        navigate('/login?error=GitHub authentication failed');
        return;
      }

      // Decode base64url: replace URL-safe chars and add padding
      let b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const data = JSON.parse(atob(b64));

      if (data.token) {
        setToken(data.token);
        if (data.refreshToken) setRefreshToken(data.refreshToken);
        setUser({
          userId: data.userId,
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          claudeConnected: data.claudeConnected,
        });

        // New users go to onboarding, existing users go to dashboard
        if (data.isNewUser) {
          navigate('/setup-claude');
        } else {
          navigate('/');
        }
      } else {
        navigate('/login?error=GitHub authentication failed');
      }
    } catch (err) {
      console.error('GitHub callback parse error:', err);
      navigate('/login?error=GitHub authentication failed');
    }
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#050505', color: '#A1A1AA', fontSize: '14px',
    }}>
      <div style={{
        width: '20px', height: '20px', border: '2px solid #2a2a2b',
        borderTopColor: '#8B5CF6', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite', marginRight: '10px',
      }} />
      Completing GitHub sign-in...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
