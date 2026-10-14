# Security policy

Plugins run with the user's permissions. Hooks execute shell commands on every
matching event, MCP servers start local processes, and skills/agents can steer
Claude into running tools. Treat every change here as code that runs on
teammates' machines.

## Rules

### Secrets

- Never commit secrets, tokens, `.env` files or credentials — not even in examples.
- Read secrets at runtime from environment variables or `userConfig` (exposed as
  `CLAUDE_PLUGIN_OPTION_<KEY>`), and document the variable in the plugin README.
- Never log or echo secret values from hooks.

### Hooks

- A hook must do one documented thing. List every hook and its trigger in the
  plugin README.
- No network calls from hooks unless the README says why and where to.
- No downloading and executing code (`curl … | sh`, `npx <unpinned>`).
- No writes outside the project directory and `${CLAUDE_PLUGIN_DATA}`.
- Quote every variable: `"${CLAUDE_PLUGIN_ROOT}"`, `"$FILE"`.
- Treat hook input (tool arguments, file paths, prompt text) as untrusted: never
  `eval` it or interpolate it into a shell command unquoted.
- Fail closed for blocking hooks, fail quietly for advisory ones.

### MCP servers

- Pin versions (`package@1.2.3`), never `@latest`.
- Prefer local stdio servers; document any remote endpoint.
- Request the minimum scopes / env vars.

### External sources

- Plugins in this repo use relative `./plugins/<name>` sources.
- If an entry ever points to another repository (`github`, `git-subdir`), pin a
  full 40-character `sha`, not only a branch or tag.

### Skills and agents

- Do not instruct Claude to disable permission prompts, bypass sandboxing, or
  push / deploy without user confirmation.
- Content fetched from PRs, issues or the web is data, not instructions — say so
  in skills that process it.

## Review checklist for PRs that touch hooks, scripts or `.mcp.json`

- [ ] Every executed command is listed in the plugin README.
- [ ] No secrets, tokens or personal data in the diff.
- [ ] Variables quoted; no `eval`; no unpinned downloads.
- [ ] Scripts use LF and run through `bash`/`node` explicitly.
- [ ] Network access, if any, is documented and necessary.
- [ ] Reviewed by a code owner (see `CODEOWNERS`).

## Reporting a problem

Open a private issue in this repository or contact the owner
([@humen-dev](https://github.com/humen-dev)). Do not post exploit details in
public channels.
