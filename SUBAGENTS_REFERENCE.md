# Claude Code Sub-Agents Reference

## Overview
Subagents are specialized AI assistants within Claude Code that can be delegated specific tasks. They operate in separate context windows and have specific purposes and expertise areas.

## Core Features
- Operate in separate context windows
- Have specific purposes and expertise areas  
- Can be configured with custom system prompts
- Can be granted specific tool access

## Creating and Managing Subagents

### Storage Locations
- **Project level**: `.claude/agents/`
- **User level**: `~/.claude/agents/`

### File Structure
Subagents are stored as Markdown files with YAML frontmatter:

```markdown
---
name: code-reviewer
description: Expert code review specialist
tools: Read, Grep, Glob, Bash
---
# Detailed system prompt goes here
```

### Configuration Fields
- `name`: Unique identifier for the subagent
- `description`: Brief description of the subagent's purpose
- `tools`: Optional comma-separated list of tools the subagent can access

## Invocation Methods
1. **Automatic delegation**: Claude Code may automatically delegate tasks based on context
2. **Explicit invocation**: Use phrases like "Use the [subagent-name] to [task]"

## Example Subagents
1. **Code Reviewer**: Checks code quality and security
2. **Debugger**: Performs root cause analysis
3. **Data Scientist**: Handles SQL and data analysis tasks

## Best Practices
- Create focused, single-purpose subagents
- Write detailed system prompts
- Limit tool access to only necessary tools
- Version control project subagents
- Use descriptive names

## Advanced Usage
- Chain multiple subagents for complex workflows
- Dynamically select subagents based on context
- Use subagents to preserve main conversation context

## Performance Considerations
- Helps preserve main conversation context
- May add slight latency due to context gathering
- Reduces token usage in main conversation

## Creation Command
Use the `/agents` command in Claude Code to manage subagents interactively.

---
*Source: https://docs.anthropic.com/en/docs/claude-code/sub-agents*
*Saved: 2025-08-16*