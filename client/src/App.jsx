import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ClaudeSetup from './pages/ClaudeSetup';
import Dashboard from './pages/Dashboard';
import AgentBrowser from './pages/AgentBrowser';
import AgentCreate from './pages/AgentCreate';
import AgentDetail from './pages/AgentDetail';
import AgentEdit from './pages/AgentEdit';
import AgentTeams from './pages/AgentTeams';
import AgentStats from './pages/AgentStats';
import ProjectView from './pages/ProjectView';
import Comparison from './pages/Comparison';
import Sessions from './pages/Sessions';

function ProtectedRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/setup-claude" element={<ProtectedRoute><ClaudeSetup /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="agents" element={<AgentBrowser />} />
          <Route path="agents/new" element={<AgentCreate />} />
          <Route path="agents/teams" element={<AgentTeams />} />
          <Route path="agents/stats" element={<AgentStats />} />
          <Route path="agents/:name/edit" element={<AgentEdit />} />
          <Route path="agents/:name" element={<AgentDetail />} />
          <Route path="project/:id" element={<ProjectView />} />
          <Route path="compare/:id" element={<Comparison />} />
          <Route path="sessions" element={<Sessions />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
