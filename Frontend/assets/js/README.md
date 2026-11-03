# Delta Travel frontend: MVC-inspired source layout

The UI remains vanilla JavaScript (no bundler) with globals loaded in fixed order by `Frontend/index.html` and `Frontend/admin.html`.

- `models/data.js`: demonstration tour data and local-only sample stores.
- `controllers/{main,admin,auth,chatbot}.js`: DOM event handling, rendering and UI orchestration.
- `services/api.js`: calls the FastAPI backend.
- `services/live-api-bridge.js`: **separate staging-only API-connected panel** for the existing An UI.

**Important:** This is a source-layout refactor; it does **not** turn the original localStorage-based booking/login/payment interface into real transactions. Staging still has a separate API-backed panel. The original `assets/js/live-api-bridge.js` is temporarily retained as a compatibility asset for deployed Render smoke probes; don't load both in HTML. A subsequent coordinated deployment can remove the alias after updating external health probes.

Script file order and global names are unchanged. Tests enforce that the demo cannot report a fake payment success.
