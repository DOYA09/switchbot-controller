# Security Policy

## Supported Versions

This project is currently pre-1.0 and under active development. Security fixes are applied to the latest version on the `main` branch only.

| Version | Supported |
| ------- | --------- |
| Latest (main) | :white_check_mark: |
| Older versions | :x: |

## Reporting a Vulnerability

If you discover a security vulnerability in SwitchBot Controller, please **do not open a public GitHub Issue or Pull Request**.

Instead, please report it privately using GitHub's **Private Vulnerability Reporting** feature, available via the "Report a vulnerability" button under this repository's [Security tab](../../security/advisories/new).

When reporting a vulnerability, please include as much of the following as you can:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce the issue (proof of concept, if possible)
- The affected version or commit, if known
- Any relevant logs or screenshots, if available

**Please do not include or publicly disclose your SwitchBot API Token, Secret Key, or any other credentials** in your report.

## What to Expect

This is an independent, unofficial, single-maintainer open source project. There is no formal SLA, but security reports will be prioritized over regular feature requests. You can expect an initial response acknowledging the report, followed by a fix and coordinated disclosure once a patch is available.

## Scope

This security policy applies to the SwitchBot Controller source code and the official plugin package distributed through this repository.

This plugin communicates directly between your PC and the official SwitchBot API (`https://api.switch-bot.com`). There is no relay server operated by the maintainer. See the [Privacy & Security](./README.md#privacy--security) section of the README for more details on how credentials and data are handled.

This project is not affiliated with SwitchBot / Wonderlabs, Inc. or Elgato. Vulnerabilities in the official SwitchBot API, SwitchBot hardware, or Stream Deck software itself are outside the scope of this project and should be reported to those respective vendors, not here.
