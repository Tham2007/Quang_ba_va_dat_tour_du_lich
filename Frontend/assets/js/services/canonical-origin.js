/**
 * Keep An's original UI intact, but serve real API calls from the same origin.
 *
 * The existing Render static-site hostname has no /api/v1 backend. Redirect
 * navigation to the FastAPI-hosted copy of the very same Frontend directory.
 * No credentials or customer data are inserted into this URL.
 */
(() => {
  "use strict";
  if (window.location.hostname !== "delta-travel-group6-kthp-demo.onrender.com") return;
  const target = new URL(window.location.href);
  target.hostname = "delta-travel-group6-real-api-staging.onrender.com";
  target.protocol = "https:";
  target.port = "";
  window.location.replace(target.href);
})();
