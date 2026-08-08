# Agent instructions

## Git commits — contributors

- **Never** add the Cursor agent / AI as a git **author**, **committer**, contributor, or `Co-authored-by` trailer.
- Commits must use the **repository owner's** identity as author **and** committer (not `Cursor Agent <cursoragent@cursor.com>`).
- Do **not** use trailers such as `Co-authored-by: Cursor <cursoragent@cursor.com>` or `Co-authored-by: Cursor Agent <...>`.
- Do **not** add the agent to `package.json` `contributors`, a `CONTRIBUTORS` file, or similar.
- Do **not** sign commits with the Cursor agent SSH/GPG key (`commit.gpgsign` / `user.signingkey` pointing at Cursor). Prefer `--no-gpg-sign` unless signing with the owner's own key registered on GitHub. Agent-signed commits show as **Unverified** (`unknown_key`).
- If a commit you created already lists the agent as author/co-author/contributor, **roll it back and recommit** without that attribution (rewrite your branch history / force-push as needed).
- Do **not** commit or push the `.cursor/` folder.
