import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const AgentActivityContext = createContext(null);

export function AgentActivityProvider({ children }) {
  const [jobs, setJobs] = useState({});
  const jobsRef = useRef({});

  const registerJob = useCallback((jobId, data) => {
    const job = {
      id: jobId,
      projectId: data.projectId || '',
      projectName: data.projectName || '',
      agentName: data.agentName || 'Claude',
      status: 'running',
      subagents: [],
      toolCalls: [],
      streamingText: '',
      userMessage: data.userMessage || '',
      startedAt: Date.now(),
      lastUpdate: Date.now(),
    };
    jobsRef.current = { ...jobsRef.current, [jobId]: job };
    setJobs(prev => ({ ...prev, [jobId]: job }));
  }, []);

  const updateJob = useCallback((jobId, updates) => {
    if (!jobsRef.current[jobId]) return;
    const updated = { ...jobsRef.current[jobId], ...updates, lastUpdate: Date.now() };
    jobsRef.current = { ...jobsRef.current, [jobId]: updated };
    setJobs(prev => ({ ...prev, [jobId]: updated }));
  }, []);

  const completeJob = useCallback((jobId) => {
    if (!jobsRef.current[jobId]) return;
    const updated = { ...jobsRef.current[jobId], status: 'done', completedAt: Date.now() };
    jobsRef.current = { ...jobsRef.current, [jobId]: updated };
    setJobs(prev => ({ ...prev, [jobId]: updated }));
  }, []);

  const clearJob = useCallback((jobId) => {
    const { [jobId]: _, ...rest } = jobsRef.current;
    jobsRef.current = rest;
    setJobs(rest);
  }, []);

  const clearDone = useCallback(() => {
    const active = {};
    for (const [id, job] of Object.entries(jobsRef.current)) {
      if (job.status !== 'done') active[id] = job;
    }
    jobsRef.current = active;
    setJobs(active);
  }, []);

  return (
    <AgentActivityContext.Provider value={{ jobs, registerJob, updateJob, completeJob, clearJob, clearDone }}>
      {children}
    </AgentActivityContext.Provider>
  );
}

export function useAgentActivity() {
  const ctx = useContext(AgentActivityContext);
  if (!ctx) return {
    jobs: {},
    registerJob: () => {},
    updateJob: () => {},
    completeJob: () => {},
    clearJob: () => {},
    clearDone: () => {},
  };
  return ctx;
}
