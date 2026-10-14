## What changes

<!-- Plugin(s) touched and what was added / changed / removed. -->

## Checklist

- [ ] `node scripts/validate-marketplace.mjs` passes
- [ ] `claude plugin validate . --strict` passes
- [ ] Installed from `./` (`claude plugin marketplace add ./`) and tried in a session
- [ ] Plugin `name` in `plugin.json` equals its `marketplace.json` entry
- [ ] Plugin is self-contained — no `../` or files outside its folder
- [ ] Plugin README and root README plugin table updated
- [ ] Version: omitted (commit-tracked) **or** bumped in `plugin.json` only — see `docs/RELEASES.md`
- [ ] Renamed/removed plugin is mapped in `renames`

### If hooks, scripts or `.mcp.json` changed

- [ ] Went through the checklist in `docs/SECURITY.md`
- [ ] No secrets; variables quoted; no unpinned downloads
- [ ] Scripts use LF and are invoked via `bash`/`node`
