# Security and Privacy Notes

This English project copy is intended for capstone review and technical discussion. It does not include the original repository history, production databases, uploaded documents, customer records, building source files, API keys, or local environment files.

## Included data policy

- Use only synthetic or explicitly sanitized fixtures in this copy.
- Never commit `.env`, `.env.local`, SQLite databases, uploaded source documents, OCR artifacts, or generated reports that contain personal or business contact information.
- Keep real Welcome Letters and their extracted evidence in an approved private environment.
- Treat extracted building facts as candidates until a permitted reviewer promotes them through Staging into Master.

## Credential policy

- Configure all credentials through a local `.env.local` file that remains untracked.
- Replace every example password before exposing the service beyond localhost.
- Do not place API keys, browser-agent credentials, customer identifiers, contracts, or payment information in prompts, screenshots, logs, or test fixtures.

## External actions

The current prototype does not send WeChat messages, submit carrier orders, sign contracts, or make payments. Any future browser-agent extension must stop before a consequential action and require explicit human approval.

## Sharing checklist

Before redistributing a derived package:

1. Scan tracked files for credentials and personal information.
2. Confirm that runtime data, uploads, source documents, and local logs are excluded.
3. Build and test from a clean environment.
4. Reconfirm that all externally visible actions remain human-approved.
