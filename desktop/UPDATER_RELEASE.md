# Parking Site Agent updater

The desktop app checks the latest signed release at:

`https://github.com/dainn-dev/next-manage-user/releases/latest/download/latest.json`

## One-time setup

The updater private key is generated locally at:

`desktop/.tauri/parking-site-agent.key`

The `.tauri` directory is git-ignored. Back up this file in a secure password
manager or secret vault, then add it to the repository's GitHub Actions secrets:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < desktop/.tauri/parking-site-agent.key
```

The key is currently passwordless, so `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` can
remain unset. Never commit or share the private key. Losing it prevents existing
installations from accepting future updates.

## Publish an update

1. Set the same new SemVer in:
   - `desktop/package.json`
   - `desktop/src-tauri/Cargo.toml`
   - `desktop/src-tauri/tauri.conf.json`
2. Commit the version change.
3. Create and push the matching tag, for example:

```bash
git tag agent-v0.2.0
git push origin agent-v0.2.0
```

4. The `Publish Parking Site Agent` workflow builds signed installers and a
   `latest.json` manifest for GitHub Releases.
5. Review and publish the draft release. Installed agents will then discover it
   on startup or during the next six-hour check.

The updater signature is mandatory and is verified before installation.
