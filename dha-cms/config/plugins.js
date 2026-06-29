module.exports = ({ env }) => ({
  mcp: {
    enabled: env.bool('MCP_ENABLED', true),
    config: {
      session: {
        type: 'memory',
        max: env.int('MCP_SESSION_MAX', 20),
        ttlMs: env.int('MCP_SESSION_TTL_MS', 600000),
        updateAgeOnGet: env.bool('MCP_SESSION_UPDATE_AGE_ON_GET', true),
      },
      allowedIPs: env.array('MCP_ALLOWED_IPS', ['127.0.0.1', '::1']),
    },
  },
});
