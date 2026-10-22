# Shared website publishing

The authenticated editor is https://sudheerkumargandiboyana.com/admin. The HAI
contact section links to the same editor. Use the existing CMS credentials.

1. Edit a project or profile field. New projects start as private drafts.
2. Save draft to keep work without changing public pages.
3. Set a reviewed project to published. Set featured/homepage order and résumé
   inclusion separately. Keep permanent IDs and published slugs unchanged.
4. Publish both sites. Check Publishing & history and the public destinations.
5. Refresh public GitHub releases in the editor when reviewing a new release,
   then publish. Stable releases and previews are separate; the archive shows
   only the five newest stable releases. Release notes retain their version scope.
6. Archive a project instead of deleting it. Restore a prior revision from
   Publishing & history to undo a publication.

Both sites serve pre-generated HTML from the same atomic `/published/current`
pointer in the `website-catalog-published` Docker volume. The portfolio nginx
and HAI backend mount it read-only; only the CMS writes it. Editor downtime does
not remove published pages. A renderer/template change creates a new revision
on startup without overwriting catalog edits. The original `/data/content.json`
is retained as a legacy recovery baseline, not the active editor database.

The public API omits draft and archived records. All editor inputs are validated;
HTML is escaped; private source URLs are rejected. Unsupported/unknown fields
fail validation. Concurrent publication attempts based on stale revisions return
409. CMS sessions remain HTTP-only, secure in production and same-site strict.

Authenticated studio routes: `/api/draft`, `/api/content` (publish),
`/api/history`, `/api/restore`, `/api/publishing-status`,
`/api/releases/<id>/refresh`. Public catalog reads: portfolio `/api/content` and
HAI `/api/catalog/content`. Both public pages carry a content-revision meta tag.

The server's `ops/github-sync.py` updates only the designated profile README
section, description/homepage metadata for an explicit owned public-repository
allowlist, and three legacy redirect pages. It never changes visibility or code.
It uses the server's existing gh authentication; no GitHub token enters public
content or the CMS. Unchanged content is skipped. Failed destinations appear
separately in the editor; the scheduled worker retries every five minutes.
Handwritten README material outside the markers is preserved. Project pins are
curated separately in GitHub's profile UI.

Run `npm ci && npm test` from `cms/` on Linux, or run the checks in the CMS Docker
image. The assertions cover add/edit/archive, releases, preview labels, private
source, validation, publication conflicts, atomic swaps, rollback and HTTP auth.
`ops/verify-public.py` checks live inventories/revisions, generated pages,
canonical metadata, real 404s, legacy redirects, images and release downloads.
The hourly result is `/home/bigserver/website-catalog-status/public-verification.json`.
It reports failures rather than claiming that future failures are impossible.

Back up **both** `cms-data` and `website-catalog-published` volumes, uploads,
source commits and the Cloudflare ingress configuration before server migration.
Do not copy the seed over current revisions during redeployment. Legacy URLs
redirect to the canonical guide. Archived/unknown guides return genuine 404s.

Initial recovery baseline: `/home/bigserver/website-sync-backup-20261022/`.
It includes deployed source, CMS data/uploads, frontend pages and old Docker
image tags. `rollback.sh` there restores the old images without deleting either
database or content volume. GitHub originals are preserved in its `github/`
subdirectory. New published revisions remain available for recovery after rollback.
