# THE CONVENT — landscape co-op horror prototype

## Files
- `index.html` — lobby, HUD, overlays and game canvas
- `style.css` — landscape-first responsive horror UI
- `game.js` — Three.js gameplay, character roles, item objectives, Nun AI and PeerJS co-op
- `assets/` — crops from your supplied concept sheet used in the lobby/character selection

## Run locally
Use a local static server (for example VS Code Live Server) and open `index.html`.
Opening the file directly may block some browser features.

## Deploy to GitHub + Netlify
1. Upload the contents of this folder to the root of your GitHub repository.
2. In Netlify, import that repository.
3. Build command: leave blank.
4. Publish directory: `.` (repository root).
5. Deploy.

## Important multiplayer note
PeerJS uses a public signaling service in this prototype. Both players need a working internet connection. For production multiplayer, use a managed signaling/relay setup and authoritative server-side game state.

## Controls
- PC: WASD / arrow keys to move, mouse drag to look, Shift to run, C to crouch, E to interact, 1–4 inventory slots.
- Phone/tablet: landscape orientation, left joystick to move, right side drag to look, action buttons on the right.
