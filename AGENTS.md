# Agent instructions

## Git commits — contributors

- **Never** add the Cursor agent / AI as a contributor, co-author, or `Co-authored-by` trailer on commits.
- Do **not** use trailers such as `Co-authored-by: Cursor <cursoragent@cursor.com>` or `Co-authored-by: Cursor Agent <...>`.
- Do **not** add the agent to `package.json` `contributors`, a `CONTRIBUTORS` file, or similar.
- If a commit you created already lists the agent as a co-author/contributor, **roll it back and recommit** without that attribution (amend only if the commit is unpushed and you created it; otherwise create a replacement commit / rewrite only your own unpushed branch history).
- Do **not** commit or push the `.cursor/` folder.
