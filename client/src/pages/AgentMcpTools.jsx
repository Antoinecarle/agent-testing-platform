import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Redirect to the MCP tab on the agent detail page
export default function AgentMcpTools() {
  const { name } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/agents/${name}?tab=mcp`, { replace: true });
  }, [name, navigate]);

  return null;
}
