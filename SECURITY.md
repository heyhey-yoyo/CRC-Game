# Security policy

## Supported version

Security fixes are applied to the current `1.x` public-preview branch.

## Reporting

Do not open a public issue for exposed credentials, stored cross-site scripting, content-injection paths, unsafe import behavior or a vulnerability that could affect deployed visitors. Use GitHub private vulnerability reporting after the repository is published.

Do not include real patient information, access tokens, Cloudflare API tokens, cookies or private certificates in reports.

## Security boundaries

- The application is static and has no authentication or server-side database.
- Imported save files are JSON, validated and checksum-checked; they never execute JavaScript.
- Content packs in this release are bundled JSON and cannot contain executable code.
- The default Content Security Policy only permits same-origin scripts and workers.
- Local saves may contain gameplay decisions and should not contain real clinical data.
