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



Shared information, independent designs (October 22, 2026): each project has one central record. Edit it through /admin on either site (both use this studio), then Publish both sites. Names, summaries, descriptions, features, images and download links update together on both homepages, directories and guides. Each domain serves its own /projects/ and /projects/<slug>/ pages with its own header, fonts, styles and navigation. Project information belongs in the catalog, never in a site template. Layout/style edits belong only in that site template. Drafts stay private until published. No cross-site Projects redirect is used.


Site roles (October 22, 2026): sudheerkumargandiboyana.com is the professional exhibition, with experience, resume and case studies. All project try and download actions there lead to the corresponding project on myhai.org. myhai.org is the playground for live apps, downloads, websites and experiments. Source links remain available as engineering evidence. Both presentations use the same central project records.

Notewll rebrand (October 25, 2026): the project retains immutable ID `dotflow`,
but its public slug is `notewll`. Both domains permanently redirect the old
`/projects/dotflow/` prefix, preserving query strings and subpaths. New links,
canonical metadata and sitemaps use `/projects/notewll/`. The publisher permits
only this explicit legacy-to-current slug migration; other slug changes remain
blocked. Published history supports rollback without replacing unrelated content.

Application subdomains (October 25, 2026): every published project now has a
product page at https://<slug>.myhai.org/. Notewll uses notewll.myhai.org.
The personal portfolio retains its separate case-study URLs. HAI's old project
URLs permanently redirect to the subdomain; launch/download buttons retain the
existing application destinations. Main-site navigation/assets remain on
myhai.org. Each app has robots.txt and sitemap.xml, and the main sitemap indexes
all app sitemaps. Only published catalog slugs are accepted as application hosts;
unknown hosts and application-host API paths return 404. Explicit www/staging
and existing exact DNS records retain priority over the application wildcard.
The previous canonical-path description applies to portfolio case studies only.
