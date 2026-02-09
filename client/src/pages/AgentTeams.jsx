import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, Trash2, X, Search, ChevronDown, ChevronRight,
  GripVertical, Shield, User, Star, Check, AlertCircle
} from 'lucide-react';
import { api } from '../api';
import TeamRunPanel from '../components/TeamRunPanel';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

const inputStyle = {
  width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
  borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '13px',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const ROLE_COLORS = {
  leader: { bg: 'rgba(245,158,11,0.1)', color: t.warning, icon: Shield },
  member: { bg: 'rgba(255,255,255,0.04)', color: t.tm, icon: User },
};

export default function AgentTeams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [teamDetail, setTeamDetail] = useState(null);
  const [allAgents, setAllAgents] = useState([]);
  const [searchAgent, setSearchAgent] = useState('');
  const [toast, setToast] = useState(null);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTeams = useCallback(async () => {
    try {
      const data = await api('/api/agent-teams');
      setTeams(data);
    } catch (err) {
      showToast('Failed to load teams', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
    api('/api/agents').then(setAllAgents).catch(() => {});
  }, [fetchTeams]);

  const handleCreateTeam = async () => {
    if (!createForm.name.trim()) return;
    setSaving(true);
    try {
      await api('/api/agent-teams', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      setShowCreate(false);
      setCreateForm({ name: '', description: '' });
      showToast('Team created');
      fetchTeams();
    } catch (err) {
      showToast(err.message || 'Failed to create team', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    try {
      await api(`/api/agent-teams/${teamId}`, { method: 'DELETE' });
      showToast('Team deleted');
      setConfirmDelete(null);
      if (expandedTeam === teamId) {
        setExpandedTeam(null);
        setTeamDetail(null);
      }
      fetchTeams();
    } catch (err) {
      showToast('Failed to delete team', 'danger');
    }
  };

  const handleExpandTeam = async (teamId) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null);
      setTeamDetail(null);
      return;
    }
    setExpandedTeam(teamId);
    try {
      const detail = await api(`/api/agent-teams/${teamId}`);
      setTeamDetail(detail);
    } catch (err) {
      showToast('Failed to load team details', 'danger');
    }
  };

  const handleAddMember = async (agentName) => {
    if (!expandedTeam) return;
    try {
      await api(`/api/agent-teams/${expandedTeam}/members`, {
        method: 'POST',
        body: JSON.stringify({ agent_name: agentName, role: 'member' }),
      });
      setSearchAgent('');
      const detail = await api(`/api/agent-teams/${expandedTeam}`);
      setTeamDetail(detail);
      fetchTeams();
    } catch (err) {
      showToast(err.message || 'Failed to add member', 'danger');
    }
  };

  const handleRemoveMember = async (agentName) => {
    if (!expandedTeam) return;
    try {
      await api(`/api/agent-teams/${expandedTeam}/members/${agentName}`, { method: 'DELETE' });
      const detail = await api(`/api/agent-teams/${expandedTeam}`);
      setTeamDetail(detail);
      fetchTeams();
    } catch (err) {
      showToast('Failed to remove member', 'danger');
    }
  };

  const handleToggleRole = async (agentName, currentRole) => {
    if (!expandedTeam) return;
    const newRole = currentRole === 'leader' ? 'member' : 'leader';
    try {
      await api(`/api/agent-teams/${expandedTeam}/members/${agentName}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      const detail = await api(`/api/agent-teams/${expandedTeam}`);
      setTeamDetail(detail);
    } catch (err) {
      showToast('Failed to update role', 'danger');
    }
  };

  const memberNames = teamDetail?.members?.map(m => m.agent_name) || [];
  const filteredAgents = allAgents.filter(a =>
    !memberNames.includes(a.name) &&
    (a.name.includes(searchAgent.toLowerCase()) || (a.description || '').toLowerCase().includes(searchAgent.toLowerCase()))
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 53px)', backgroundColor: t.bg, color: t.tp }}>
      {/* Header */}
      <div style={{ padding: '24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} color={t.violet} />
            Agent Teams
          </h1>
          <p style={{ fontSize: '13px', color: t.ts, margin: 0 }}>Compose teams of agents for complex tasks</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          backgroundColor: t.tp, color: t.bg, border: 'none',
          padding: '8px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <Plus size={14} />Create Team
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '24px', maxWidth: '900px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: t.tm }}>Loading teams...</div>
        ) : teams.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px', border: `1px dashed ${t.borderS}`,
            borderRadius: '12px', color: t.tm,
          }}>
            <Users size={40} color={t.tm} style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>No teams yet</p>
            <p style={{ fontSize: '12px', margin: '0 0 16px 0' }}>Create your first agent team to compose powerful workflows</p>
            <button onClick={() => setShowCreate(true)} style={{
              backgroundColor: t.violetM, color: t.violet, border: `1px solid ${t.violet}`,
              padding: '8px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer',
            }}>
              <Plus size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Create Team
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {teams.map(team => (
              <div key={team.id}>
                {/* Team Card */}
                <div
                  style={{
                    backgroundColor: t.surface, border: `1px solid ${expandedTeam === team.id ? t.violet : t.border}`,
                    borderRadius: expandedTeam === team.id ? '12px 12px 0 0' : '12px',
                    padding: '16px 20px', cursor: 'pointer', transition: 'border-color 0.2s',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                  onClick={() => handleExpandTeam(team.id)}
                  onMouseEnter={e => { if (expandedTeam !== team.id) e.currentTarget.style.borderColor = t.borderS; }}
                  onMouseLeave={e => { if (expandedTeam !== team.id) e.currentTarget.style.borderColor = t.border; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {expandedTeam === team.id ? <ChevronDown size={16} color={t.violet} /> : <ChevronRight size={16} color={t.tm} />}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{team.name}</h3>
                        <span style={{
                          fontSize: '10px', fontWeight: 600, backgroundColor: t.violetM, color: t.violet,
                          padding: '2px 8px', borderRadius: '100px',
                        }}>
                          {team.member_count || 0} agents
                        </span>
                      </div>
                      {team.description && (
                        <p style={{ fontSize: '12px', color: t.ts, margin: '4px 0 0 0' }}>{team.description}</p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    {/* Member avatars */}
                    <div style={{ display: 'flex', marginRight: '8px' }}>
                      {(team.member_names || '').split(',').filter(Boolean).slice(0, 4).map((name, i) => (
                        <div key={i} style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          backgroundColor: `hsl(${name.charCodeAt(0) * 7 % 360}, 50%, 35%)`,
                          border: `2px solid ${t.surface}`, marginLeft: i > 0 ? '-6px' : '0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 700, color: '#fff',
                        }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    {confirmDelete === team.id ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => handleDeleteTeam(team.id)} style={{
                          backgroundColor: t.danger, color: '#fff', border: 'none',
                          padding: '4px 10px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', cursor: 'pointer',
                        }}>Delete</button>
                        <button onClick={() => setConfirmDelete(null)} style={{
                          backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
                          padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer',
                        }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(team.id)} style={{
                        backgroundColor: 'transparent', color: t.tm, border: 'none', cursor: 'pointer',
                        padding: '4px', display: 'flex',
                      }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Team Detail */}
                {expandedTeam === team.id && teamDetail && (
                  <div style={{
                    backgroundColor: t.bg, border: `1px solid ${t.violet}`, borderTop: 'none',
                    borderRadius: '0 0 12px 12px', padding: '20px',
                  }}>
                    {/* Members List */}
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '11px', fontWeight: 600, color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px 0' }}>
                        Members ({teamDetail.members?.length || 0})
                      </h4>
                      {teamDetail.members && teamDetail.members.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {teamDetail.members.map(member => {
                            const rc = ROLE_COLORS[member.role] || ROLE_COLORS.member;
                            const RoleIcon = rc.icon;
                            return (
                              <div key={member.agent_name} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 12px', backgroundColor: t.surface, borderRadius: '8px',
                                border: `1px solid ${t.border}`,
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <GripVertical size={14} color={t.tm} style={{ cursor: 'grab' }} />
                                  <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    backgroundColor: `hsl(${member.agent_name.charCodeAt(0) * 7 % 360}, 50%, 35%)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '11px', fontWeight: 700, color: '#fff',
                                  }}>
                                    {member.agent_name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '13px', fontWeight: 500 }}>
                                      {member.agent_name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </span>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                      {member.category && (
                                        <span style={{ fontSize: '10px', color: t.tm, backgroundColor: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '4px' }}>
                                          {member.category}
                                        </span>
                                      )}
                                      {member.model && (
                                        <span style={{ fontSize: '10px', color: t.tm, fontFamily: t.mono }}>
                                          {member.model}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    onClick={() => handleToggleRole(member.agent_name, member.role)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '4px',
                                      backgroundColor: rc.bg, color: rc.color, border: 'none',
                                      padding: '4px 10px', fontSize: '10px', fontWeight: 600, borderRadius: '100px',
                                      cursor: 'pointer', textTransform: 'uppercase',
                                    }}
                                  >
                                    <RoleIcon size={10} />{member.role}
                                  </button>
                                  <button onClick={() => handleRemoveMember(member.agent_name)} style={{
                                    backgroundColor: 'transparent', color: t.tm, border: 'none',
                                    cursor: 'pointer', padding: '4px', display: 'flex',
                                  }}>
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ fontSize: '12px', color: t.tm, padding: '12px', textAlign: 'center', border: `1px dashed ${t.border}`, borderRadius: '8px' }}>
                          No members yet. Add agents below.
                        </p>
                      )}
                    </div>

                    {/* Team Runs */}
                    <div style={{ marginBottom: '16px' }}>
                      <TeamRunPanel teamId={team.id} members={teamDetail.members || []} />
                    </div>

                    {/* Add Agent */}
                    <div>
                      <h4 style={{ fontSize: '11px', fontWeight: 600, color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>
                        Add Agent
                      </h4>
                      <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <Search size={14} color={t.tm} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                          value={searchAgent}
                          onChange={e => setSearchAgent(e.target.value)}
                          placeholder="Search agents..."
                          style={{ ...inputStyle, paddingLeft: '34px' }}
                        />
                      </div>
                      {searchAgent && (
                        <div style={{
                          maxHeight: '200px', overflowY: 'auto', backgroundColor: t.surface,
                          border: `1px solid ${t.border}`, borderRadius: '8px',
                        }}>
                          {filteredAgents.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
                              No matching agents
                            </div>
                          ) : (
                            filteredAgents.slice(0, 10).map(agent => (
                              <div key={agent.name}
                                onClick={() => handleAddMember(agent.name)}
                                style={{
                                  padding: '10px 12px', cursor: 'pointer', borderBottom: `1px solid ${t.border}`,
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = t.surfaceEl}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <div>
                                  <span style={{ fontSize: '13px', fontWeight: 500, color: t.tp }}>
                                    {agent.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </span>
                                  <p style={{ fontSize: '11px', color: t.tm, margin: '2px 0 0 0' }}>
                                    {(agent.description || '').substring(0, 80)}
                                  </p>
                                </div>
                                <Plus size={14} color={t.violet} />
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
        }}>
          <div style={{
            width: '440px', backgroundColor: t.surface, border: `1px solid ${t.borderS}`,
            borderRadius: '12px', padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Create Team</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Team Name
                </label>
                <input style={inputStyle} value={createForm.name} placeholder="e.g. Landing Page Team"
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Description
                </label>
                <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={createForm.description}
                  placeholder="What is this team for?"
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button onClick={() => setShowCreate(false)} style={{
                  backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
                  padding: '8px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer',
                }}>Cancel</button>
                <button onClick={handleCreateTeam} disabled={saving || !createForm.name.trim()} style={{
                  backgroundColor: t.tp, color: t.bg, border: 'none',
                  padding: '8px 20px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer',
                  opacity: (saving || !createForm.name.trim()) ? 0.5 : 1,
                }}>{saving ? 'Creating...' : 'Create Team'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          backgroundColor: toast.type === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
          border: `1px solid ${toast.type === 'danger' ? t.danger : t.success}`,
          padding: '10px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {toast.type === 'danger' ? <AlertCircle size={14} color={t.danger} /> : <Check size={14} color={t.success} />}
          <span style={{ fontSize: '13px', fontWeight: 500, color: t.tp }}>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
