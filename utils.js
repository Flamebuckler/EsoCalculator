// Utility helpers for the app
// registerTooltip: centralizes registration with the site's tooltip system.
// Exposed as a global function so legacy inline scripts can use it.
(function () {
  var esoTooltipBulkRegistered = false;

  function registerTooltip(el) {
    if (!el) return;
    try {
      if (window.addEsoHubToolTip) {
        window.addEsoHubToolTip(el);
        return;
      }
      if (window.addEsoHubToolTipsToAll && !esoTooltipBulkRegistered) {
        window.addEsoHubToolTipsToAll();
        esoTooltipBulkRegistered = true;
      }
    } catch (e) {
      // ignore third-party errors
    }
  }

  // expose globally
  window.registerTooltip = registerTooltip;
})();
