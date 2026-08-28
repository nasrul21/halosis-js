# halosis

Server-side Node.js SDK for the Halosis API.

> This package is under initial development and is not ready for production
> use or npm publication yet.

## Requirements

- Node.js 18 or newer
- A Halosis API access token
- A server with an outbound IP address whitelisted by Halosis

Direct browser usage is not supported because it would expose API credentials
and cannot reliably satisfy Halosis IP-whitelist requirements.
