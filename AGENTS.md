# Agent instructions

## Git commits — contributors

- **Never** add the Cursor agent / AI as a git **author**, **committer**, contributor, or `Co-authored-by` trailer.
- Commits must use the **repository owner's** identity as author (not `Cursor Agent <cursoragent@cursor.com>`).
- Do **not** use trailers such as `Co-authored-by: Cursor <cursoragent@cursor.com>` or `Co-authored-by: Cursor Agent <...>`.
- Do **not** add the agent to `package.json` `contributors`, a `CONTRIBUTORS` file, or similar.
- If a commit you created already lists the agent as author/co-author/contributor, **roll it back and recommit** without that attribution (rewrite your branch history / force-push as needed).
- Do **not** commit or push the `.cursor/` folder.
