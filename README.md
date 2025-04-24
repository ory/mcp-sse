# MCP SSE Ory Server

This project implements a Model Context Protocol (MCP) server that uses Server-Sent Events (SSE) for communication and integrates with Ory Network for OAuth 2.1 functionality.

## Overview

The server provides:

- MCP server implementation with SSE transport
- OAuth 2.1 integration via Ory Network
- Secure token verification and client management
- Project management tools for Ory Network

## Prerequisites

- Node.js (v18 or later)
- Ory Network account and API keys

## Environment Variables

Create a `.env` file with the following variables (see `.example.env` for reference):

```env
# Ory Network Configuration
ORY_BASE_API_URL=https://api.console.ory.sh
ORY_PROJECT_URL=https://yourprojectslug.projects.oryapis.com
ORY_PROJECT_API_KEY=yourprojectapikey
ORY_WORKSPACE_API_KEY=yourworkspaceapikey

# Server Configuration
MCP_SERVER_BASE_URL=http://localhost:4000
MCP_SERVER_DOCS_URL=https://ory.sh/docs
MCP_SERVER_PORT=4000
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Development

Run the development server:

```bash
npm run dev
```

## Building

Build the TypeScript project:

```bash
npm run build
```

## Running

Start the production server:

```bash
npm run start
```

## API Endpoints

- `GET /mcp` - Establishes SSE connection for MCP communication
- `POST /messages` - Handles MCP messages from clients
- OAuth endpoints (via Ory Network):
  - `/oauth2/auth` - Authorization endpoint
  - `/oauth2/token` - Token endpoint
  - `/oauth2/revoke` - Token revocation endpoint
  - `/oauth2/register` - Client registration endpoint

## Features

- **MCP Server**: Implements the Model Context Protocol for AI model communication
- **SSE Transport**: Uses Server-Sent Events for real-time communication
- **OAuth Integration**: Secure authentication via Ory Network
- **Client Management**: Dynamic OAuth client verification and management
- **Project Tools**: Tools for managing Ory Network projects including:
  - List projects in a workspace
  - Create new projects
  - Get project details
  - Update project configurations

## Security

- Bearer token authentication
- PKCE support
- Secure token verification
- Client validation
- Proper error handling and logging

## Error Handling

The server implements graceful shutdown and proper error handling for:

- Uncaught exceptions
- Unhandled promise rejections
- Process termination signals (SIGINT, SIGTERM)

## License

Copyright 2025 Ory Corp

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
