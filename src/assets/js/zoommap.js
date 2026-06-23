/* Renders `.zoommap` blocks (emitted by scripts/sync-vault.mjs) as interactive
   Leaflet maps: a base image with clickable pins linking to location pages and
   the drawn connection lines. Pin/line coordinates are normalized (0–1) from
   the top-left of the image, matching the zoom-map plugin's markers.json. */
(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildMap(el) {
    var dataEl = el.querySelector('script[type="application/json"]');
    if (!dataEl) return;
    var d;
    try {
      d = JSON.parse(dataEl.textContent);
    } catch (e) {
      return;
    }

    function init(w, h) {
      // CRS.Simple zoom levels are powers of two over raw image pixels, so the
      // "fit the whole image" zoom is computed (often negative/fractional) — the
      // markers.json min/max values are the plugin's own scale, not Leaflet levels.
      var map = L.map(el, {
        crs: L.CRS.Simple,
        attributionControl: false,
        zoomSnap: 0,
        // Start wide open so fitBounds isn't clamped by the default minZoom (0)
        // before we know the actual fit zoom for this image.
        minZoom: -100,
      });
      var bounds = [
        [0, 0],
        [h, w],
      ];
      L.imageOverlay(d.image, bounds).addTo(map);
      map.fitBounds(bounds);
      var fitZoom = map.getZoom();
      map.setMinZoom(fitZoom); // fully zoomed out = whole image
      map.setMaxZoom(fitZoom + 5); // allow zooming in to pixel detail
      map.setMaxBounds(bounds);

      // Normalized (x, y from top-left) → Leaflet CRS.Simple latlng.
      function toLatLng(x, y) {
        return [(1 - y) * h, x * w];
      }

      (d.lines || []).forEach(function (line) {
        var pts = (line.points || []).map(function (p) {
          return toLatLng(p.x, p.y);
        });
        if (pts.length > 1) {
          L.polyline(pts, {
            color: line.color || "#ff0000",
            weight: line.width || 2,
          }).addTo(map);
        }
      });

      (d.markers || []).forEach(function (m) {
        var marker = L.marker(toLatLng(m.x, m.y), {
          title: m.tooltip || m.label || "",
        }).addTo(map);
        var label = m.label || "Location";
        if (m.url) {
          marker.bindPopup(
            '<a href="' + m.url + '">' + escapeHtml(label) + "</a>",
          );
        } else if (label) {
          marker.bindPopup(escapeHtml(label));
        }
      });
    }

    if (d.w && d.h) {
      init(d.w, d.h);
    } else {
      // No size in markers.json — fall back to the image's natural dimensions.
      var img = new Image();
      img.onload = function () {
        init(img.naturalWidth, img.naturalHeight);
      };
      img.src = d.image;
    }
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    if (typeof L === "undefined") return;
    document.querySelectorAll(".zoommap").forEach(buildMap);
  });
})();
