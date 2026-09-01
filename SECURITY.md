# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities in a public issue. Contact the repository maintainer privately through GitHub or use GitHub's private vulnerability reporting.

## Credential handling

- Never commit `.env`, Notion tokens, database IDs intended to remain private, passwords, or API keys.
- Use the MCP client's secure environment configuration or a local `.env` excluded by `.gitignore`.
- Rotate a Notion token immediately if it is exposed.
- Review memory content before syncing or publishing a vault.

## Trust boundaries

The local stdio MCP process can read and write the configured Notion database and Obsidian vault. Restrict filesystem permissions and Notion integration access to the minimum required scope.

## Known limitations

The local implementation uses a Notion integration token and polling for Notion-to-Obsidian sync. It is not a hosted multi-tenant service and does not provide OAuth itself.
