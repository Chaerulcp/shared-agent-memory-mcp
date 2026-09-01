# Contributing

Thank you for contributing to Shared Agent Memory MCP.

## Development

1. Fork or clone the repository.
2. Install dependencies with `npm install`.
3. Make a focused change.
4. Run `npm run build` and `npm run doctor` where applicable.
5. Add tests or a reproducible verification step.
6. Open a pull request with a clear summary and testing notes.

## Guidelines

- Do not commit `.env`, tokens, passwords, API keys, databases, logs, or personal paths.
- Keep MCP schemas explicit and backward-compatible where possible.
- Preserve Notion-only operation when Obsidian is unavailable.
- Keep provider-specific configuration out of the core server.
- Use clear, focused commits.
