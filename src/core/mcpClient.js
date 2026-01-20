import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import logger from '../infrastructure/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class MCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;

    logger.info('[MCP] Connecting to Internal Server...');

    // Pointing to our internal server script
    const serverScript = path.resolve(__dirname, '../infrastructure/internalMcpServer.js');

    this.transport = new StdioClientTransport({
      command: "node",
      args: [serverScript]
    });

    this.client = new Client(
      {
        name: "mcp-control-plane-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    try {
      await this.client.connect(this.transport);
      this.isConnected = true;
      logger.info('[MCP] Connected via Stdio Transport');
      
      // Optional: List tools to verify connection
      const tools = await this.client.listTools();
      logger.info('[MCP] Available Tools:', tools.tools.map(t => t.name));

    } catch (error) {
      logger.error('[MCP] Connection Failed:', error);
      throw error;
    }
  }

  async executeTool(toolName, args) {
    if (!this.isConnected) {
      await this.connect();
    }

    logger.info(`[MCP] Requesting Tool Execution: ${toolName}`, args);

    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: args
      });

      logger.info(`[MCP] Tool Response Received`);
      
      // Parse the content from the response
      // MCP returns { content: [ { type: 'text', text: '...' } ] }
      const textContent = response.content.find(c => c.type === 'text');
      
      if (textContent) {
        try {
            return JSON.parse(textContent.text);
        } catch (e) {
            return textContent.text;
        }
      }
      return response;

    } catch (error) {
      logger.error(`[MCP] Execution Error:`, error);
      throw error;
    }
  }
}

// Singleton verification - in a real app might be transient per request or persistent
export const mcpClient = new MCPClient();
