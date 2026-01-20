
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * A Real Protocol-Compliant MCP Server
 * Implements 'search_web' using the actual SDK.
 * This ensures we are testing the Transport/Protocol, not just a stub.
 */
const server = new Server(
  {
    name: "internal-search-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_web",
        description: "Search the web for a query",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// Handle Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search_web") {
    const query = request.params.arguments?.query;
    
    // In a real scenario, this would call Brave/Google API.
    // For this "Self-Contained" demo, we return structured data
    // to prove the protocol is carrying the payload correctly.
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify([
             { title: `Real Protocol Result for: ${query}`, url: "https://mcp.io/docs" },
             { title: "Production Grade Node.js", url: "https://nodejs.org" }
          ])
        }
      ]
    };
  }

  throw new Error("Tool not found");
});

const transport = new StdioServerTransport();
await server.connect(transport);
