import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import dotenv from 'dotenv';
import { z } from 'zod';
import {
  Configuration,
  CreateProjectBodyEnvironmentEnum,
  ProjectApi,
  WorkspaceApi,
} from '@ory/client-fetch';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { HydraProvider } from './hydraProvider.js';

/**
 * This example server demonstrates the deprecated HTTP+SSE transport
 * (protocol version 2024-11-05). It mainly used for testing backward compatible clients.
 *
 * The server exposes two endpoints:
 * - /mcp: For establishing the SSE stream (GET)
 * - /messages: For receiving client messages (POST)
 *
 */

// Load environment variables
dotenv.config();

// Initialize Ory client for service
// This is the API key for the Ory Network project and used to validate access_tokens
// and view clients via the project admin APIs
const projectApiKey = process.env.ORY_PROJECT_API_KEY;
if (!projectApiKey) {
  throw new Error('ORY_PROJECT_API_KEY environment variable is required');
}

// This is the API key for the Ory Network workspace and used to view projects via the workspace admin APIs
const workspaceApiKey = process.env.ORY_WORKSPACE_API_KEY;
if (!workspaceApiKey) {
  throw new Error('ORY_WORKSPACE_API_KEY environment variable is required');
}

const oryBaseApiUrl = process.env.ORY_BASE_API_URL;
if (!oryBaseApiUrl) {
  throw new Error('ORY_BASE_API_URL environment variable is required');
}

const projectUrl = process.env.ORY_PROJECT_URL;
if (!projectUrl) {
  throw new Error('ORY_PROJECT_URL environment variable is required');
}

const oryConfig = new Configuration({
  basePath: oryBaseApiUrl,
  accessToken: workspaceApiKey,
  headers: {
    Authorization: `Bearer ${workspaceApiKey}`,
  },
});

const projectApi = new ProjectApi(oryConfig);
const workspaceApi = new WorkspaceApi(oryConfig);

type HydraClient = {
  client_id: string;
  redirect_uris: string[];
};

// Function to list OAuth2 clients from Hydra
const listOAuth2Clients = async (): Promise<Record<string, string[]>> => {
  try {
    const response = await fetch(`${projectUrl}/admin/clients`, {
      headers: {
        Authorization: `Bearer ${projectApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list OAuth2 clients: ${response.statusText}`);
    }

    const clients = (await response.json()) as HydraClient[];
    return clients.reduce(
      (acc: Record<string, string[]>, client: HydraClient) => {
        acc[client.client_id] = client.redirect_uris || [];
        return acc;
      },
      {}
    );
  } catch (error) {
    console.error('Error listing OAuth2 clients:', error);
    throw error;
  }
};

// Create an MCP server instance
const getServer = (): McpServer => {
  const server = new McpServer(
    {
      name: 'simple-sse-server',
      version: '1.0.0',
    },
    { capabilities: { logging: {} } }
  );

  // List Projects Tool
  server.tool(
    'listProjects',
    'List all projects in a give Ory Network workspace',
    {
      workspaceId: z.string(),
    },
    async ({ workspaceId }) => {
      try {
        const response = await workspaceApi.listWorkspaceProjects({
          workspace: workspaceId,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error listing projects: ${error}`,
            },
          ],
        };
      }
    }
  );

  // Create Project Tool
  server.tool(
    'createProject',
    'Create a new project in a give Ory Network workspace',
    {
      name: z.string(),
      workspaceId: z.string(),
      environment: z.enum(['dev', 'stage', 'prod']),
    },
    async ({ name, workspaceId, environment }) => {
      try {
        const response = await projectApi.createProject({
          createProjectBody: {
            name,
            workspace_id: workspaceId,
            environment: environment as CreateProjectBodyEnvironmentEnum,
          },
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating project: ${error}`,
            },
          ],
        };
      }
    }
  );

  // Get Project Tool
  server.tool(
    'getProject',
    'Get a project by ID for a give Ory Network workspace',
    {
      projectId: z.string(),
    },
    async ({ projectId }) => {
      try {
        const response = await projectApi.getProject({
          projectId: projectId,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting project: ${error}`,
            },
          ],
        };
      }
    }
  );

  // Patch Project Tool
  server.tool(
    'patchProject',
    'Patch a project by ID for a give Ory Network workspace',
    {
      projectId: z.string(),
      revisionId: z.string(),
      config: z.record(z.unknown()),
    },
    async ({ projectId, revisionId, config }) => {
      try {
        const response = await projectApi.patchProjectWithRevision({
          projectId: projectId,
          revisionId: revisionId,
          ...config,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error patching project: ${error}`,
            },
          ],
        };
      }
    }
  );
  return server;
};

const app = express();
app.use(express.json());

const baseUrl = process.env.MCP_SERVER_BASE_URL;
if (!baseUrl) {
  throw new Error('MCP_SERVER_BASE_URL environment variable is required');
}

const serviceDocumentationUrl = process.env.MCP_SERVER_DOCS_URL;
if (!serviceDocumentationUrl) {
  throw new Error('MCP_SERVER_DOCS_URL environment variable is required');
}

