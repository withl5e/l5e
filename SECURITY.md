# Security

Do not open public issues for vulnerabilities.

Until a dedicated security contact is configured, report suspected vulnerabilities through a private
maintainer channel. Include:

- affected package and version
- reproduction steps
- impact
- suggested fix if available

L5E renders server-side HTML. Treat user-provided HTML and rich text as untrusted input unless
your app sanitizes it before rendering.
