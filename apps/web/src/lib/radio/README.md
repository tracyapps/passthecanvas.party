# Party radio

Phase 2 task. Plan:

- Search stations through the [Radio Browser API](https://api.radio-browser.info) (pick a server from its DNS list, search by tag or name, https streams only).
- The host picks a station → `setRadio` message → every client plays the `streamUrl` in its own `<audio>` element.
- **Never relay audio through our servers** (licensing). We only sync which station is on and whether it's playing.
- Each guest has their own volume and mute. Default volume is low. Radio never autoplays before a user gesture.
- UI skin: the tube radio from the design canvas.
