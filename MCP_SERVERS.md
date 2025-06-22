# MCP Servers Configuration

This document lists all installed Model Context Protocol (MCP) servers available for Claude Code in this environment.

## Installed MCP Servers

### 1. AWS MCP Server
- **Name**: aws
- **Command**: `npx @aws/mcp-server`
- **Scope**: User (global)
- **Purpose**: Provides access to AWS services and best practices
- **Use Cases**: 
  - Interact with AWS services (S3, DynamoDB, Lambda, etc.)
  - Deploy and manage AWS resources
  - Follow AWS best practices in development

### 2. Cloudflare MCP Server
- **Name**: cloudflare
- **Command**: `npx @cloudflare/mcp-server-cloudflare`
- **Scope**: User (global)
- **Purpose**: Deploy, configure & interrogate Cloudflare resources
- **Use Cases**:
  - Manage Cloudflare Workers
  - Configure DNS and CDN settings
  - Deploy to Cloudflare Pages
  - Manage R2 storage

### 3. Puppeteer MCP Server
- **Name**: puppeteer
- **Command**: `npx @modelcontextprotocol/server-puppeteer`
- **Scope**: Local (project)
- **Purpose**: Browser automation and web scraping
- **Use Cases**:
  - Web scraping and data extraction
  - UI testing and automation
  - PDF generation from web pages
  - Screenshot capture

### 4. Bright Data MCP Server
- **Name**: brightdata
- **Command**: `npx @brightdata/mcp-server`
- **Scope**: User (global)
- **Purpose**: Enterprise-grade web scraping with anti-bot bypass
- **Use Cases**:
  - Automated bank transaction collection (AMEX, Truist, etc.)
  - Digital receipt extraction from retailer websites
  - Real-time price monitoring and tracking
  - Accessing JavaScript-heavy and protected websites
  - Bypassing CAPTCHAs and anti-scraping mechanisms
- **Project Benefits**:
  - Automate manual CSV downloads from bank websites
  - Extract order history from Amazon and other retailers
  - Enrich transaction data with merchant information
  - Monitor subscription services and recurring charges

## Usage

These MCP servers are automatically available in Claude Code sessions. They provide specialized tools that Claude can use to interact with various services and perform specific tasks.

To list all configured MCP servers:
```bash
claude mcp list
```

To add a new MCP server:
```bash
# For project scope (default)
claude mcp add <name> <command>

# For user scope (global)
claude mcp add --scope user <name> <command>
```

To remove an MCP server:
```bash
claude mcp remove <name>
```

## Additional Notes

- AWS, Cloudflare, and Bright Data MCPs are installed globally (user scope) and available in all projects
- Puppeteer MCP is installed locally for this project
- MCP servers may require additional configuration (API keys, credentials) to function properly
- Restart your Claude Code session after installing new MCPs to ensure they're loaded
- Bright Data MCP may require API credentials for production use

Last updated: 2025-06-22