# Social Sweep Instagram Helper (Chrome)

This helper only inspects the currently open Instagram profile after the user clicks the extension icon. It does not click Instagram controls, send requests, cancel requests, or read passwords/cookies.

## Install locally

1. Pull the latest Social Sweep repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository's `chrome-extension` folder.
6. Open an Instagram profile while signed in.
7. Click the Social Sweep helper extension icon.

The helper highlights a uniquely detected pending-request button (English or Turkish labels) and reports whether it found one. If it cannot identify the state unambiguously, it does nothing.

## Safety

You must verify the profile and cancel the request yourself in Instagram. Confirm the button returns to **Follow** before marking that account complete in Social Sweep. Stop if Instagram shows a warning, challenge, or action restriction.
