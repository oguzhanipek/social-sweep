# Social Sweep

Privacy-first, open-source Instagram follow manager. Analyze your own Instagram data export locally in your browser.

## Features

- Import an Instagram data export ZIP
- Review pending follow requests
- Find accounts you follow that do not follow you back
- Review mutual follows and followers-only accounts
- Search lists and export CSV
- Keep manual action checkmarks in this browser

## Privacy & safety

Your ZIP is processed locally in your browser. Social Sweep does not ask for your Instagram password, does not connect to Instagram, and does not perform automated follow/unfollow actions. Open each profile on Instagram and make changes manually. Instagram's own limits and terms apply.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
```

## Export format

In Instagram Accounts Center, request a download of **Followers and following** data in JSON format. Upload the ZIP file here; do not extract it first.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

Social Sweep is an independent community project and is not affiliated with, endorsed by, or sponsored by Instagram or Meta.