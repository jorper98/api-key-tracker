# Changelog

## v1.1.1 - 2026-05-18

- Fixed zip export to use currently selected keys file
- Added light/dark theme toggle (top right)
- Action icons unified in grey (delete remains red on hover)
- Archiver API compatibility fix for zip export
- Export warning dialog for unencrypted keys

## v1.1.0 - 2026-05-18

- Multiple keys file support (`<name>-keys.json`)
- Per-file unique encryption keys stored in `data/.secrets.json`
- Startup file selection modal with dropdown
- Top-right dropdown to switch between keys files
- Create new keys files from UI
- Encrypted sample data file (`sample-keys.json`) with sample secrets
- Port configuration via `.env` and Docker Compose
- Improved Windows file handling for secrets storage
- Updated `.gitignore` for multi-file support

## v1.0.0 - 2026-05-18

- Initial release
- Vendor account management (CRUD)
- API key management (CRUD)
- AES-256-CBC encryption at rest for API keys
- Full-text search across all fields
- Filter by vendor, status, and project
- One-click copy to clipboard for API keys
- Dark theme UI
- Export/Import data functionality
- Auto-generated encryption key on first run