const proxyProvider = new HydraProvider({
  endpoints: {
    authorizationUrl: `${projectUrl}/oauth2/auth`,
    tokenUrl: `${projectUrl}/oauth2/token`,
    revocationUrl: `${projectUrl}/oauth2/revoke`,
    registrationUrl: `${projectUrl}/oauth2/register`,
  },
  verifyAccessToken: async (
    token: string
  ): Promise<{
    token: string;
    clientId: string;
    scopes: string[];
    expiresAt: number;
  }> => {
    try {
      const response = await fetch(`${projectUrl}/admin/oauth2/introspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${projectApiKey}`,
        },
        body: new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token introspection failed: ${response.statusText}`);
      }

      const introspection = await response.json();

      if (!introspection.active) {
        throw new Error('Token is not active');
      }

      const clients = await listOAuth2Clients();
      const client = clients[introspection.client_id];

      if (!client) {
        throw new Error('Token client ID mismatch');
      }

      return {
        token,
        clientId: introspection.client_id,
        scopes: introspection.scope?.split(' ') || [],
        expiresAt: introspection.exp,
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      throw error;
    }
  },
  getClient: async (
    client_id: string
  ): Promise<{ client_id: string; redirect_uris: string[] }> => {
    const clients = await listOAuth2Clients();
    const client = clients[client_id];

    if (!client) {
      throw new Error('Invalid client ID');
    }

    return {
      client_id,
      redirect_uris: client,
    };
  },
});

app.use(
  mcpAuthRouter({
    provider: proxyProvider,
    issuerUrl: new URL(projectUrl),
    baseUrl: new URL(baseUrl),
    serviceDocumentationUrl: new URL(serviceDocumentationUrl),
  })
);

// Store transports by session ID
const transports: Record<string, SSEServerTransport> = {};

// SSE endpoint for establishing the stream
app.get(
  '/mcp',
  requireBearerAuth({
    provider: proxyProvider,
    requiredScopes: ['ory.admin'],
  }),
  async (req: Request, res: Response): Promise<void> => {
    console.log('Received GET request to /sse (establishing SSE stream)');

    try {
      // Create a new SSE transport for the client
      // The endpoint for POST messages is '/messages'
      const transport = new SSEServerTransport('/messages', res);

      // Store the transport by session ID
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;

      // Set up onclose handler to clean up transport when closed
      transport.onclose = (): void => {
        console.log(`SSE transport closed for session ${sessionId}`);
        delete transports[sessionId];
      };

      // Connect the transport to the MCP server
      const server = getServer();
      await server.connect(transport);

      // Start the SSE transport to begin streaming
      // This sends an initial 'endpoint' event with the session ID in the URL
      //await transport.start();

      console.log(`Established SSE stream with session ID: ${sessionId}`);
    } catch (error) {
      console.error('Error establishing SSE stream:', error);
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE stream');
      }
    }
  }
);

// Messages endpoint for receiving client JSON-RPC requests
app.post(
  '/messages',
  requireBearerAuth({
    provider: proxyProvider,
    requiredScopes: ['ory.admin'],
  }),
  async (req: Request, res: Response): Promise<void> => {
    console.log('Received POST request to /messages');

    // Extract session ID from URL query parameter
    // In the SSE protocol, this is added by the client based on the endpoint event
    const sessionId = req.query.sessionId as string | undefined;

    if (!sessionId) {
      console.error('No session ID provided in request URL');
      res.status(400).send('Missing sessionId parameter');
      return;
    }

    const transport = transports[sessionId];
    if (!transport) {
      console.error(`No active transport found for session ID: ${sessionId}`);
      res.status(404).send('Session not found');
      return;
    }

    try {
      // Handle the POST message with the transport
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('Error handling request:', error);
      if (!res.headersSent) {
        res.status(500).send('Error handling request');
      }
    }
  }
);

// Start the server
const port = process.env.MCP_SERVER_PORT || 3000;
console.log('Starting server...');
const serverInstance = app
  .listen(port, () => {
    console.log(`MCP Server with OAuth listening on port ${port}`);
  })
  .on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });

// Handle process termination
const SHUTDOWN_TIMEOUT = 5000; // ms

const gracefulShutdown = (signal: string): void => {
  console.log(`Received ${signal}`);
  console.log('Shutting down server gracefully...');

  // 1. Close active SSE transports
  console.log(
    `Closing ${Object.keys(transports).length} active SSE transport(s)...`
  );
  Object.values(transports).forEach((transport) => {
    try {
      transport.close();
    } catch (err) {
      console.error(`Error closing transport ${transport.sessionId}:`, err);
    }
  });
  console.log('Finished closing transports.');

  // 2. Close the main HTTP server
  const timeoutId = setTimeout(() => {
    console.warn('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  serverInstance.close((err) => {
    clearTimeout(timeoutId);
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    } else {
      console.log('Server closed successfully.');
      process.exit(0);
    }
  });
};

// Handle graceful shutdown
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately, just log the error
  console.error('Continuing to run despite unhandled rejection...');
});
