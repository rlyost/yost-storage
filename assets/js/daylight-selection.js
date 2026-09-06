var HandlerPathDaylight = (function () {
  // Sunset -> sunrise keeps the original logo; daylight shows Handler Path.
  var NIGHT = { mode: "night", src: "gitlabrador-512.webp", srcset: "gitlabrador-512.webp 512w, gitlabrador-784.webp 784w", w: 784, h: 1168, alt: "Dog logo" };
  var DAY = { mode: "day", src: "HandlerPath_Gators-512.webp", srcset: "HandlerPath_Gators-512.webp 512w, HandlerPath_Gators-1024.webp 1024w", w: 1254, h: 1254, alt: "Handler Path logo" };

  // Viewer's coordinates, inferred from their time zone. Set both to fixed
  // numbers instead to pin the whole site to one location's sun.
  var LAT = null;
  var LON = null;

  // Rough latitude per time zone: exact hits first, then continent.
  var ZONE_LAT = {
    "America/Sao_Paulo": -23.5, "America/Argentina": -34.6, "America/Santiago": -33.5,
    "America/Montevideo": -34.9, "America/Asuncion": -25.3, "America/La_Paz": -16.5,
    "America/Lima": -12, "America/Bogota": 4.6, "America/Anchorage": 61.2
  };
  var REGION_LAT = {
    America: 38, Europe: 50, Asia: 30, Africa: 5, Australia: -30,
    Pacific: -20, Atlantic: 30, Indian: -15, Antarctica: -70
  };

  function latitude() {
    if (LAT !== null) return LAT;
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    for (var zone in ZONE_LAT) {
      if (tz.indexOf(zone) === 0) return ZONE_LAT[zone];
    }
    return REGION_LAT[tz.split("/")[0]] || 40;
  }

  function longitude() {
    if (LON !== null) return LON;
    // Standard-time offset (DST excluded) is the better longitude proxy.
    var y = new Date().getFullYear();
    var std = Math.max(
      new Date(y, 0, 1).getTimezoneOffset(),
      new Date(y, 6, 1).getTimezoneOffset()
    );
    return -std / 4; // minutes east of UTC -> degrees
  }

  // Sun's altitude in degrees (NOAA/SunCalc low-precision formulas).
  function altitude(date, lat, lon) {
    var rad = Math.PI / 180;
    var d = date.getTime() / 86400000 - 10957.5;      // days since J2000.0
    var M = rad * (357.5291 + 0.98560028 * d);        // mean anomaly
    var C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    var L = M + C + rad * 102.9372 + Math.PI;         // ecliptic longitude
    var e = rad * 23.4397;                            // obliquity
    var dec = Math.asin(Math.sin(e) * Math.sin(L));
    var ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
    var H = rad * (280.16 + 360.9856235 * d + lon) - ra;
    var p = rad * lat;
    return Math.asin(Math.sin(p) * Math.sin(dec) + Math.cos(p) * Math.cos(dec) * Math.cos(H)) / rad;
  }

  function current() {
    return altitude(new Date(), latitude(), longitude()) > -0.833 ? DAY : NIGHT;
  }

  // Select early in the head so only the image needed for this visit is preloaded.
  var selected = current();
  var preload = document.createElement("link");
  preload.rel = "preload";
  preload.as = "image";
  preload.href = selected.src;
  preload.imageSrcset = selected.srcset;
  preload.imageSizes = "min(70vw, 32rem)";
  preload.setAttribute("fetchpriority", "high");
  document.head.append(preload);
  return Object.freeze({ current: current });
})();
