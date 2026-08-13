# Security Policy

## Supported Versions

This project is currently pre-1.0 in terms of active support scope. Security fixes are applied to the latest release on the `main` branch only.

| Version | Supported |
| ------- | --------- |
| Latest (main) | ✅ |
| Older releases | ❌ |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please **do not open a public GitHub Issue**.

Instead, please report it privately using one of the following methods:

1. **GitHub Private Vulnerability Reporting** (preferred): Use the "Report a vulnerability" button under this repository's [Security tab](../../security/advisories/new).
2. If that's not available to you, open a regular Issue asking for a private contact method, without including any vulnerability details.

Please include as much of the following as you can:

- A description of the vulnerability and its potential impact
- Steps to reproduce (proof of concept, if possible)
- The affected version/commit

**Please do not include your SwitchBot API Token, Client Secret, or any other credentials** when reporting an issue.

## What to Expect

This is an independent, unofficial, single-maintainer open source project. There is no SLA, but security reports will be prioritized over regular feature requests. You can expect an initial response acknowledging the report, followed by a fix and coordinated disclosure once a patch is available.

## Scope

This plugin communicates directly between your PC and the official SwitchBot API (`https://api.switch-bot.com`). There is no relay server operated by the maintainer. See the [Privacy & Security](./README.md#privacy--security) section of the README for more details on how credentials and data are handled.

This project is not affiliated with SwitchBot / Wonderlabs, Inc. or Elgato. Vulnerabilities in the official SwitchBot API or Stream Deck software itself should be reported to those respective vendors, not here.
