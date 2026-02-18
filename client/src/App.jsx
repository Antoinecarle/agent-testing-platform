import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api';
import ErrorBoundary from './components/ErrorBoundary';

// Eager-load critical path (login, layout) and heavy pages with complex deps
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ProjectView from './pages/ProjectView'; // Eager: uses xterm + xyflow (TDZ issues when lazy)
import Dashboard from './pages/Dashboard'; // Eager: landing page, always needed

// Lazy-load everything else for code splitting
const ClaudeSetup = React.lazy(() => import('./pages/ClaudeSetup'));
const AgentBrowser = React.lazy(() => import('./pages/AgentBrowser'));
const AgentCreate = React.lazy(() => import('./pages/AgentCreate'));
const AgentDetail = React.lazy(() => import('./pages/AgentDetail'));
const AgentEdit = React.lazy(() => import('./pages/AgentEdit'));
const AgentMcpTools = React.lazy(() => import('./pages/AgentMcpTools'));
const AgentTeams = React.lazy(() => import('./pages/AgentTeams'));
const AgentStats = React.lazy(() => import('./pages/AgentStats'));
const Comparison = React.lazy(() => import('./pages/Comparison'));
const Sessions = React.lazy(() => import('./pages/Sessions'));
const ClientPreview = React.lazy(() => import('./pages/ClientPreview'));
const Marketplace = React.lazy(() => import('./pages/Marketplace'));
const MarketplaceDetail = React.lazy(() => import('./pages/MarketplaceDetail'));
const Skills = React.lazy(() => import('./pages/Skills'));
const SkillCreator = React.lazy(() => import('./pages/SkillCreator'));
const Personaboarding = React.lazy(() => import('./pages/Personaboarding'));
const KnowledgeBase = React.lazy(() => import('./pages/KnowledgeBase'));
const KnowledgeExplorer = React.lazy(() => import('./pages/KnowledgeExplorer'));
const AgentChat = React.lazy(() => import('./pages/AgentChat'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Wallet = React.lazy(() => import('./pages/Wallet'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const GitHubCallback = React.lazy(() => import('./pages/GitHubCallback'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: '#71717a', fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        width: '20px', height: '20px', border: '2px solid #2a2a2b',
        borderTopColor: '#8B5CF6', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite', marginRight: '10px',
      }} />
      Loading...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/preview/:projectId" element={<ClientPreview />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/github/success" element={<GitHubCallback />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/setup-claude" element={<ProtectedRoute><ClaudeSetup /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="marketplace" element={<ErrorBoundary><Marketplace /></ErrorBoundary>} />
              <Route path="marketplace/:name" element={<ErrorBoundary><MarketplaceDetail /></ErrorBoundary>} />
              <Route path="agents" element={<ErrorBoundary><AgentBrowser /></ErrorBoundary>} />
              <Route path="agents/new" element={<ErrorBoundary><AgentCreate /></ErrorBoundary>} />
              <Route path="agents/teams" element={<ErrorBoundary><AgentTeams /></ErrorBoundary>} />
              <Route path="agents/stats" element={<ErrorBoundary><AgentStats /></ErrorBoundary>} />
              <Route path="skills" element={<ErrorBoundary><Skills /></ErrorBoundary>} />
              <Route path="skills/create" element={<ErrorBoundary><SkillCreator /></ErrorBoundary>} />
              <Route path="skills/:id/edit" element={<ErrorBoundary><SkillCreator /></ErrorBoundary>} />
              <Route path="agents/:name/edit" element={<ErrorBoundary><AgentEdit /></ErrorBoundary>} />
              <Route path="agents/:name/mcp-tools" element={<ErrorBoundary><AgentMcpTools /></ErrorBoundary>} />
              <Route path="agents/:name" element={<ErrorBoundary><AgentDetail /></ErrorBoundary>} />
              <Route path="project/:id" element={<ErrorBoundary><ProjectView /></ErrorBoundary>} />
              <Route path="compare/:id" element={<ErrorBoundary><Comparison /></ErrorBoundary>} />
              <Route path="knowledge" element={<ErrorBoundary><KnowledgeBase /></ErrorBoundary>} />
              <Route path="knowledge/:id" element={<ErrorBoundary><KnowledgeBase /></ErrorBoundary>} />
              <Route path="knowledge/:id/explore" element={<ErrorBoundary><KnowledgeExplorer /></ErrorBoundary>} />
              <Route path="chat/:agentName" element={<ErrorBoundary><AgentChat /></ErrorBoundary>} />
              <Route path="chat/:agentName/:chatId" element={<ErrorBoundary><AgentChat /></ErrorBoundary>} />
              <Route path="wallet" element={<ErrorBoundary><Wallet /></ErrorBoundary>} />
              <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
              <Route path="personaboarding" element={<ErrorBoundary><Personaboarding /></ErrorBoundary>} />
              <Route path="sessions" element={<ErrorBoundary><Sessions /></ErrorBoundary>} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
