# halosis

An unofficial server-side Node.js SDK for the Halosis API.

> [!IMPORTANT]
> This is a community-maintained project. It is not an official Halosis SDK and
> is not affiliated with, endorsed by, or maintained by Halosis. For questions
> about the Halosis service or API access, use Halosis's official support
> channels.

> This package is under initial development and is not ready for production
> use or npm publication yet.

## Requirements

- Node.js 18 or newer
- A Halosis API access token
- A server with an outbound IP address whitelisted by Halosis

Direct browser usage is not supported because it would expose API credentials
and cannot reliably satisfy Halosis IP-whitelist requirements.

## Project scope

This package provides a typed Node.js client based on the publicly supplied
Halosis API documentation. Halosis remains the source of truth for API behavior,
availability, account permissions, and IP-whitelist requirements.

## Trademark notice

Halosis and related names, logos, and marks belong to their respective owners.
Use of the name in this package identifies the API it integrates with and does
not imply an official relationship.
