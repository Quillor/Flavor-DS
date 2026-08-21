/**
 * Flavor DS MCP over Streamable HTTP — Vercel serverless function.
 *
 *   POST https://flavor-ds.vercel.app/api/mcp   (JSON-RPC, MCP Streamable HTTP transport)
 *   GET  https://flavor-ds.vercel.app/api/mcp   → 405 (stateless: no server-push stream)
 *
 * Stateless: every request builds a fresh McpServer (packages/mcp/src/server.mjs · createServer)
 * and a fresh transport, so the function needs no session store and scales horizontally. The
 * same tools as `npx -y @flavor-ds/mcp` (stdio); this is what a hosted agent registers:
 *   claude mcp add --transport http flavor-ds https://flavor-ds.vercel.app/api/mcp
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from '../packages/mcp/src/server.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
};

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') {
    res.statusCode = 405; res.setHeader('Allow', 'POST, OPTIONS'); res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Flavor DS MCP: stateless Streamable HTTP — POST JSON-RPC to this URL. Docs: https://flavor-ds.vercel.app/mcp/' }, id: null }));
  }
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    // Vercel's Node runtime pre-parses JSON bodies into req.body; the transport accepts it as parsedBody.
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: String(err?.message || err) }, id: null })); }
  }
}
