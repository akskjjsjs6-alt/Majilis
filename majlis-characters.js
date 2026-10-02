/*!
 * Majlis Characters
 * A big library of flat, friendly SVG characters in the Majlis look.
 *
 * Works in the browser (<script src="majlis-characters.js">) and in Node (require / import).
 * No dependencies. Everything is drawn as plain SVG text.
 *
 * Quick start (browser):
 *   <div id="spot"></div>
 *   <script src="majlis-characters.js"></script>
 *   <script>
 *     MajlisCharacters.mount('#spot', 'debater');                 // a ready-made character
 *     MajlisCharacters.mount('#spot', 'bookworm-3', { size: 200 }); // a variant, 200px tall
 *     MajlisCharacters.mount('#spot', MajlisCharacters.random('any text'));   // a random person
 *     MajlisCharacters.mount('#spot', { pose: 'wave', expression: 'grinning', hair: 'afro' }); // build your own
 *   </script>
 *
 * Main functions:
 *   list()                      -> every ready-made character: [{ id, name, role, tags, description }]
 *   get(id)                     -> the settings (a "spec") for one character
 *   svg(idOrSpec, options)      -> an SVG string
 *   mount(target, idOrSpec, o)  -> puts the SVG into a page element
 *   random(seed, overrides)     -> a random person spec (same seed = same person)
 *   crowd(count, seed)          -> an array of random specs
 *   scene(nameOrFigures, o)     -> several characters side by side as one SVG
 *   classic(name)               -> the 8 original hand-drawn Majlis stickers
 *   toPNG(idOrSpec, options)    -> (browser) Promise<Blob> of a PNG
 *   download(idOrSpec, file, o) -> (browser) saves a PNG or SVG file
 *
 * svg() options:
 *   size      height in px (default: natural size)
 *   sticker   true (default) adds the cream die-cut edge + soft shadow; false for a clean cut-out
 *   flip      true mirrors the character so they face the other way
 *   title     accessible label (defaults to the character's name)
 */
(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) { module.exports = lib; module.exports.default = lib; }
  if (root) root.MajlisCharacters = lib;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ colours */
  var COLORS = {
    neon: '#00FF66', cream: '#F2EFE6', ink: '#0B0F0C', deep: '#145C36', moss: '#239F5C', mint: '#18C45A',
    charcoal: '#1E2622', steel: '#3A4540', slate: '#2B3A33', white: '#FAFAF7', paper: '#FFFFFF',
    navy: '#243B55', denim: '#3D5A80', sky: '#6FA8DC', teal: '#2A7F7F', maroon: '#6E2A35', coral: '#E0715A',
    rose: '#D98C9A', lilac: '#9C8AC7', mustard: '#C9A227', gold: '#E0B43C', khaki: '#9A8C6A', sand: '#D9C9A3',
    wood: '#8A5A34', red: '#FF4D5E', robot: '#DDE3DD', robot2: '#C9D1CA'
  };
  var SKIN = { porcelain: '#FBE0CB', light: '#F2C9A6', tan: '#D39A6E', golden: '#C0844F', brown: '#A0663F', umber: '#8C5533', deep: '#6B4028' };
  var HAIR_COLORS = { black: '#17110D', darkbrown: '#3B2415', brown: '#5A3A22', auburn: '#7A3B1C', ginger: '#B5541F', blonde: '#D8B25A', grey: '#9B9B94', white: '#E8E6DF', neon: '#00FF66' };

  // colour groups the random generator picks from
  var BRAND_TOPS = ['deep', 'moss', 'neon', 'cream', 'charcoal', 'slate', 'white', 'mint'];
  var EXTRA_TOPS = ['navy', 'denim', 'sky', 'teal', 'maroon', 'coral', 'rose', 'lilac', 'mustard', 'khaki', 'sand'];
  var BOTTOMS = ['charcoal', 'steel', 'ink', 'navy', 'denim', 'khaki', 'slate', 'deep'];

  function skinCol(c) { return SKIN[c] || col(c); }
  function col(c) { return (c && (COLORS[c] || SKIN[c] || HAIR_COLORS[c])) || c; }
  function shade(hex, amt) {
    hex = col(hex);
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  function lum(hex) {
    hex = col(hex);
    var n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ------------------------------------------------------------------ drawing primitives */
  var INK = COLORS.ink;
  function n(v) { return Math.round(v * 10) / 10; }
  function P(d, fill, stroke, w, extra) {
    var s = stroke ? ' stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' : '';
    return '<path d="' + d + '" fill="' + (fill || 'none') + '"' + s + (extra || '') + '/>';
  }
  function L(pts, color, w) { return P('M ' + pts.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).join(' L '), 'none', color, w); }
  function Ci(cx, cy, r, fill, extra) { return '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + r + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function R(x, y, w, h, rx, fill, extra) { return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '" rx="' + rx + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function E(cx, cy, rx, ry, fill, extra) { return '<ellipse cx="' + n(cx) + '" cy="' + n(cy) + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' + (extra || '') + '/>'; }

  function Drawing() {
    var d = { out: [], texts: [], x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    d.box = function (x0, y0, x1, y1) { d.x0 = Math.min(d.x0, x0); d.y0 = Math.min(d.y0, y0); d.x1 = Math.max(d.x1, x1); d.y1 = Math.max(d.y1, y1); };
    d.add = function (s, box) { d.out.push(s); if (box) d.box(box[0], box[1], box[2], box[3]); };
    d.pts = function (pts, pad) { pts.forEach(function (p) { d.box(p[0] - pad, p[1] - pad, p[0] + pad, p[1] + pad); }); };
    d.text = function (t) { d.texts.push(t); };
    return d;
  }
  function textSvg(t, dx, flipW) {
    var x = flipW != null ? flipW - t.x : t.x;
    return '<text x="' + n(x + (dx || 0)) + '" y="' + n(t.y) + '" text-anchor="middle" font-family="' + (t.font || "Poppins, 'Helvetica Neue', Arial, sans-serif") +
      '" font-weight="' + (t.weight || 700) + '" font-size="' + t.size + '" fill="' + t.fill + '"' + (t.spacing ? ' letter-spacing="' + t.spacing + '"' : '') + '>' + esc(t.s) + '</text>';
  }

  /* ------------------------------------------------------------------ faces */
  var EXPRESSIONS = {
    happy: { eyes: 'dot', mouth: 'smile' },
    content: { eyes: 'closed', mouth: 'smile', blush: true },
    grinning: { eyes: 'dot', mouth: 'grin' },
    laughing: { eyes: 'closed', mouth: 'grin', blush: true },
    talking: { eyes: 'dot', mouth: 'open' },
    shouting: { eyes: 'dot', mouth: 'open', brows: 'angry' },
    neutral: { eyes: 'dot', mouth: 'flat' },
    focused: { eyes: 'dot', mouth: 'flat', brows: 'flat' },
    thinking: { eyes: 'up', mouth: 'flat', brows: 'raised' },
    skeptical: { eyes: 'half', mouth: 'flat', brows: 'raised' },
    smug: { eyes: 'half', mouth: 'smirk' },
    wink: { eyes: 'wink', mouth: 'smirk' },
    surprised: { eyes: 'wide', mouth: 'o', brows: 'up' },
    shocked: { eyes: 'wide', mouth: 'open', brows: 'up' },
    confused: { eyes: 'dot', mouth: 'wavy', brows: 'raised' },
    sad: { eyes: 'dot', mouth: 'frown', brows: 'sad' },
    angry: { eyes: 'dot', mouth: 'frown', brows: 'angry' },
    sleepy: { eyes: 'half', mouth: 'o' },
    nervous: { eyes: 'dot', mouth: 'wavy', brows: 'sad' },
    reading: { eyes: 'down', mouth: 'smile' },
    scrolling: { eyes: 'down', mouth: 'flat' },
    determined: { eyes: 'dot', mouth: 'smirk', brows: 'angry' },
    proud: { eyes: 'closed', mouth: 'smirk', blush: true },
    amazed: { eyes: 'wide', mouth: 'grin', brows: 'up' }
  };

  function face(d, cx, cy, look, ex) {
    if (typeof ex === 'string') ex = EXPRESSIONS[ex] || EXPRESSIONS.happy;
    var x = cx + 6 * look, ly = cy - 3, lx = x - 8, rx = x + 8, s = '';
    var eye = function (kind, ex0, isRight) {
      switch (kind) {
        case 'closed': return P('M ' + (ex0 - 4.5) + ',' + (ly + 1.5) + ' q 4.5,-5.5 9,0', 'none', INK, 3);
        case 'half': return P('M ' + (ex0 - 4.5) + ',' + ly + ' h 9', 'none', INK, 3.4) + Ci(ex0, ly + 2, 2.2, INK);
        case 'wide': return Ci(ex0, ly, 6, COLORS.paper) + Ci(ex0 + look, ly, 3.2, INK);
        case 'up': return Ci(ex0 + look, ly - 3, 3.4, INK);
        case 'down': return Ci(ex0 + look * 1.5, ly + 2.5, 3.2, INK);
        case 'wink': return isRight ? P('M ' + (ex0 - 4.5) + ',' + (ly + 1.5) + ' q 4.5,-5.5 9,0', 'none', INK, 3) : Ci(ex0, ly, 3.4, INK);
        default: return Ci(ex0, ly, 3.4, INK);
      }
    };
    s += eye(ex.eyes, lx, false) + eye(ex.eyes, rx, true);
    var by = cy - 13;
    switch (ex.brows) {
      case 'angry': s += P('M ' + (lx - 5) + ',' + (by - 3) + ' L ' + (lx + 4) + ',' + (by + 1) + ' M ' + (rx - 4) + ',' + (by + 1) + ' L ' + (rx + 5) + ',' + (by - 3), 'none', INK, 3); break;
      case 'sad': s += P('M ' + (lx - 5) + ',' + (by + 1) + ' L ' + (lx + 4) + ',' + (by - 3) + ' M ' + (rx - 4) + ',' + (by - 3) + ' L ' + (rx + 5) + ',' + (by + 1), 'none', INK, 3); break;
      case 'up': s += P('M ' + (lx - 5) + ',' + (by - 2) + ' q 5,-5 10,0 M ' + (rx - 5) + ',' + (by - 2) + ' q 5,-5 10,0', 'none', INK, 3); break;
      case 'raised': s += P('M ' + (lx - 5) + ',' + by + ' h 9 M ' + (rx - 5) + ',' + (by - 2) + ' q 5,-6 10,0', 'none', INK, 3); break;
      case 'flat': s += P('M ' + (lx - 5) + ',' + by + ' h 9 M ' + (rx - 4) + ',' + by + ' h 9', 'none', INK, 3); break;
    }
    var mx = x + 1, my = cy + 12;
    switch (ex.mouth) {
      case 'open': s += E(mx, my + 1, 6.5, 7.5, INK) + E(mx, my + 5, 3.8, 2.6, COLORS.coral); break;
      case 'flat': s += P('M ' + (mx - 5) + ',' + my + ' h 10', 'none', INK, 3); break;
      case 'o': s += Ci(mx, my + 1, 3.8, INK); break;
      case 'grin': s += P('M ' + (mx - 9) + ',' + (my - 3) + ' h 18 q 0,11 -9,11 q -9,0 -9,-11 Z', INK) + R(mx - 7, my - 3, 14, 3.2, 1, COLORS.paper); break;
      case 'frown': s += P('M ' + (mx - 6) + ',' + (my + 4) + ' q 6,-6 12,0', 'none', INK, 3); break;
      case 'smirk': s += P('M ' + (mx - 6) + ',' + (my + 1) + ' q 7,3 12,-4', 'none', INK, 3); break;
      case 'wavy': s += P('M ' + (mx - 7) + ',' + (my + 1) + ' q 3.5,-4 7,0 t 7,0', 'none', INK, 3); break;
      default: s += P('M ' + (mx - 6) + ',' + (my - 1) + ' q 6,6 12,0', 'none', INK, 3);
    }
    if (ex.blush) s += Ci(lx - 6, cy + 7, 5, COLORS.coral, ' opacity="0.35"') + Ci(rx + 6, cy + 7, 5, COLORS.coral, ' opacity="0.35"');
    d.add(s);
  }

  /* ------------------------------------------------------------------ hair + headwear */
  var HAIR_STYLES = ['short', 'curly', 'long', 'bun', 'hijab', 'bald', 'buzz', 'afro', 'ponytail', 'spiky', 'bob', 'braids', 'wavy', 'sidepart', 'locs', 'pixie'];
  // which layer the back part of the hair goes on: 'pre' = behind the body, 'post' = over the shoulders
  function hairBack(d, style, cx, cy, hc, layer) {
    var pre = layer === 'pre';
    switch (style) {
      case 'long': if (pre) d.add(R(cx - 40, cy - 8, 22, 62, 11, hc) + R(cx + 18, cy - 8, 22, 62, 11, hc), [cx - 42, cy - 40, cx + 42, cy + 56]); break;
      case 'wavy': if (pre) d.add(P('M ' + (cx - 36) + ',' + (cy - 10) + ' q -10,16 0,30 q -10,16 2,32 L ' + (cx - 16) + ',' + (cy + 52) + ' L ' + (cx - 16) + ',' + (cy - 10) + ' Z', hc) + P('M ' + (cx + 36) + ',' + (cy - 10) + ' q 10,16 0,30 q 10,16 -2,32 L ' + (cx + 16) + ',' + (cy + 52) + ' L ' + (cx + 16) + ',' + (cy - 10) + ' Z', hc), [cx - 48, cy - 40, cx + 48, cy + 56]); break;
      case 'afro': if (pre) d.add(Ci(cx, cy - 12, 46, hc), [cx - 48, cy - 60, cx + 48, cy + 30]); break;
      case 'ponytail': if (pre) d.add(P('M ' + (cx + 22) + ',' + (cy - 26) + ' Q ' + (cx + 58) + ',' + (cy - 30) + ' ' + (cx + 50) + ',' + (cy + 14) + ' Q ' + (cx + 46) + ',' + (cy + 36) + ' ' + (cx + 36) + ',' + (cy + 44) + ' Q ' + (cx + 42) + ',' + (cy + 8) + ' ' + (cx + 22) + ',' + (cy - 10) + ' Z', hc), [cx - 34, cy - 40, cx + 60, cy + 46]); break;
      case 'bob': if (pre) d.add(R(cx - 38, cy - 36, 76, 64, 30, hc), [cx - 40, cy - 40, cx + 40, cy + 30]); break;
      case 'locs': if (pre) { var s = ''; [-34, -24, 24, 34].forEach(function (dx) { s += R(cx + dx - 6, cy - 12, 12, 64 - Math.abs(dx) * 0.4, 6, hc); }); d.add(s, [cx - 42, cy - 40, cx + 42, cy + 56]); } break;
      case 'hijab': if (!pre) d.add(P('M ' + (cx - 40) + ',' + (cy + 2) + ' Q ' + (cx - 44) + ',' + (cy - 44) + ' ' + cx + ',' + (cy - 44) + ' Q ' + (cx + 44) + ',' + (cy - 44) + ' ' + (cx + 40) + ',' + (cy + 2) + ' Q ' + (cx + 44) + ',' + (cy + 44) + ' ' + (cx + 18) + ',' + (cy + 58) + ' L ' + (cx - 18) + ',' + (cy + 58) + ' Q ' + (cx - 44) + ',' + (cy + 44) + ' ' + (cx - 40) + ',' + (cy + 2) + ' Z', hc), [cx - 46, cy - 46, cx + 46, cy + 60]); break;
      case 'braids':
        if (!pre) {
          var b = '';
          [-33, 33].forEach(function (dx) { for (var i = 0; i < 5; i++) b += Ci(cx + dx, cy + 2 + i * 13, 8 - i * 0.6, hc); b += Ci(cx + dx, cy + 68, 4, COLORS.neon); });
          d.add(b, [cx - 42, cy - 40, cx + 42, cy + 74]);
        }
        break;
    }
  }
  function hairFront(d, style, cx, cy, hc) {
    var s = '';
    switch (style) {
      case 'short': s = P('M ' + (cx - 31) + ',' + (cy - 2) + ' Q ' + (cx - 34) + ',' + (cy - 38) + ' ' + cx + ',' + (cy - 37) + ' Q ' + (cx + 30) + ',' + (cy - 38) + ' ' + (cx + 32) + ',' + (cy - 8) + ' Q ' + (cx + 14) + ',' + (cy - 22) + ' ' + (cx - 6) + ',' + (cy - 18) + ' Q ' + (cx - 20) + ',' + (cy - 14) + ' ' + (cx - 31) + ',' + (cy - 2) + ' Z', hc); break;
      case 'curly': [[-24, -14], [-14, -28], [2, -33], [18, -28], [27, -14], [-29, 2], [29, 0]].forEach(function (p) { s += Ci(cx + p[0], cy + p[1], 12, hc); }); break;
      case 'long': case 'wavy': case 'braids': case 'locs':
        s = P('M ' + (cx - 31) + ',' + (cy + 2) + ' Q ' + (cx - 30) + ',' + (cy - 38) + ' ' + (cx + 2) + ',' + (cy - 37) + ' Q ' + (cx + 33) + ',' + (cy - 36) + ' ' + (cx + 31) + ',' + (cy + 2) + ' Q ' + (cx + 22) + ',' + (cy - 20) + ' ' + (cx + 2) + ',' + (cy - 22) + ' Q ' + (cx - 18) + ',' + (cy - 20) + ' ' + (cx - 31) + ',' + (cy + 2) + ' Z', hc);
        if (style === 'locs') [-18, -6, 6, 18].forEach(function (dx) { s += R(cx + dx - 5, cy - 38, 10, 20, 5, hc); });
        break;
      case 'bun': s = Ci(cx - 4, cy - 38, 13, hc) + P('M ' + (cx - 31) + ',' + (cy - 2) + ' Q ' + (cx - 32) + ',' + (cy - 36) + ' ' + cx + ',' + (cy - 35) + ' Q ' + (cx + 31) + ',' + (cy - 35) + ' ' + (cx + 31) + ',' + (cy - 4) + ' Q ' + (cx + 10) + ',' + (cy - 20) + ' ' + (cx - 31) + ',' + (cy - 2) + ' Z', hc); break;
      case 'hijab': s = P('M ' + (cx - 32) + ',' + (cy - 2) + ' Q ' + (cx - 30) + ',' + (cy - 36) + ' ' + cx + ',' + (cy - 36) + ' Q ' + (cx + 30) + ',' + (cy - 36) + ' ' + (cx + 32) + ',' + (cy - 2) + ' Q ' + (cx + 18) + ',' + (cy - 24) + ' ' + cx + ',' + (cy - 24) + ' Q ' + (cx - 18) + ',' + (cy - 24) + ' ' + (cx - 32) + ',' + (cy - 2) + ' Z', hc); break;
      case 'buzz': s = P('M ' + (cx - 30) + ',' + (cy - 6) + ' Q ' + (cx - 30) + ',' + (cy - 32) + ' ' + cx + ',' + (cy - 32) + ' Q ' + (cx + 30) + ',' + (cy - 32) + ' ' + (cx + 30) + ',' + (cy - 6) + ' Q ' + cx + ',' + (cy - 22) + ' ' + (cx - 30) + ',' + (cy - 6) + ' Z', hc, null, 0, ' opacity="0.85"'); break;
      case 'afro': s = P('M ' + (cx - 30) + ',' + (cy - 4) + ' Q ' + cx + ',' + (cy - 26) + ' ' + (cx + 30) + ',' + (cy - 4) + ' L ' + (cx + 30) + ',' + (cy - 20) + ' L ' + (cx - 30) + ',' + (cy - 20) + ' Z', hc); break;
      case 'ponytail': s = P('M ' + (cx - 31) + ',' + (cy - 2) + ' Q ' + (cx - 32) + ',' + (cy - 36) + ' ' + cx + ',' + (cy - 35) + ' Q ' + (cx + 31) + ',' + (cy - 35) + ' ' + (cx + 31) + ',' + (cy - 6) + ' Q ' + (cx + 6) + ',' + (cy - 16) + ' ' + (cx - 31) + ',' + (cy - 2) + ' Z', hc) + R(cx + 24, cy - 26, 10, 14, 4, COLORS.neon); break;
      case 'spiky': s = P('M ' + (cx - 31) + ',' + (cy - 4) + ' L ' + (cx - 30) + ',' + (cy - 26) + ' L ' + (cx - 22) + ',' + (cy - 46) + ' L ' + (cx - 12) + ',' + (cy - 32) + ' L ' + (cx - 2) + ',' + (cy - 50) + ' L ' + (cx + 6) + ',' + (cy - 33) + ' L ' + (cx + 18) + ',' + (cy - 46) + ' L ' + (cx + 22) + ',' + (cy - 28) + ' L ' + (cx + 34) + ',' + (cy - 34) + ' L ' + (cx + 31) + ',' + (cy - 6) + ' Q ' + (cx + 10) + ',' + (cy - 20) + ' ' + (cx - 31) + ',' + (cy - 4) + ' Z', hc); break;
      case 'bob': s = P('M ' + (cx - 31) + ',' + (cy - 2) + ' Q ' + (cx - 32) + ',' + (cy - 38) + ' ' + cx + ',' + (cy - 37) + ' Q ' + (cx + 32) + ',' + (cy - 38) + ' ' + (cx + 31) + ',' + (cy - 2) + ' L ' + (cx + 31) + ',' + (cy - 12) + ' Q ' + cx + ',' + (cy - 17) + ' ' + (cx - 31) + ',' + (cy - 12) + ' Z', hc); break;
      case 'sidepart': s = P('M ' + (cx - 31) + ',' + (cy) + ' Q ' + (cx - 34) + ',' + (cy - 38) + ' ' + (cx - 4) + ',' + (cy - 38) + ' Q ' + (cx + 34) + ',' + (cy - 38) + ' ' + (cx + 32) + ',' + (cy - 4) + ' Q ' + (cx + 26) + ',' + (cy - 20) + ' ' + (cx + 14) + ',' + (cy - 24) + ' Q ' + (cx - 20) + ',' + (cy - 30) + ' ' + (cx - 31) + ',' + cy + ' Z', hc) + P('M ' + (cx - 8) + ',' + (cy - 36) + ' Q ' + (cx - 14) + ',' + (cy - 28) + ' ' + (cx - 24) + ',' + (cy - 20), 'none', shade(hc, 0.25), 2.5); break;
      case 'pixie': s = P('M ' + (cx - 31) + ',' + (cy - 4) + ' Q ' + (cx - 32) + ',' + (cy - 38) + ' ' + (cx + 2) + ',' + (cy - 36) + ' Q ' + (cx + 32) + ',' + (cy - 34) + ' ' + (cx + 31) + ',' + (cy - 4) + ' Q ' + (cx + 24) + ',' + (cy - 14) + ' ' + (cx + 20) + ',' + (cy - 10) + ' Q ' + (cx + 6) + ',' + (cy - 22) + ' ' + (cx - 14) + ',' + (cy - 12) + ' Q ' + (cx - 26) + ',' + (cy - 14) + ' ' + (cx - 31) + ',' + (cy - 4) + ' Z', hc); break;
    }
    if (s) d.add(s, [cx - 36, cy - 52, cx + 36, cy]);
  }

  var HEADWEAR = ['cap', 'beanie', 'kufi', 'headphones', 'crown', 'grad', 'headband', 'beret', 'visor'];
  var FACEWEAR = ['glasses', 'roundglasses', 'sunglasses', 'beard', 'stubble', 'mustache', 'earrings', 'freckles'];
  var BODYWEAR = ['tie', 'bowtie', 'scarf', 'lanyard', 'pin', 'backpack', 'medal', 'watch'];

  function headwear(d, kind, cx, cy, look, color) {
    var c = col(color) || COLORS.deep, s = '';
    switch (kind) {
      case 'cap':
        s = P('M ' + (cx - 32) + ',' + (cy - 8) + ' Q ' + (cx - 32) + ',' + (cy - 42) + ' ' + cx + ',' + (cy - 42) + ' Q ' + (cx + 32) + ',' + (cy - 42) + ' ' + (cx + 32) + ',' + (cy - 8) + ' Z', c) +
          E(cx + 22 * look, cy - 9, 28, 6.5, shade(c, -0.25)) + Ci(cx, cy - 42, 4, shade(c, -0.25)) +
          P('M ' + (cx - 8) + ',' + (cy - 20) + ' v -9 l 8,7 l 8,-7 v 9', 'none', lum(c) > 0.6 ? COLORS.deep : COLORS.neon, 3.2);
        break;
      case 'beanie':
        s = P('M ' + (cx - 32) + ',' + (cy - 10) + ' Q ' + (cx - 32) + ',' + (cy - 46) + ' ' + cx + ',' + (cy - 46) + ' Q ' + (cx + 32) + ',' + (cy - 46) + ' ' + (cx + 32) + ',' + (cy - 10) + ' Z', c) +
          R(cx - 34, cy - 20, 68, 14, 7, shade(c, -0.2)) + Ci(cx, cy - 50, 9, shade(c, 0.35));
        break;
      case 'kufi':
        s = P('M ' + (cx - 29) + ',' + (cy - 14) + ' Q ' + (cx - 28) + ',' + (cy - 38) + ' ' + cx + ',' + (cy - 38) + ' Q ' + (cx + 28) + ',' + (cy - 38) + ' ' + (cx + 29) + ',' + (cy - 14) + ' Z', color ? c : COLORS.white) +
          P('M ' + (cx - 26) + ',' + (cy - 20) + ' Q ' + cx + ',' + (cy - 24) + ' ' + (cx + 26) + ',' + (cy - 20), 'none', COLORS.moss, 2.5);
        break;
      case 'headphones':
        s = P('M ' + (cx - 34) + ',' + (cy - 4) + ' Q ' + (cx - 36) + ',' + (cy - 54) + ' ' + cx + ',' + (cy - 54) + ' Q ' + (cx + 36) + ',' + (cy - 54) + ' ' + (cx + 34) + ',' + (cy - 4), 'none', INK, 8) +
          R(cx - 42, cy - 12, 16, 28, 7, INK) + R(cx + 26, cy - 12, 16, 28, 7, INK) + R(cx + 30, cy - 6, 8, 16, 4, COLORS.neon);
        break;
      case 'crown':
        s = P('M ' + (cx - 26) + ',' + (cy - 30) + ' L ' + (cx - 28) + ',' + (cy - 58) + ' L ' + (cx - 13) + ',' + (cy - 44) + ' L ' + cx + ',' + (cy - 64) + ' L ' + (cx + 13) + ',' + (cy - 44) + ' L ' + (cx + 28) + ',' + (cy - 58) + ' L ' + (cx + 26) + ',' + (cy - 30) + ' Z', COLORS.gold) +
          Ci(cx, cy - 40, 4, COLORS.neon) + Ci(cx - 16, cy - 38, 3, COLORS.paper) + Ci(cx + 16, cy - 38, 3, COLORS.paper);
        break;
      case 'grad':
        s = P('M ' + (cx - 24) + ',' + (cy - 30) + ' L ' + (cx - 24) + ',' + (cy - 18) + ' Q ' + cx + ',' + (cy - 10) + ' ' + (cx + 24) + ',' + (cy - 18) + ' L ' + (cx + 24) + ',' + (cy - 30) + ' Z', INK) +
          P('M ' + (cx - 48) + ',' + (cy - 36) + ' L ' + cx + ',' + (cy - 52) + ' L ' + (cx + 48) + ',' + (cy - 36) + ' L ' + cx + ',' + (cy - 22) + ' Z', COLORS.charcoal) +
          P('M ' + cx + ',' + (cy - 38) + ' L ' + (cx + 34) + ',' + (cy - 34) + ' L ' + (cx + 36) + ',' + (cy - 8), 'none', COLORS.neon, 3) + Ci(cx + 36, cy - 6, 4, COLORS.neon);
        break;
      case 'headband':
        s = P('M ' + (cx - 30) + ',' + (cy - 14) + ' Q ' + cx + ',' + (cy - 30) + ' ' + (cx + 30) + ',' + (cy - 14), 'none', c === COLORS.deep ? COLORS.neon : c, 8);
        break;
      case 'beret':
        s = E(cx - 6 * look, cy - 30, 36, 13, c) + Ci(cx - 6 * look, cy - 44, 4, c);
        break;
      case 'visor':
        s = R(cx - 32, cy - 22, 64, 10, 5, c) + E(cx + 20 * look, cy - 12, 26, 6, shade(c, -0.2));
        break;
    }
    if (s) d.add(s, [cx - 50, cy - 68, cx + 50, cy]);
  }

  function facewear(d, kind, cx, cy, look, hc) {
    var x = cx + 6 * look, ly = cy - 3 + 4, s = '';
    switch (kind) {
      case 'glasses': s = R(x - 16, ly - 7, 15, 13, 4, 'none', ' stroke="' + INK + '" stroke-width="2.6"') + R(x + 1, ly - 7, 15, 13, 4, 'none', ' stroke="' + INK + '" stroke-width="2.6"') + P('M ' + (x - 1) + ',' + (ly - 2) + ' h 2', 'none', INK, 2.6); break;
      case 'roundglasses': s = Ci(x - 8, ly - 1, 8, 'none', ' stroke="' + INK + '" stroke-width="2.6"') + Ci(x + 8, ly - 1, 8, 'none', ' stroke="' + INK + '" stroke-width="2.6"'); break;
      case 'sunglasses': s = R(x - 17, ly - 7, 16, 12, 5, INK) + R(x + 1, ly - 7, 16, 12, 5, INK) + P('M ' + (x - 1) + ',' + (ly - 3) + ' h 2', 'none', INK, 3) + P('M ' + (x - 13) + ',' + (ly - 4) + ' l 4,0', 'none', COLORS.neon, 2); break;
      case 'beard': s = P('M ' + (cx - 30) + ',' + (cy + 4) + ' Q ' + (cx - 28) + ',' + (cy + 44) + ' ' + cx + ',' + (cy + 44) + ' Q ' + (cx + 28) + ',' + (cy + 44) + ' ' + (cx + 30) + ',' + (cy + 4) + ' Q ' + (cx + 24) + ',' + (cy + 20) + ' ' + (x + 12) + ',' + (cy + 20) + ' Q ' + (x + 12) + ',' + (cy + 32) + ' ' + (x + 1) + ',' + (cy + 32) + ' Q ' + (x - 10) + ',' + (cy + 32) + ' ' + (x - 10) + ',' + (cy + 20) + ' Q ' + (cx - 24) + ',' + (cy + 20) + ' ' + (cx - 30) + ',' + (cy + 4) + ' Z', hc); break;
      case 'stubble': s = P('M ' + (cx - 26) + ',' + (cy + 12) + ' Q ' + cx + ',' + (cy + 46) + ' ' + (cx + 26) + ',' + (cy + 12), 'none', hc, 7, ' opacity="0.28"'); break;
      case 'mustache': s = P('M ' + (x - 9) + ',' + (cy + 13) + ' q 5,-6 10,-1 q 5,-5 10,1 q -5,3 -10,0 q -5,3 -10,0 Z', hc); break;
      case 'earrings': s = Ci(cx - 30, cy + 12, 3.4, COLORS.gold) + Ci(cx + 30, cy + 12, 3.4, COLORS.gold); break;
      case 'freckles': [[-14, 8], [-10, 11], [-17, 12], [14, 8], [18, 11], [11, 12]].forEach(function (p) { s += Ci(x + p[0], cy + 4 + p[1], 1.3, COLORS.wood, ' opacity="0.7"'); }); break;
    }
    if (s) d.add(s);
  }

  /* ------------------------------------------------------------------ bodies */
  var TOPS = ['tee', 'hoodie', 'blazer', 'sweater', 'dress', 'robe', 'jacket', 'thobe', 'vest', 'jersey'];
  var CX = 120, HEAD_Y = 86, TOP = 124, TW = 84, TH = 144;

  function torsoPath(cx, top, w, h) {
    var x0 = cx - w / 2, x1 = cx + w / 2;
    return 'M ' + (x0 + 10) + ',' + top + ' L ' + (x1 - 10) + ',' + top + ' Q ' + x1 + ',' + top + ' ' + (x1 + 2) + ',' + (top + 26) + ' L ' + (x1 - 2) + ',' + (top + h) + ' L ' + (x0 + 2) + ',' + (top + h) + ' L ' + (x0 - 2) + ',' + (top + 26) + ' Q ' + x0 + ',' + top + ' ' + (x0 + 10) + ',' + top + ' Z';
  }
  function accentFor(c) { return lum(c) > 0.62 ? COLORS.moss : (c === COLORS.neon ? COLORS.deep : COLORS.neon); }

  function body(d, spec, sitting) {
    var top = spec.top, c = col(spec.topColor), acc = col(spec.accent) || accentFor(c), s = '';
    var long = !sitting && (top === 'robe' || top === 'thobe');
    if (top === 'dress' && !sitting) {
      s += P('M 88,124 L 152,124 Q 162,124 164,150 L 178,300 Q 120,314 62,300 L 76,150 Q 78,124 88,124 Z', c);
      s += P('M 80,210 Q 120,220 160,210', 'none', shade(c, -0.18), 5);
    } else if (long) {
      s += P('M 88,124 L 152,124 Q 164,124 166,150 L 176,364 Q 120,370 64,364 L 74,150 Q 76,124 88,124 Z', c);
      if (top === 'robe') s += P('M 104,124 L 120,176 L 136,124', COLORS.paper) + P('M 120,176 L 120,360', 'none', shade(c, -0.25), 3);
      else s += P('M 120,130 L 120,210', 'none', shade(c, -0.12), 3) + Ci(120, 150, 2.4, shade(c, -0.25)) + Ci(120, 170, 2.4, shade(c, -0.25)) + Ci(120, 190, 2.4, shade(c, -0.25));
    } else {
      s += P(torsoPath(CX, TOP, TW, TH), c);
      switch (top) {
        case 'hoodie':
          s += P('M 98,124 Q 120,150 142,124', 'none', acc, 6) + P('M 110,138 v 34 M 130,138 v 34', 'none', COLORS.cream, 3.4) +
            R(92, 214, 56, 30, 12, shade(c, -0.14));
          break;
        case 'blazer': case 'jacket':
          var inner = top === 'blazer' ? COLORS.paper : (col(spec.innerColor) || COLORS.cream);
          s += P('M 104,124 L 120,182 L 136,124 Z', inner) + P('M 104,124 L 116,168 L 106,176 M 136,124 L 124,168 L 134,176', 'none', shade(c, -0.25), 3) +
            P('M 120,182 L 120,268', 'none', shade(c, -0.25), 2.5) + Ci(126, 206, 3, shade(c, -0.35)) + Ci(126, 232, 3, shade(c, -0.35));
          if (top === 'jacket') s += R(90, 190, 14, 3, 1.5, shade(c, -0.25)) + R(136, 190, 14, 3, 1.5, shade(c, -0.25));
          break;
        case 'sweater':
          s += P('M 100,124 Q 120,142 140,124', 'none', shade(c, -0.2), 7) + R(80, 252, 80, 16, 4, shade(c, -0.14)) +
            P('M 84,256 v 8 M 94,256 v 8 M 104,256 v 8 M 114,256 v 8 M 124,256 v 8 M 134,256 v 8 M 144,256 v 8 M 154,256 v 8', 'none', shade(c, -0.26), 1.6);
          break;
        case 'vest':
          s += P('M 100,124 L 120,160 L 140,124 Z', COLORS.paper) + P('M 90,124 L 90,268 M 150,124 L 150,268', 'none', shade(c, -0.3), 12, ' opacity="0.25"') + Ci(120, 196, 2.8, INK) + Ci(120, 222, 2.8, INK);
          break;
        case 'jersey':
          s += P('M 102,124 Q 120,140 138,124', 'none', acc, 6) + '<text x="120" y="222" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-weight="800" font-size="46" fill="' + acc + '">' + esc(spec.number == null ? 1 : String(spec.number).slice(0, 2)) + '</text>';
          break;
        default: // tee
          s += P('M 100,124 Q 120,144 140,124', 'none', acc, 6);
      }
    }
    d.add(s, [60, 120, 180, long ? 370 : 300]);
  }

  function bodywear(d, kind, spec, sitting) {
    var s = '', c = col(spec.topColor);
    switch (kind) {
      case 'tie': s = P('M 115,130 L 125,130 L 122,140 L 128,196 L 120,206 L 112,196 L 118,140 Z', col(spec.tieColor) || COLORS.neon); break;
      case 'bowtie': s = P('M 120,134 L 104,126 L 104,142 Z M 120,134 L 136,126 L 136,142 Z', col(spec.tieColor) || COLORS.neon) + Ci(120, 134, 4, shade(col(spec.tieColor) || COLORS.neon, -0.3)); break;
      case 'scarf': s = P('M 94,128 Q 120,150 146,128 L 146,140 Q 120,162 94,140 Z', col(spec.scarfColor) || COLORS.neon) + R(128, 138, 14, 48, 5, col(spec.scarfColor) || COLORS.neon) + P('M 131,180 v 6 M 135,180 v 6 M 139,180 v 6', 'none', shade(col(spec.scarfColor) || COLORS.neon, -0.3), 2); break;
      case 'lanyard': s = P('M 100,126 L 114,194 M 140,126 L 126,194', 'none', COLORS.neon, 3.4) + R(106, 190, 28, 36, 5, COLORS.paper) + R(110, 196, 20, 8, 2, COLORS.deep) + P('M 111,216 h 18 M 111,221 h 12', 'none', '#B9B4A7', 2); break;
      case 'pin': s = Ci(142, 150, 8, COLORS.ink) + P('M 137,153 v -6 l 5,4 l 5,-4 v 6', 'none', COLORS.neon, 2); break;
      case 'medal': s = P('M 108,124 L 120,176 L 132,124', 'none', COLORS.neon, 6) + Ci(120, 184, 13, COLORS.gold) + Ci(120, 184, 7, shade(COLORS.gold, -0.2)); break;
      case 'watch': break; // drawn with the hands
      case 'backpack': break; // drawn behind the body
    }
    if (s) d.add(s);
  }

  /* ------------------------------------------------------------------ arms + legs */
  // right-arm shapes (viewer's right). Left arms are mirrored automatically.
  var ARMS = {
    down: { pts: [[150, 142], [164, 198], [166, 250]] },
    swing: { pts: [[150, 142], [170, 194], [184, 236]] },
    wave: { pts: [[150, 142], [186, 124], [194, 72]] },
    point: { pts: [[150, 142], [192, 160], [226, 150]], finger: true },
    up: { pts: [[150, 142], [166, 96], [172, 46]] },
    fist: { pts: [[150, 142], [186, 150], [188, 104]] },
    hip: { pts: [[150, 142], [184, 190], [158, 222]] },
    chin: { pts: [[150, 142], [172, 198], [136, 124]], layer: 'top' },
    face: { pts: [[150, 142], [168, 190], [126, 92]], layer: 'top' },
    hold: { pts: [[150, 142], [160, 198], [134, 210]] },
    type: { pts: [[150, 142], [160, 196], [138, 226]], hand: false },
    cross: { pts: [[150, 142], [152, 206], [96, 196]] },
    shrug: { pts: [[150, 142], [182, 184], [196, 146]] },
    out: { pts: [[150, 142], [186, 170], [212, 150]] },
    mic: { pts: [[150, 142], [172, 196], [146, 150]], layer: 'top' },
    phone: { pts: [[150, 142], [162, 200], [140, 176]] },
    behind: { pts: [[150, 142], [160, 196], [140, 232]], layer: 'back', hand: false },
    ear: { pts: [[150, 142], [178, 172], [156, 92]], layer: 'top' },
    heart: { pts: [[150, 142], [160, 196], [132, 168]] },
    thumbsup: { pts: [[150, 142], [184, 182], [190, 140]], thumb: true },
    reach: { pts: [[150, 142], [196, 132], [236, 118]] }
  };
  function mirror(pts) { return pts.map(function (p) { return [240 - p[0], p[1]]; }); }

  var POSES = {
    stand: { L: 'down', R: 'down' },
    wave: { L: 'down', R: 'wave' },
    point: { L: 'down', R: 'point' },
    cheer: { L: 'up', R: 'up', legs: 'wide' },
    'raise-hand': { L: 'down', R: 'up' },
    thinking: { L: 'hip', R: 'chin' },
    'arms-crossed': { L: 'cross', R: 'cross' },
    'hands-on-hips': { L: 'hip', R: 'hip', legs: 'wide' },
    shrug: { L: 'shrug', R: 'shrug' },
    explain: { L: 'down', R: 'out' },
    argue: { L: 'out', R: 'point', legs: 'wide' },
    present: { L: 'hip', R: 'out' },
    hold: { L: 'hold', R: 'hold' },
    phone: { L: 'down', R: 'phone' },
    mic: { L: 'down', R: 'mic' },
    'fist-pump': { L: 'down', R: 'fist', legs: 'wide' },
    walk: { L: 'swing', R: 'swing', legs: 'walk' },
    pace: { L: 'behind', R: 'chin', legs: 'walk' },
    celebrate: { L: 'up', R: 'fist', legs: 'wide' },
    facepalm: { L: 'hip', R: 'face' },
    listen: { L: 'down', R: 'ear' },
    'hand-on-heart': { L: 'down', R: 'heart' },
    'thumbs-up': { L: 'down', R: 'thumbsup' },
    'hands-behind': { L: 'behind', R: 'behind' },
    reach: { L: 'down', R: 'reach', legs: 'walk' },
    sit: { L: 'down', R: 'down', legs: 'sit' },
    'sit-hold': { L: 'hold', R: 'hold', legs: 'sit' },
    'sit-type': { L: 'type', R: 'type', legs: 'sit' },
    'sit-think': { L: 'hold', R: 'chin', legs: 'sit' },
    'sit-cross': { L: 'cross', R: 'cross', legs: 'sit' },
    'sit-phone': { L: 'down', R: 'phone', legs: 'sit' },
    'sit-wave': { L: 'down', R: 'wave', legs: 'sit' },
    'sit-listen': { L: 'down', R: 'ear', legs: 'sit' },
    'sit-cheer': { L: 'up', R: 'up', legs: 'sit' }
  };
  var LEGS = {
    stand: [[[106, 262], [104, 370]], [[134, 262], [136, 370]]],
    wide: [[[106, 262], [88, 370]], [[134, 262], [152, 370]]],
    walk: [[[108, 262], [92, 316], [78, 368]], [[132, 262], [148, 318], [170, 366]]],
    sit: [[[104, 266], [160, 272], [162, 360]], [[132, 266], [188, 270], [192, 356]]]
  };

  function legs(d, spec, kind) {
    var c = col(spec.bottomColor), s = '', legW = 24, dress = spec.top === 'dress' && kind !== 'sit', long = (spec.top === 'robe' || spec.top === 'thobe') && kind !== 'sit';
    var set = LEGS[kind] || LEGS.stand;
    if (kind === 'sit') {
      var seat = col(spec.seatColor) || COLORS.steel;
      if (spec.seat === 'beanbag') s += P('M 50,366 Q 44,282 110,272 L 190,272 Q 236,282 230,366 Q 220,392 140,392 Q 58,392 50,366 Z', COLORS.deep);
      else s += R(70, 262, 100, 16, 8, seat) + L([[82, 276], [78, 384]], seat, 10) + L([[158, 276], [162, 384]], seat, 10);
    }
    set.forEach(function (pts, i) {
      if (dress) s += L([pts[0][0] < 120 ? [pts[0][0] + 2, 296] : [pts[0][0] - 2, 296], pts[pts.length - 1]], skinCol(spec.skin), 16);
      else if (long) s += L([[pts[0][0], 352], pts[pts.length - 1]], shade(c, -0.1), 20);
      else s += L(pts, i === 0 && spec.bottomColor2 ? col(spec.bottomColor2) : c, legW);
    });
    set.forEach(function (pts, i) {
      var e = pts[pts.length - 1], look = kind === 'sit' || kind === 'walk' ? (i === 0 && kind === 'walk' ? -1 : 1) : (i === 0 ? -1 : 1);
      s += R(e[0] - 16 + 6 * look, e[1] - 3, 32, 17, 8.5, col(spec.shoeColor) || INK) + (spec.shoeAccent ? R(e[0] - 12 + 6 * look, e[1] + 8, 24, 4, 2, COLORS.neon) : '');
    });
    d.add(s, [40, 250, 240, 396]);
  }

  function armColor(spec) { return col(spec.sleeveColor) || col(spec.topColor); }
  function shortSleeves(spec) { return spec.top === 'tee' || spec.top === 'dress' || spec.top === 'jersey' || spec.top === 'vest'; }
  function drawArmLine(d, spec, pts) {
    var sc = armColor(spec), s;
    if (shortSleeves(spec)) {
      var a = pts[0], b = pts[1], mid = [a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55];
      s = L(pts, skinCol(spec.skin), 18) + L([a, mid], sc, 24);
    } else s = L(pts, sc, 22);
    d.add(s); d.pts(pts, 14);
  }
  function drawHand(d, spec, arm, pts, side) {
    var e = pts[pts.length - 1], sk = skinCol(spec.skin), s = Ci(e[0], e[1], 11, sk);
    if (arm.finger) { var dir = side === 'L' ? -1 : 1; s += P('M ' + (e[0] + 4 * dir) + ',' + (e[1] - 2) + ' l ' + (22 * dir) + ',-6', 'none', sk, 9); d.box(e[0] - 30, e[1] - 14, e[0] + 30, e[1] + 14); }
    if (arm.thumb) s += P('M ' + e[0] + ',' + (e[1] - 6) + ' l 0,-14', 'none', sk, 8);
    if (spec.bodywear && spec.bodywear.indexOf('watch') >= 0 && side === 'L') {
      var p = pts[pts.length - 2], dx = e[0] - p[0], dy = e[1] - p[1], len = Math.sqrt(dx * dx + dy * dy);
      s = R(e[0] - dx / len * 16 - 7, e[1] - dy / len * 16 - 7, 14, 14, 4, INK) + R(e[0] - dx / len * 16 - 4, e[1] - dy / len * 16 - 4, 8, 8, 2, COLORS.neon) + s;
    }
    d.add(s);
  }

  /* ------------------------------------------------------------------ props (things they hold) */
  var PROPS = {
    // two-handed: drawn between the hands, at the chest
    book: { hands: 2, pose: 'hold', draw: function (d, h, spec) {
      var cx = 120, cy = 214, cov = col(spec.propColor) || COLORS.deep;
      d.add(P('M ' + cx + ',' + (cy - 12) + ' L ' + (cx - 44) + ',' + (cy - 24) + ' L ' + (cx - 44) + ',' + (cy + 20) + ' L ' + cx + ',' + (cy + 32) + ' Z', cov) + P('M ' + cx + ',' + (cy - 12) + ' L ' + (cx + 44) + ',' + (cy - 24) + ' L ' + (cx + 44) + ',' + (cy + 20) + ' L ' + cx + ',' + (cy + 32) + ' Z', cov) +
        P('M ' + cx + ',' + (cy - 16) + ' L ' + (cx - 40) + ',' + (cy - 28) + ' L ' + (cx - 40) + ',' + (cy + 16) + ' L ' + cx + ',' + (cy + 28) + ' Z', COLORS.cream) + P('M ' + cx + ',' + (cy - 16) + ' L ' + (cx + 40) + ',' + (cy - 28) + ' L ' + (cx + 40) + ',' + (cy + 16) + ' L ' + cx + ',' + (cy + 28) + ' Z', '#E2DDD0') +
        P('M ' + (cx - 32) + ',' + (cy - 18) + ' L ' + (cx - 8) + ',' + (cy - 11) + ' M ' + (cx - 32) + ',' + (cy - 9) + ' L ' + (cx - 8) + ',' + (cy - 2) + ' M ' + (cx - 32) + ',' + cy + ' L ' + (cx - 8) + ',' + (cy + 7) + ' M ' + (cx + 8) + ',' + (cy - 11) + ' L ' + (cx + 32) + ',' + (cy - 18) + ' M ' + (cx + 8) + ',' + (cy - 2) + ' L ' + (cx + 32) + ',' + (cy - 9), 'none', '#B9B4A7', 2.4), [70, 180, 170, 250]);
    } },
    closedbook: { hands: 2, pose: 'hold', draw: function (d, h, spec) {
      var cov = col(spec.propColor) || COLORS.deep;
      d.add(R(90, 180, 60, 76, 5, cov) + R(146, 184, 6, 70, 2, COLORS.cream) + R(100, 196, 40, 5, 2, COLORS.neon) + R(100, 206, 28, 4, 2, COLORS.cream, ' opacity="0.8"'), [88, 178, 154, 258]);
    } },
    tablet: { hands: 2, pose: 'hold', draw: function (d) {
      d.add(R(88, 178, 64, 84, 9, INK) + R(94, 184, 52, 70, 5, COLORS.neon, ' opacity="0.92"') + P('M 100,224 H 110 V 212 L 120,222 L 130,212 V 224 H 140', 'none', INK, 4), [86, 176, 154, 264]);
    } },
    notebook: { hands: 2, pose: 'hold', draw: function (d) {
      d.add(R(92, 184, 56, 70, 4, COLORS.paper) + P('M 100,200 h 40 M 100,212 h 40 M 100,224 h 30 M 100,236 h 36', 'none', '#C9C4B8', 2.4) + P('M 92,190 h -4 M 92,204 h -4 M 92,218 h -4 M 92,232 h -4 M 92,246 h -4', 'none', COLORS.steel, 3) +
        P('M 150,172 L 128,222', 'none', COLORS.neon, 6) + P('M 128,222 l -2,6', 'none', INK, 4), [84, 168, 154, 256]);
    } },
    scroll: { hands: 2, pose: 'hold', draw: function (d) {
      d.add(R(94, 180, 52, 70, 2, COLORS.sand) + R(88, 174, 64, 12, 6, shade(COLORS.sand, -0.2)) + R(88, 244, 64, 12, 6, shade(COLORS.sand, -0.2)) + P('M 102,198 h 36 M 102,208 h 36 M 102,218 h 28 M 102,228 h 34', 'none', shade(COLORS.sand, -0.45), 2.2), [86, 172, 154, 258]);
    } },
    laptop: { hands: 2, pose: 'sit-type', front: true, draw: function (d) {
      d.add(P('M 80,252 L 88,184 L 152,184 L 160,252 Z', COLORS.steel) + R(70, 248, 100, 10, 5, shade(COLORS.steel, -0.2)) + Ci(120, 216, 14, INK) + P('M 112,222 v -11 l 8,7 l 8,-7 v 11', 'none', COLORS.neon, 3), [68, 182, 172, 260]);
    } },
    sign: { hands: 2, pose: 'cheer', draw: function (d, h, spec) {
      var t = String(spec.signText || 'DEBATE ME').toUpperCase(), size = t.length > 12 ? 20 : 24, w = Math.max(130, t.length * size * 0.66 + 40), bg = col(spec.propColor) || COLORS.cream;
      d.add(R(120 - w / 2, -2, w, 50, 10, bg) + R(120 - w / 2, -2, w, 50, 10, 'none', ' stroke="' + INK + '" stroke-width="3"'), [120 - w / 2 - 4, -6, 120 + w / 2 + 4, 52]);
      d.text({ x: 120, y: 23 + size * 0.36, s: t, size: size, fill: lum(bg) > 0.6 ? INK : COLORS.cream, spacing: 1 });
    } },
    // one-handed: drawn at the right hand
    phone: { hands: 1, pose: 'phone', draw: function (d, h) {
      var x = h[0], y = h[1];
      d.add('<g transform="rotate(-14 ' + x + ' ' + (y - 14) + ')">' + R(x - 12, y - 36, 24, 42, 5, INK) + R(x - 9, y - 32, 18, 32, 3, COLORS.neon, ' opacity="0.9"') + '</g>', [x - 20, y - 40, x + 20, y + 10]);
    } },
    mic: { hands: 1, pose: 'mic', draw: function (d, h) {
      var x = h[0], y = h[1];
      d.add(L([[x + 2, y + 6], [x - 10, y - 26]], INK, 9) + Ci(x - 13, y - 33, 10, COLORS.steel) + P('M ' + (x - 20) + ',' + (y - 36) + ' h 14 M ' + (x - 20) + ',' + (y - 30) + ' h 14', 'none', '#6F7A74', 1.6) + R(x - 8, y - 18, 10, 6, 2, COLORS.neon), [x - 26, y - 46, x + 10, y + 12]);
    } },
    coffee: { hands: 1, pose: 'stand', draw: function (d, h) {
      var x = h[0], y = h[1];
      d.add(P('M ' + (x - 13) + ',' + (y - 30) + ' L ' + (x + 13) + ',' + (y - 30) + ' L ' + (x + 10) + ',' + (y + 4) + ' L ' + (x - 10) + ',' + (y + 4) + ' Z', COLORS.cream) + R(x - 15, y - 34, 30, 7, 3, COLORS.deep) + R(x - 11, y - 18, 22, 9, 2, COLORS.moss) +
        P('M ' + (x - 4) + ',' + (y - 40) + ' q -5,-7 0,-14 M ' + (x + 5) + ',' + (y - 40) + ' q -5,-7 0,-14', 'none', COLORS.steel, 3.2), [x - 18, y - 56, x + 18, y + 6]);
    } },
    trophy: { hands: 1, pose: 'raise-hand', draw: function (d, h) {
      var x = h[0], y = h[1];
      d.add(P('M ' + (x - 20) + ',' + (y - 58) + ' L ' + (x + 20) + ',' + (y - 58) + ' Q ' + (x + 20) + ',' + (y - 26) + ' ' + x + ',' + (y - 24) + ' Q ' + (x - 20) + ',' + (y - 26) + ' ' + (x - 20) + ',' + (y - 58) + ' Z', COLORS.gold) +
        P('M ' + (x - 20) + ',' + (y - 52) + ' q -12,0 -10,12 q 2,8 12,6 M ' + (x + 20) + ',' + (y - 52) + ' q 12,0 10,12 q -2,8 -12,6', 'none', COLORS.gold, 4) +
        R(x - 4, y - 26, 8, 12, 2, shade(COLORS.gold, -0.2)) + R(x - 14, y - 16, 28, 8, 3, shade(COLORS.gold, -0.3)) + P('M ' + (x - 7) + ',' + (y - 36) + ' v -10 l 7,6 l 7,-6 v 10', 'none', COLORS.ink, 2.6), [x - 36, y - 62, x + 36, y]);
    } },
    megaphone: { hands: 1, pose: 'explain', draw: function (d, h) {
      var x = h[0], y = h[1];
      d.add(P('M ' + (x + 4) + ',' + (y - 9) + ' L ' + (x + 44) + ',' + (y - 26) + ' L ' + (x + 44) + ',' + (y + 22) + ' L ' + (x + 4) + ',' + (y + 7) + ' Z', COLORS.neon) + E(x + 44, y - 2, 6, 24, shade(COLORS.neon, -0.3)) + R(x - 2, y - 10, 10, 20, 3, INK) +
        P('M ' + (x + 58) + ',' + (y - 20) + ' l 10,-8 M ' + (x + 60) + ',' + (y - 2) + ' h 13 M ' + (x + 58) + ',' + (y + 16) + ' l 10,8', 'none', COLORS.neon, 4), [x - 4, y - 32, x + 76, y + 30]);
    } },
    gavel: { hands: 1, pose: 'raise-hand', draw: function (d, h) {
      var x = h[0], y = h[1];
      d.add(L([[x, y], [x + 22, y - 46]], COLORS.wood, 9) + '<rect x="' + (x + 2) + '" y="' + (y - 76) + '" width="58" height="30" rx="8" fill="' + COLORS.wood + '" transform="rotate(26 ' + (x + 31) + ' ' + (y - 61) + ')"/>' + '<rect x="' + (x + 24) + '" y="' + (y - 76) + '" width="8" height="30" fill="' + shade(COLORS.wood, -0.25) + '" transform="rotate(26 ' + (x + 31) + ' ' + (y - 61) + ')"/>', [x - 6, y - 92, x + 66, y + 6]);
    } },
    flag: { hands: 1, pose: 'raise-hand', draw: function (d, h, spec) {
      var x = h[0], y = h[1], fc = col(spec.propColor) || COLORS.neon;
      d.add(L([[x, y + 14], [x, y - 94]], COLORS.wood, 5) + P('M ' + (x + 2) + ',' + (y - 94) + ' Q ' + (x + 36) + ',' + (y - 104) + ' ' + (x + 72) + ',' + (y - 92) + ' L ' + (x + 72) + ',' + (y - 50) + ' Q ' + (x + 36) + ',' + (y - 62) + ' ' + (x + 2) + ',' + (y - 52) + ' Z', fc) +
        P('M ' + (x + 12) + ',' + (y - 70) + ' H ' + (x + 26) + ' V ' + (y - 82) + ' L ' + (x + 36) + ',' + (y - 74) + ' L ' + (x + 46) + ',' + (y - 82) + ' V ' + (y - 70) + ' H ' + (x + 62), 'none', lum(fc) > 0.6 ? INK : COLORS.cream, 4), [x - 6, y - 108, x + 76, y + 18]);
    } },
    magnifier: { hands: 1, pose: 'explain', draw: function (d, h) {
      var x = h[0], y = h[1];
      d.add(L([[x, y], [x + 16, y - 16]], INK, 8) + Ci(x + 30, y - 30, 20, COLORS.sky, ' opacity="0.45"') + Ci(x + 30, y - 30, 20, 'none', ' stroke="' + INK + '" stroke-width="6"') + P('M ' + (x + 20) + ',' + (y - 38) + ' q 6,-8 14,-6', 'none', COLORS.paper, 3), [x - 6, y - 56, x + 56, y + 6]);
    } },
    pointer: { hands: 1, pose: 'point', draw: function (d, h) {
      var x = h[0], y = h[1];
      d.add(L([[x, y], [x + 60, y - 18]], COLORS.wood, 5) + Ci(x + 61, y - 18, 4, COLORS.neon), [x - 4, y - 26, x + 68, y + 6]);
    } },
    pen: { hands: 1, pose: 'point', draw: function (d, h) {
      var x = h[0], y = h[1];
      d.add(L([[x - 4, y + 10], [x + 18, y - 18]], COLORS.neon, 6) + L([[x + 18, y - 18], [x + 22, y - 23]], INK, 4), [x - 8, y - 28, x + 26, y + 14]);
    } },
    books: { hands: 1, pose: 'stand', draw: function (d, h) {
      var x = h[0], y = h[1];
      d.add(R(x - 24, y - 34, 40, 11, 3, COLORS.deep) + R(x - 20, y - 23, 38, 11, 3, COLORS.coral) + R(x - 26, y - 12, 42, 12, 3, COLORS.navy) + R(x - 22, y - 45, 36, 11, 3, COLORS.mustard), [x - 30, y - 48, x + 20, y + 2]);
    } },
    balloon: { hands: 1, pose: 'raise-hand', draw: function (d, h, spec) {
      var x = h[0], y = h[1], c = col(spec.propColor) || COLORS.neon;
      d.add(P('M ' + x + ',' + y + ' q 10,-24 -2,-50 q -8,-16 6,-34', 'none', COLORS.steel, 2) + E(x + 6, y - 110, 26, 30, c) + P('M ' + (x + 6) + ',' + (y - 80) + ' l -4,6 h 8 Z', c) + E(x - 4, y - 120, 6, 9, COLORS.paper, ' opacity="0.45"'), [x - 24, y - 142, x + 34, y + 4]);
    } },
    paper: { hands: 1, pose: 'explain', draw: function (d, h) {
      var x = h[0], y = h[1];
      d.add('<g transform="rotate(-8 ' + x + ' ' + y + ')">' + R(x - 6, y - 52, 40, 52, 3, COLORS.paper) + P('M ' + x + ',' + (y - 42) + ' h 26 M ' + x + ',' + (y - 34) + ' h 26 M ' + x + ',' + (y - 26) + ' h 18', 'none', '#C9C4B8', 2.4) + P('M ' + (x + 2) + ',' + (y - 14) + ' l 5,5 l 10,-12', 'none', COLORS.moss, 3.4) + '</g>', [x - 10, y - 60, x + 40, y + 4]);
    } }
  };

  /* ------------------------------------------------------------------ extras around the head */
  var EXTRAS = ['bubble', 'thought', 'idea', 'sparks', 'sweat', 'zzz', 'question', 'exclaim', 'notes', 'hearts', 'stars', 'motion', 'steam', 'check', 'cross'];
  function extras(d, list, spec) {
    (list || []).forEach(function (x) {
      var kind = typeof x === 'string' ? x : x.type, text = typeof x === 'string' ? null : x.text, s = '';
      switch (kind) {
        case 'bubble': {
          var t = text != null ? String(text) : (spec.bubbleText != null ? String(spec.bubbleText) : '!'), size = t.length <= 2 ? 44 : 22, w = Math.max(76, t.length * size * 0.62 + 36), bx = 150, by = -6, bh = 58, fill = col((x && x.color) || spec.bubbleColor) || COLORS.neon;
          s = R(bx, by, w, bh, 24, fill) + P('M ' + (bx + 14) + ',' + (by + bh - 2) + ' L ' + (bx + 2) + ',' + (by + bh + 22) + ' L ' + (bx + 34) + ',' + (by + bh - 2) + ' Z', fill);
          d.add(s, [bx - 2, by - 2, bx + w + 2, by + bh + 24]);
          d.text({ x: bx + w / 2, y: by + bh / 2 + size * 0.36, s: t, size: size, fill: lum(fill) > 0.55 ? INK : COLORS.cream });
          return;
        }
        case 'thought': {
          var tt = text != null ? String(text) : null, tw = tt ? Math.max(90, tt.length * 13 + 36) : 110;
          s = Ci(160, 50, 6, COLORS.cream) + Ci(172, 32, 9, COLORS.cream) + R(166, -28, tw, 50, 25, COLORS.cream);
          if (!tt) s += P('M ' + (180) + ',6 H 196 V -10 L 208,1 L 220,-10 V 6 H ' + (166 + tw - 14), 'none', COLORS.deep, 5);
          d.add(s, [150, -32, 166 + tw + 4, 60]);
          if (tt) d.text({ x: 166 + tw / 2, y: 3 + 7, s: tt, size: 20, fill: INK });
          return;
        }
        case 'idea': s = Ci(120, -4, 20, COLORS.neon) + R(111, 14, 18, 10, 4, INK) + P('M 120,-40 v 9 M 86,-20 l 8,5 M 154,-20 l -8,5 M 82,6 h 9 M 158,6 h -9', 'none', COLORS.neon, 5); d.add(s, [78, -44, 162, 26]); return;
        case 'sparks': s = P('M 160,54 L 172,36 M 170,72 L 190,64 M 150,40 L 152,20', 'none', COLORS.neon, 6); d.add(s, [144, 14, 196, 78]); return;
        case 'sweat': s = P('M 158,58 q -9,14 0,18 q 9,-4 0,-18 Z', COLORS.sky); d.add(s, [148, 54, 168, 80]); return;
        case 'zzz': d.box(146, -20, 206, 60); d.text({ x: 158, y: 50, s: 'z', size: 22, fill: COLORS.neon }); d.text({ x: 174, y: 30, s: 'z', size: 30, fill: COLORS.neon }); d.text({ x: 194, y: 4, s: 'Z', size: 38, fill: COLORS.neon }); return;
        case 'question': d.box(150, -12, 196, 60); d.text({ x: 172, y: 40, s: '?', size: 58, fill: COLORS.neon, weight: 800 }); return;
        case 'exclaim': d.box(150, -12, 196, 60); d.text({ x: 170, y: 40, s: '!', size: 60, fill: COLORS.neon, weight: 800 }); return;
        case 'notes': s = P('M 160,48 v -26 l 16,-5 v 24', 'none', COLORS.neon, 4) + Ci(156, 48, 6, COLORS.neon) + Ci(172, 42, 6, COLORS.neon) + P('M 190,20 v -20', 'none', COLORS.neon, 4) + Ci(186, 20, 6, COLORS.neon) + P('M 190,0 q 8,2 8,10', 'none', COLORS.neon, 3); d.add(s, [148, -4, 202, 56]); return;
        case 'hearts': s = P('M 166,40 c -8,-10 -20,0 -10,10 l 10,10 l 10,-10 c 10,-10 -2,-20 -10,-10 Z', COLORS.coral) + P('M 190,14 c -5,-6 -12,0 -6,6 l 6,6 l 6,-6 c 6,-6 -1,-12 -6,-6 Z', COLORS.rose); d.add(s, [150, 4, 202, 62]); return;
        case 'stars': s = star(160, 40, 10, COLORS.gold) + star(186, 18, 7, COLORS.neon) + star(80, 26, 7, COLORS.gold); d.add(s, [70, 6, 198, 52]); return;
        case 'motion': s = P('M 38,180 h -22 M 44,210 h -30 M 40,240 h -20', 'none', COLORS.steel, 5); d.add(s, [10, 172, 48, 248]); return;
        case 'steam': s = P('M 96,40 q -8,-10 0,-20 q 8,-10 0,-20 M 144,40 q -8,-10 0,-20 q 8,-10 0,-20', 'none', COLORS.red, 5); d.add(s, [84, -4, 156, 44]); return;
        case 'check': s = Ci(176, 26, 22, COLORS.neon) + P('M 165,26 l 8,8 l 14,-16', 'none', INK, 5); d.add(s, [152, 2, 200, 50]); return;
        case 'cross': s = Ci(176, 26, 22, COLORS.red) + P('M 167,17 l 18,18 M 185,17 l -18,18', 'none', COLORS.paper, 5); d.add(s, [152, 2, 200, 50]); return;
      }
    });
  }
  function star(cx, cy, r, fill) {
    var pts = [];
    for (var i = 0; i < 10; i++) { var a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; pts.push(n(cx + Math.cos(a) * rr) + ',' + n(cy + Math.sin(a) * rr)); }
    return '<polygon points="' + pts.join(' ') + '" fill="' + fill + '"/>';
  }

  /* ------------------------------------------------------------------ the person builder */
  var DEFAULT = {
    kind: 'person', skin: 'light', hair: 'short', hairColor: 'black', top: 'tee', topColor: 'deep', bottomColor: 'charcoal',
    pose: 'stand', expression: 'happy', look: 1, headwear: null, headwearColor: null, facewear: [], bodywear: [], prop: null, extras: []
  };
  function normalize(spec) {
    var s = {}, k;
    for (k in DEFAULT) s[k] = DEFAULT[k];
    for (k in spec) if (spec[k] !== undefined) s[k] = spec[k];
    ['facewear', 'bodywear', 'extras'].forEach(function (key) { if (!Array.isArray(s[key])) s[key] = s[key] ? [s[key]] : []; });
    if (s.prop && PROPS[s.prop] && !spec.pose) s.pose = PROPS[s.prop].pose;
    if (!POSES[s.pose]) s.pose = 'stand';
    return s;
  }

  function drawPerson(spec) {
    var d = Drawing(), pose = POSES[spec.pose], legKind = pose.legs || 'stand', sitting = legKind === 'sit';
    var hc = col(spec.hairColor), skin = skinCol(spec.skin), look = spec.look;
    var hy = HEAD_Y, oy = 0; // everything is drawn in one coordinate space
    var arms = { L: ARMS[pose.L], R: ARMS[pose.R] }, pts = { L: mirror(arms.L.pts), R: arms.R.pts };
    var prop = spec.prop ? PROPS[spec.prop] : null;

    d.box(60, 40, 180, 390);
    // backpack straps behind
    if (spec.bodywear.indexOf('backpack') >= 0) d.add(R(70, 140, 100, 110, 22, col(spec.backpackColor) || COLORS.mustard), [66, 136, 174, 254]);
    // arms that go behind the body
    ['L', 'R'].forEach(function (side) { if (arms[side].layer === 'back') drawArmLine(d, spec, pts[side]); });
    // hair that sits behind the body
    hairBack(d, spec.hair, CX, hy, hc, 'pre');
    legs(d, spec, legKind);
    // neck
    d.add(R(CX - 9, hy + 22, 18, 22, 6, skin));
    body(d, spec, sitting);
    if (spec.bodywear.indexOf('backpack') >= 0) d.add(L([[96, 126], [92, 200]], shade(col(spec.backpackColor) || COLORS.mustard, -0.2), 8) + L([[144, 126], [148, 200]], shade(col(spec.backpackColor) || COLORS.mustard, -0.2), 8));
    hairBack(d, spec.hair, CX, hy, hc, 'post');
    spec.bodywear.forEach(function (b) { bodywear(d, b, spec, sitting); });

    // arms in front of the body (left first so crossed arms layer properly)
    var mid = ['L', 'R'].filter(function (s) { return !arms[s].layer; });
    mid.forEach(function (side) { drawArmLine(d, spec, pts[side]); });
    var propDrawnEarly = false;
    if (prop && !prop.front && (prop.hands === 2 || !arms.R.layer)) { prop.draw(d, pts.R[pts.R.length - 1], spec); propDrawnEarly = true; }
    mid.forEach(function (side) {
      if (arms[side].hand === false) return;
      if (pose.L === 'cross' && side === 'L') return; // tucked under the other arm
      drawHand(d, spec, arms[side], pts[side], side);
    });
    if (prop && prop.front) prop.draw(d, pts.R[pts.R.length - 1], spec);

    // head
    d.add(Ci(CX, hy, 30, skin), [CX - 34, hy - 34, CX + 34, hy + 34]);
    face(d, CX, hy + 4, look, spec.expression);
    if (spec.facewear.indexOf('beard') >= 0 || spec.facewear.indexOf('stubble') >= 0) facewear(d, spec.facewear.indexOf('beard') >= 0 ? 'beard' : 'stubble', CX, hy, look, hc);
    if (spec.facewear.indexOf('beard') >= 0) { // re-draw the mouth so it shows on top of the beard
      var ex = typeof spec.expression === 'string' ? EXPRESSIONS[spec.expression] || EXPRESSIONS.happy : spec.expression;
      var md = Drawing(); face(md, CX, hy + 4, look, { eyes: 'none', mouth: ex.mouth });
      d.add(md.out.join('').replace(/<circle[^>]*r="3\.4"[^>]*\/>/g, ''));
    }
    spec.facewear.forEach(function (f) { if (f !== 'beard' && f !== 'stubble') facewear(d, f, CX, hy, look, hc); });
    var hat = spec.headwear;
    // hats that cover the hair still let the sides show
    if (!hat || hat === 'headphones' || hat === 'headband' || hat === 'crown' || hat === 'grad' || hat === 'visor') hairFront(d, spec.hair, CX, hy, hc);
    else if (spec.hair === 'long' || spec.hair === 'wavy' || spec.hair === 'bob' || spec.hair === 'braids' || spec.hair === 'locs') hairFront(d, spec.hair, CX, hy, hc);
    if (hat) headwear(d, hat, CX, hy, look, spec.headwearColor);

    // arms that go over the face
    ['L', 'R'].forEach(function (side) { if (arms[side].layer === 'top') drawArmLine(d, spec, pts[side]); });
    if (prop && !propDrawnEarly && !prop.front) prop.draw(d, pts.R[pts.R.length - 1], spec);
    ['L', 'R'].forEach(function (side) { if (arms[side].layer === 'top' && arms[side].hand !== false) drawHand(d, spec, arms[side], pts[side], side); });

    extras(d, spec.extras, spec);
    return d;
  }

  /* ------------------------------------------------------------------ robots (the AI judge family) */
  var ROBOT_SCREENS = ['mline', 'eyes', 'happy', 'check', 'cross', 'question', 'loading', 'heart', 'text'];
  var ROBOT_ARMS = { down: [[146, 204], [110, 256], [120, 296]], gavel: [[266, 204], [310, 196], [324, 150]], wave: [[266, 204], [306, 176], [316, 122]], point: [[266, 204], [318, 214], [356, 196]], rdown: [[266, 204], [302, 256], [292, 296]], clipboard: [[266, 204], [292, 250], [252, 262]], up: [[146, 204], [118, 160], [112, 110]] };
  function drawRobot(spec) {
    var d = Drawing(), dx = -86, g = [], body = col(spec.bodyColor) || COLORS.robot, body2 = col(spec.bodyColor2) || shade(body, -0.08), glow = col(spec.glowColor) || COLORS.neon, screen = spec.screen || 'mline';
    var T = function (x, y) { return [x + dx, y]; };
    var pt = function (arr) { return arr.map(function (p) { return T(p[0], p[1]); }); };
    g.push(L([T(206, 20), T(206, 52)], COLORS.steel, 8) + Ci(206 + dx, 16, 12, glow));
    g.push(R(130 + dx, 50, 152, 118, 34, body));
    g.push(R(148 + dx, 74, 116, 62, 22, INK));
    var sx = 206 + dx, sy = 105;
    switch (screen) {
      case 'eyes': g.push(R(sx - 30, sy - 12, 16, 24, 8, glow) + R(sx + 14, sy - 12, 16, 24, 8, glow)); break;
      case 'happy': g.push(P('M ' + (sx - 34) + ',' + (sy + 6) + ' q 10,-18 20,0 M ' + (sx + 14) + ',' + (sy + 6) + ' q 10,-18 20,0', 'none', glow, 6)); break;
      case 'check': g.push(P('M ' + (sx - 20) + ',' + sy + ' l 12,12 l 26,-24', 'none', glow, 8)); break;
      case 'cross': g.push(P('M ' + (sx - 16) + ',' + (sy - 16) + ' l 32,32 M ' + (sx + 16) + ',' + (sy - 16) + ' l -32,32', 'none', COLORS.red, 8)); break;
      case 'question': d.text({ x: sx, y: sy + 17, s: '?', size: 46, fill: glow, weight: 800 }); break;
      case 'loading': g.push(Ci(sx - 22, sy, 6, glow) + Ci(sx, sy, 6, glow, ' opacity="0.6"') + Ci(sx + 22, sy, 6, glow, ' opacity="0.3"')); break;
      case 'heart': g.push(P('M ' + sx + ',' + (sy + 16) + ' l -18,-18 c -10,-10 4,-24 18,-10 c 14,-14 28,0 18,10 Z', glow)); break;
      case 'text': d.text({ x: sx, y: sy + 9, s: String(spec.screenText || 'AI').slice(0, 5), size: 26, fill: glow, weight: 800 }); break;
      default: g.push(P('M ' + (sx - 44) + ',' + (sy + 9) + ' H ' + (sx - 24) + ' V ' + (sy - 13) + ' L ' + sx + ',' + (sy + 5) + ' L ' + (sx + 24) + ',' + (sy - 13) + ' V ' + (sy + 9) + ' H ' + (sx + 44), 'none', glow, 7));
    }
    g.push(R(140 + dx, 182, 132, 126, 30, body2));
    g.push(Ci(206 + dx, 236, 30, INK) + P('M ' + (190 + dx) + ',248 V 226 L ' + (206 + dx) + ',240 L ' + (222 + dx) + ',226 V 248', 'none', glow, 6));
    var la = spec.leftArm === 'up' ? ROBOT_ARMS.up : ROBOT_ARMS.down, ra = ROBOT_ARMS[spec.arm || 'gavel'] || ROBOT_ARMS.gavel;
    g.push(L(pt(la), body2, 24) + Ci(la[2][0] + dx, la[2][1] + 4, 14, COLORS.steel));
    g.push(L(pt(ra), body2, 24) + Ci(ra[2][0] + dx, ra[2][1] - 6, 14, COLORS.steel));
    var hx = ra[2][0] + dx, hy2 = ra[2][1] - 6;
    if ((spec.arm || 'gavel') === 'gavel') g.push(P('M ' + hx + ',' + hy2 + ' L ' + (hx + 26) + ',' + (hy2 - 48), 'none', COLORS.wood, 10) + '<rect x="' + (hx - 2) + '" y="' + (hy2 - 78) + '" width="62" height="34" rx="9" fill="' + COLORS.wood + '" transform="rotate(30 ' + (hx + 29) + ' ' + (hy2 - 61) + ')"/>');
    if (spec.arm === 'clipboard') g.push(R(hx - 50, hy2 - 40, 50, 64, 6, COLORS.wood) + R(hx - 45, hy2 - 32, 40, 52, 3, COLORS.paper) + P('M ' + (hx - 40) + ',' + (hy2 - 20) + ' l 5,5 l 9,-10 M ' + (hx - 40) + ',' + (hy2 - 2) + ' l 5,5 l 9,-10', 'none', COLORS.moss, 3) + R(hx - 34, hy2 - 44, 20, 8, 3, COLORS.steel) + Ci(hx, hy2, 14, COLORS.steel));
    g.push(R(160 + dx, 306, 28, 70, 12, body2) + R(224 + dx, 306, 28, 70, 12, body2));
    g.push(R(146 + dx, 366, 52, 22, 11, COLORS.steel) + R(214 + dx, 366, 52, 22, 11, COLORS.steel));
    d.add(g.join(''), [40, 0, 290, 392]);
    extras(d, spec.extras, spec);
    return d;
  }

  /* ------------------------------------------------------------------ render */
  var uid = 0;
  function build(specIn) {
    var spec = typeof specIn === 'string' ? get(specIn) : specIn;
    if (!spec) throw new Error('MajlisCharacters: no character called "' + specIn + '". Use list() to see the names.');
    spec = spec.kind === 'robot' ? spec : normalize(spec);
    return { spec: spec, d: spec.kind === 'robot' ? drawRobot(spec) : drawPerson(spec) };
  }
  function stickerFilter(id, cut) {
    return '<filter id="' + id + '" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">' +
      '<feMorphology in="SourceAlpha" operator="dilate" radius="' + cut + '" result="d"/>' +
      '<feFlood flood-color="' + COLORS.cream + '"/><feComposite in2="d" operator="in" result="edge"/>' +
      '<feDropShadow in="edge" dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.35" result="sh"/>' +
      '<feMerge><feMergeNode in="sh"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  }
  function wrap(inner, box, o, label) {
    var pad = o.sticker === false ? 6 : 18, x = Math.floor(box[0] - pad), y = Math.floor(box[1] - pad), w = Math.ceil(box[2] - box[0] + pad * 2), h = Math.ceil(box[3] - box[1] + pad * 2);
    var H = o.size || h, W = Math.round(w * H / h), id = 'mc' + (++uid) + Math.random().toString(36).slice(2, 6);
    var defs = o.sticker === false ? '' : '<defs>' + stickerFilter(id, o.cut || 8) + '</defs>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="' + x + ' ' + y + ' ' + w + ' ' + h + '" role="img" aria-label="' + esc(label || 'Character') + '" style="overflow:visible">' +
      defs + (o.sticker === false ? inner : '<g filter="url(#' + id + ')">' + inner + '</g>') + '</svg>';
  }
  function figureMarkup(b, flip, dx) {
    var d = b.d, body = d.out.join(''), texts;
    dx = dx || 0;
    if (flip) {
      texts = d.texts.map(function (t) { return textSvg(t, dx, 240); }).join('');
      return { svg: '<g transform="translate(' + (240 + dx) + ',0) scale(-1,1)">' + body + '</g>' + texts, box: [240 - d.x1 + dx, d.y0, 240 - d.x0 + dx, d.y1] };
    }
    texts = d.texts.map(function (t) { return textSvg(t, dx); }).join('');
    return { svg: (dx ? '<g transform="translate(' + dx + ',0)">' + body + '</g>' : body) + texts, box: [d.x0 + dx, d.y0, d.x1 + dx, d.y1] };
  }
  function svg(idOrSpec, o) {
    o = o || {};
    var b = build(idOrSpec), m = figureMarkup(b, !!o.flip, 0);
    var label = o.title || (typeof idOrSpec === 'string' && META[idOrSpec] ? META[idOrSpec].name : (b.spec.name || 'Character'));
    return wrap(m.svg, m.box, o, label);
  }

  /* ------------------------------------------------------------------ scenes: several characters in one picture */
  // figures: [{ character: 'id' or spec, flip: true/false, gap: extra space before it }]
  function scene(nameOrFigures, o) {
    o = o || {};
    var def = typeof nameOrFigures === 'string' ? SCENES[nameOrFigures] : { figures: nameOrFigures };
    if (!def) throw new Error('MajlisCharacters: no scene called "' + nameOrFigures + '". See scenes().');
    var parts = [], x = 0, box = [Infinity, Infinity, -Infinity, -Infinity], overlap = def.overlap != null ? def.overlap : (o.overlap != null ? o.overlap : 40);
    def.figures.forEach(function (f, i) {
      var b = build(f.character || f), flip = !!f.flip, w0 = flip ? 240 - b.d.x1 : b.d.x0, w1 = flip ? 240 - b.d.x0 : b.d.x1;
      var dx = i === 0 ? 0 : x - w0 - overlap + (f.gap || 0);
      var m = figureMarkup(b, flip, dx);
      if (f.scale) m.svg = '<g transform="translate(' + (dx + 120) + ',390) scale(' + f.scale + ') translate(' + (-dx - 120) + ',-390)">' + m.svg + '</g>';
      parts.push(m.svg);
      x = dx + w1;
      box = [Math.min(box[0], m.box[0]), Math.min(box[1], m.box[1]), Math.max(box[2], m.box[2]), Math.max(box[3], m.box[3])];
    });
    return wrap((def.backdrop ? def.backdrop(box) : '') + parts.join(''), box, o, def.name || 'Scene');
  }

  /* ------------------------------------------------------------------ seeded random */
  function hash(str) { var h = 1779033703 ^ str.length; for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
  function rng(seed) {
    var a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed == null ? Math.random() : seed));
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

  var RANDOM_POSES = ['stand', 'wave', 'point', 'thinking', 'arms-crossed', 'hands-on-hips', 'shrug', 'explain', 'walk', 'thumbs-up', 'raise-hand', 'hand-on-heart', 'present', 'fist-pump', 'listen'];
  var RANDOM_EXPR = ['happy', 'content', 'grinning', 'talking', 'neutral', 'thinking', 'skeptical', 'smug', 'surprised', 'laughing', 'focused', 'determined', 'wink'];
  var HAIR_BY_STYLE = { hijab: ['deep', 'moss', 'cream', 'charcoal', 'navy', 'maroon', 'sand', 'lilac', 'teal', 'mustard'] };

  function randomLook(r, opts) {
    opts = opts || {};
    var hair = pick(r, HAIR_STYLES), hairColor = HAIR_BY_STYLE[hair] ? pick(r, HAIR_BY_STYLE[hair]) : pick(r, r() < 0.8 ? ['black', 'darkbrown', 'brown', 'black', 'darkbrown'] : ['auburn', 'ginger', 'blonde', 'grey', 'white']);
    var palette = opts.brandOnly ? BRAND_TOPS : (r() < 0.65 ? BRAND_TOPS : EXTRA_TOPS);
    var look = {
      skin: pick(r, Object.keys(SKIN)), hair: hair, hairColor: hairColor,
      top: pick(r, ['tee', 'tee', 'hoodie', 'hoodie', 'blazer', 'sweater', 'jacket', 'dress', 'thobe', 'vest', 'jersey']),
      topColor: pick(r, palette), bottomColor: pick(r, BOTTOMS), number: Math.floor(r() * 99) + 1, facewear: [], bodywear: []
    };
    if (look.top === 'jacket') look.innerColor = pick(r, ['cream', 'white', 'neon', 'charcoal']);
    if (r() < 0.28) look.facewear.push(pick(r, ['glasses', 'roundglasses', 'glasses', 'sunglasses']));
    if (hair !== 'hijab' && r() < 0.18) look.facewear.push(pick(r, ['beard', 'stubble', 'mustache']));
    if (r() < 0.12) look.facewear.push(pick(r, ['earrings', 'freckles']));
    if (r() < 0.2 && hair !== 'hijab' && hair !== 'afro') { look.headwear = pick(r, ['cap', 'beanie', 'kufi', 'headphones', 'headband', 'beret', 'visor']); look.headwearColor = pick(r, BRAND_TOPS); }
    if (r() < 0.2) look.bodywear.push(pick(r, ['lanyard', 'scarf', 'pin', 'backpack', 'watch', look.top === 'blazer' ? 'tie' : 'watch']));
    if (look.bodywear.indexOf('scarf') >= 0) look.scarfColor = pick(r, ['neon', 'coral', 'mustard', 'cream', 'moss']);
    if (look.bodywear.indexOf('backpack') >= 0) look.backpackColor = pick(r, ['mustard', 'coral', 'navy', 'moss']);
    if (r() < 0.3) look.shoeAccent = true;
    if (look.topColor === 'neon' && look.skin === 'light' && r() < 0.5) look.accent = 'deep';
    return look;
  }
  function random(seed, overrides) {
    var r = rng(seed), look = randomLook(r, overrides);
    look.pose = pick(r, RANDOM_POSES); look.expression = pick(r, RANDOM_EXPR); look.look = 1;
    for (var k in overrides || {}) if (k !== 'brandOnly') look[k] = overrides[k];
    look.name = 'Random ' + String(seed);
    return look;
  }
  function crowd(count, seed, overrides) {
    var out = [];
    for (var i = 0; i < (count || 10); i++) out.push(random(String(seed == null ? 'crowd' : seed) + ':' + i, overrides));
    return out;
  }

  /* ------------------------------------------------------------------ the ready-made cast */
  // Each role has a fixed first version, plus variants with different people in the same role.
  var ROLES = [
    // --- debate
    ['debater', 'The Debater', 'debate', 'Leaning in and making the point.', { pose: 'point', expression: 'talking', top: 'hoodie', topColor: 'deep', skin: 'tan', hair: 'short', extras: ['sparks'] }],
    ['rebuttal', 'The Rebuttal', 'debate', 'Firing straight back, both hands going.', { pose: 'argue', expression: 'shouting', top: 'blazer', topColor: 'charcoal', skin: 'deep', hair: 'buzz', extras: ['bubble'], bubbleText: '!' }],
    ['calm-debater', 'The Calm Debater', 'debate', 'Explains it slowly and kindly. Still wins.', { pose: 'explain', expression: 'happy', top: 'sweater', topColor: 'cream', skin: 'brown', hair: 'hijab', hairColor: 'deep' }],
    ['opener', 'The Opener', 'debate', 'First speaker, sets the frame.', { pose: 'present', expression: 'talking', top: 'blazer', topColor: 'deep', skin: 'light', hair: 'sidepart', hairColor: 'darkbrown', bodywear: ['tie'] }],
    ['closer', 'The Closer', 'debate', 'Final word, arms folded, done.', { pose: 'arms-crossed', expression: 'smug', top: 'jacket', topColor: 'charcoal', innerColor: 'neon', skin: 'umber', hair: 'spiky' }],
    ['devils-advocate', "The Devil's Advocate", 'debate', 'Takes the other side on purpose.', { pose: 'shrug', expression: 'wink', top: 'tee', topColor: 'maroon', skin: 'golden', hair: 'curly', hairColor: 'black' }],
    ['challenger', 'The Challenger', 'debate', '"Debate me." Means it.', { prop: 'sign', signText: 'DEBATE ME', expression: 'determined', top: 'hoodie', topColor: 'neon', accent: 'deep', skin: 'brown', hair: 'afro' }],
    ['source-please', 'Source Please', 'debate', 'Holds up the only sign that matters.', { prop: 'sign', signText: 'SOURCE?', expression: 'skeptical', top: 'tee', topColor: 'charcoal', skin: 'porcelain', hair: 'bob', hairColor: 'ginger' }],
    ['change-my-mind', 'Change My Mind', 'debate', 'Open to being wrong. Supposedly.', { prop: 'sign', signText: 'CHANGE MY MIND', expression: 'smug', top: 'sweater', topColor: 'moss', skin: 'tan', hair: 'short', facewear: ['stubble'] }],
    ['agree', 'Agree', 'debate', 'Signs up for your side.', { prop: 'sign', signText: 'AGREE', propColor: 'neon', expression: 'grinning', top: 'tee', topColor: 'deep', skin: 'light', hair: 'ponytail', hairColor: 'blonde' }],
    ['disagree', 'Disagree', 'debate', 'Politely, firmly not convinced.', { prop: 'sign', signText: 'DISAGREE', propColor: 'coral', expression: 'determined', top: 'tee', topColor: 'charcoal', skin: 'deep', hair: 'locs' }],
    ['fact-checker', 'The Fact Checker', 'debate', 'Zooms in on every claim.', { prop: 'magnifier', expression: 'focused', top: 'vest', topColor: 'slate', skin: 'light', hair: 'sidepart', facewear: ['glasses'] }],
    ['fallacy-spotter', 'The Fallacy Spotter', 'debate', 'Caught one. Points at it.', { pose: 'point', expression: 'surprised', top: 'hoodie', topColor: 'mustard', skin: 'brown', hair: 'curly', extras: ['exclaim'] }],
    ['moderator', 'The Moderator', 'debate', 'Keeps the room fair.', { prop: 'mic', expression: 'talking', top: 'blazer', topColor: 'navy', skin: 'golden', hair: 'hijab', hairColor: 'charcoal', bodywear: ['lanyard'] }],
    ['timekeeper', 'The Timekeeper', 'debate', 'Thirty seconds. Twenty-nine.', { pose: 'thumbs-up', expression: 'focused', top: 'tee', topColor: 'cream', skin: 'umber', hair: 'buzz', bodywear: ['watch', 'lanyard'] }],
    ['interrupter', 'The Interrupter', 'debate', 'Hand already up before you finish.', { pose: 'raise-hand', expression: 'talking', top: 'hoodie', topColor: 'coral', skin: 'porcelain', hair: 'spiky', hairColor: 'auburn', extras: ['bubble'], bubbleText: 'But-' }],
    ['heckler', 'The Heckler', 'debate', 'Makes the most noise.', { prop: 'megaphone', expression: 'shouting', top: 'jersey', topColor: 'deep', number: 7, skin: 'tan', hair: 'short', headwear: 'cap', headwearColor: 'neon' }],
    ['peacemaker', 'The Peacemaker', 'debate', 'Both of you have a point.', { pose: 'shrug', expression: 'content', top: 'sweater', topColor: 'lilac', skin: 'light', hair: 'wavy', hairColor: 'brown' }],
    // --- reading + study
    ['bookworm', 'The Bookworm', 'reading', 'Nose in a book, world switched off.', { prop: 'book', expression: 'reading', top: 'sweater', topColor: 'moss', skin: 'porcelain', hair: 'bun', hairColor: 'auburn', facewear: ['roundglasses'] }],
    ['reader-in-the-zone', 'Reader in the Zone', 'reading', 'Headphones on, beanbag, gone.', { pose: 'sit-hold', prop: 'book', seat: 'beanbag', expression: 'content', top: 'hoodie', topColor: 'neon', accent: 'deep', skin: 'light', hair: 'long', hairColor: 'auburn', headwear: 'headphones' }],
    ['library-regular', 'The Library Regular', 'reading', 'Carries three books everywhere.', { prop: 'books', expression: 'happy', top: 'jacket', topColor: 'khaki', innerColor: 'cream', skin: 'brown', hair: 'sidepart', facewear: ['glasses'] }],
    ['note-taker', 'The Note Taker', 'reading', 'Writes down every good line.', { prop: 'notebook', expression: 'focused', top: 'tee', topColor: 'cream', skin: 'deep', hair: 'curly' }],
    ['annotator', 'The Annotator', 'reading', 'Margins full of opinions.', { pose: 'sit-think', expression: 'thinking', top: 'sweater', topColor: 'navy', skin: 'golden', hair: 'hijab', hairColor: 'moss', extras: ['idea'] }],
    ['scholar', 'The Scholar', 'reading', 'Reads the primary sources.', { prop: 'scroll', expression: 'content', top: 'thobe', topColor: 'white', skin: 'tan', hair: 'short', headwear: 'kufi', facewear: ['beard'] }],
    ['tablet-reader', 'The Tablet Reader', 'reading', 'Two hundred books in one hand.', { prop: 'tablet', expression: 'reading', top: 'hoodie', topColor: 'slate', skin: 'light', hair: 'pixie', hairColor: 'black' }],
    ['night-owl', 'The Night Owl', 'reading', 'One more chapter. Then sleep.', { pose: 'sit-type', prop: 'laptop', expression: 'sleepy', top: 'hoodie', topColor: 'charcoal', skin: 'umber', hair: 'afro', extras: ['zzz'] }],
    ['student', 'The Student', 'reading', 'Backpack, notes, ready.', { pose: 'wave', expression: 'grinning', top: 'tee', topColor: 'sky', skin: 'tan', hair: 'ponytail', bodywear: ['backpack'], backpackColor: 'coral' }],
    ['graduate', 'The Graduate', 'reading', 'Did the reading. All of it.', { pose: 'cheer', expression: 'laughing', top: 'robe', topColor: 'charcoal', skin: 'deep', hair: 'braids', headwear: 'grad' }],
    ['teacher', 'The Teacher', 'reading', 'Makes hard ideas simple.', { prop: 'pointer', expression: 'talking', top: 'blazer', topColor: 'moss', skin: 'porcelain', hair: 'bob', hairColor: 'grey', facewear: ['glasses'] }],
    ['book-reviewer', 'The Book Reviewer', 'reading', 'Five stars, with notes.', { prop: 'closedbook', expression: 'grinning', top: 'tee', topColor: 'neon', accent: 'deep', skin: 'brown', hair: 'short', extras: ['stars'] }],
    // --- thinking + listening
    ['thinker', 'The Thinker', 'thinking', 'Chin in hand, working it out.', { pose: 'thinking', expression: 'thinking', top: 'sweater', topColor: 'deep', skin: 'golden', hair: 'curly', extras: ['thought'] }],
    ['pacer', 'The Pacer', 'thinking', 'Walks while they think.', { pose: 'pace', expression: 'thinking', top: 'tee', topColor: 'moss', skin: 'light', hair: 'bun', hairColor: 'darkbrown', extras: ['thought'] }],
    ['lightbulb', 'The Lightbulb Moment', 'thinking', 'Just got it.', { pose: 'raise-hand', expression: 'amazed', top: 'hoodie', topColor: 'cream', skin: 'umber', hair: 'locs', extras: ['idea'] }],
    ['listener', 'The Listener', 'thinking', 'Actually hears you out.', { pose: 'listen', expression: 'content', top: 'tee', topColor: 'neon', accent: 'deep', skin: 'brown', hair: 'long', hairColor: 'darkbrown' }],
    ['skeptic', 'The Skeptic', 'thinking', 'Arms folded. Not sold yet.', { pose: 'arms-crossed', expression: 'skeptical', top: 'jacket', topColor: 'slate', innerColor: 'cream', skin: 'tan', hair: 'sidepart', facewear: ['stubble'] }],
    ['confused', 'The Confused One', 'thinking', 'Wait, which side are we on?', { pose: 'shrug', expression: 'confused', top: 'tee', topColor: 'lilac', skin: 'porcelain', hair: 'wavy', hairColor: 'blonde', extras: ['question'] }],
    ['overthinker', 'The Overthinker', 'thinking', 'Has considered every angle. Twice.', { pose: 'sit-think', expression: 'nervous', top: 'sweater', topColor: 'teal', skin: 'deep', hair: 'short', extras: ['sweat'] }],
    ['daydreamer', 'The Daydreamer', 'thinking', 'Somewhere else entirely.', { pose: 'hands-behind', expression: 'content', top: 'dress', topColor: 'sky', skin: 'light', hair: 'braids', hairColor: 'auburn', extras: ['notes'] }],
    ['open-minded', 'The Open Mind', 'thinking', 'Hand on heart, willing to change.', { pose: 'hand-on-heart', expression: 'content', top: 'tee', topColor: 'cream', skin: 'golden', hair: 'hijab', hairColor: 'lilac' }],
    ['question-asker', 'The Question Asker', 'thinking', 'Always one more question.', { pose: 'raise-hand', expression: 'surprised', top: 'hoodie', topColor: 'deep', skin: 'tan', hair: 'pixie', extras: ['question'] }],
    // --- audience + reactions
    ['audience-shocked', 'Shocked Audience', 'reaction', 'Did they really just say that?', { pose: 'stand', expression: 'shocked', top: 'tee', topColor: 'charcoal', skin: 'light', hair: 'curly', hairColor: 'brown', extras: ['exclaim'] }],
    ['audience-laughing', 'Laughing Audience', 'reaction', 'Couldn\'t hold it in.', { pose: 'hands-on-hips', expression: 'laughing', top: 'sweater', topColor: 'mustard', skin: 'deep', hair: 'afro' }],
    ['facepalm', 'The Facepalm', 'reaction', 'That argument hurt.', { pose: 'facepalm', expression: 'sad', top: 'hoodie', topColor: 'slate', skin: 'tan', hair: 'short' }],
    ['hype', 'The Hype Person', 'reaction', 'Every point is the best point.', { pose: 'fist-pump', expression: 'grinning', top: 'jersey', topColor: 'neon', accent: 'deep', number: 1, skin: 'brown', hair: 'spiky', extras: ['sparks'] }],
    ['clapper', 'The Supporter', 'reaction', 'Thumbs up for a good point.', { pose: 'thumbs-up', expression: 'happy', top: 'tee', topColor: 'moss', skin: 'porcelain', hair: 'ponytail', hairColor: 'ginger', facewear: ['freckles'] }],
    ['angry', 'Big Mad', 'reaction', 'Took it personally.', { pose: 'hands-on-hips', expression: 'angry', top: 'hoodie', topColor: 'maroon', skin: 'umber', hair: 'buzz', extras: ['steam'] }],
    ['nervous', 'The Nervous One', 'reaction', 'Up next. Slightly sweating.', { pose: 'hands-behind', expression: 'nervous', top: 'blazer', topColor: 'navy', skin: 'light', hair: 'sidepart', hairColor: 'blonde', bodywear: ['bowtie'], extras: ['sweat'] }],
    ['sad', 'The Sad One', 'reaction', 'Lost the round.', { pose: 'stand', expression: 'sad', top: 'sweater', topColor: 'steel', skin: 'golden', hair: 'long', hairColor: 'black' }],
    ['sleepy', 'The Sleepy One', 'reaction', 'This round is taking a while.', { pose: 'stand', expression: 'sleepy', top: 'hoodie', topColor: 'lilac', skin: 'tan', hair: 'bob', extras: ['zzz'] }],
    ['fan', 'The Fan', 'reaction', 'Loves a good argument.', { pose: 'hand-on-heart', expression: 'content', top: 'tee', topColor: 'coral', skin: 'brown', hair: 'curly', extras: ['hearts'] }],
    ['scroller', 'The Scroller', 'reaction', 'Watching the debate on their phone.', { prop: 'phone', expression: 'scrolling', top: 'hoodie', topColor: 'charcoal', skin: 'light', hair: 'short', headwear: 'beanie', headwearColor: 'neon' }],
    ['lol-at-phone', 'Laughing at the Replay', 'reaction', 'Rewatched the best bit.', { prop: 'phone', expression: 'laughing', top: 'tee', topColor: 'neon', accent: 'deep', skin: 'deep', hair: 'braids' }],
    // --- winning + events
    ['champion', 'The Champion', 'winning', 'Rank 10. Trophy up.', { prop: 'trophy', expression: 'laughing', top: 'blazer', topColor: 'deep', skin: 'tan', hair: 'short', headwear: 'crown', bodywear: ['medal'] }],
    ['winner', 'The Winner', 'winning', 'Won the round. Knows it.', { pose: 'celebrate', expression: 'grinning', top: 'hoodie', topColor: 'neon', accent: 'deep', skin: 'umber', hair: 'afro', extras: ['stars'] }],
    ['good-loser', 'The Good Sport', 'winning', 'Lost, waves anyway.', { pose: 'wave', expression: 'happy', top: 'tee', topColor: 'cream', skin: 'light', hair: 'wavy', hairColor: 'darkbrown' }],
    ['runner-up', 'The Runner-Up', 'winning', 'Next time.', { pose: 'shrug', expression: 'smug', top: 'jacket', topColor: 'navy', innerColor: 'cream', skin: 'brown', hair: 'locs', bodywear: ['medal'] }],
    ['flag-bearer', 'The Flag Bearer', 'winning', 'Carries the Majlis flag.', { prop: 'flag', expression: 'grinning', top: 'tee', topColor: 'deep', skin: 'golden', hair: 'hijab', hairColor: 'cream' }],
    ['birthday', 'The Celebration', 'winning', 'One year on Majlis.', { prop: 'balloon', expression: 'laughing', top: 'dress', topColor: 'mustard', skin: 'deep', hair: 'bun', extras: ['stars'] }],
    ['newcomer', 'The Newcomer', 'winning', 'First debate. Says hi.', { pose: 'wave', expression: 'grinning', top: 'hoodie', topColor: 'sky', skin: 'porcelain', hair: 'curly', hairColor: 'ginger', extras: ['bubble'], bubbleText: 'Hi!' }],
    ['rank-up', 'Rank Up', 'winning', 'Climbed a rank today.', { pose: 'fist-pump', expression: 'proud', top: 'jersey', topColor: 'deep', number: 10, skin: 'light', hair: 'buzz', extras: ['sparks'] }],
    // --- hosts + makers
    ['host', 'The Host', 'hosts', 'Welcome to the Majlis.', { prop: 'mic', expression: 'grinning', top: 'blazer', topColor: 'charcoal', skin: 'brown', hair: 'sidepart', bodywear: ['bowtie'], tieColor: 'neon' }],
    ['interviewer', 'The Interviewer', 'hosts', 'Asks the follow-up.', { prop: 'mic', expression: 'talking', top: 'sweater', topColor: 'cream', skin: 'light', hair: 'bob', hairColor: 'auburn' }],
    ['announcer', 'The Announcer', 'hosts', 'The debate starts NOW.', { prop: 'megaphone', expression: 'shouting', top: 'hoodie', topColor: 'deep', skin: 'deep', hair: 'short', headwear: 'visor', headwearColor: 'neon' }],
    ['presenter', 'The Presenter', 'hosts', 'Here are the results.', { pose: 'present', expression: 'talking', top: 'blazer', topColor: 'slate', skin: 'golden', hair: 'long', hairColor: 'black', bodywear: ['pin'] }],
    ['journalist', 'The Journalist', 'hosts', 'Writing up the verdict.', { prop: 'notebook', expression: 'talking', top: 'jacket', topColor: 'khaki', innerColor: 'white', skin: 'tan', hair: 'ponytail', bodywear: ['lanyard'] }],
    ['streamer', 'The Streamer', 'hosts', 'Live from the arena.', { pose: 'sit-wave', expression: 'grinning', top: 'hoodie', topColor: 'neon', accent: 'deep', skin: 'umber', hair: 'spiky', headwear: 'headphones', extras: ['bubble'], bubbleText: 'LIVE', bubbleColor: 'red' }],
    ['tiktoker', 'The TikToker', 'hosts', 'Filming the hot take.', { prop: 'phone', pose: 'phone', expression: 'talking', top: 'tee', topColor: 'charcoal', skin: 'light', hair: 'pixie', hairColor: 'neon', extras: ['sparks'] }],
    ['coder', 'The Builder', 'hosts', 'Shipping the next update.', { pose: 'sit-type', prop: 'laptop', expression: 'focused', top: 'hoodie', topColor: 'slate', skin: 'tan', hair: 'short', headwear: 'headphones' }],
    ['barista', 'The Coffee Break', 'hosts', 'Recharging between rounds.', { prop: 'coffee', expression: 'content', top: 'sweater', topColor: 'khaki', skin: 'brown', hair: 'wavy', hairColor: 'black' }],
    ['judge-human', 'The Human Judge', 'hosts', 'Order in the Majlis.', { prop: 'gavel', expression: 'neutral', top: 'robe', topColor: 'charcoal', skin: 'deep', hair: 'bald', facewear: ['glasses', 'beard'], hairColor: 'grey' }],
    ['elder', 'The Elder', 'hosts', 'Has seen every argument before.', { pose: 'hands-behind', expression: 'content', top: 'thobe', topColor: 'cream', skin: 'tan', hair: 'bald', hairColor: 'white', facewear: ['beard'], headwear: 'kufi' }],
    ['walker', 'On the Way', 'hosts', 'Heading to the next debate.', { pose: 'walk', expression: 'happy', top: 'jacket', topColor: 'moss', innerColor: 'cream', skin: 'porcelain', hair: 'short', hairColor: 'blonde', bodywear: ['backpack'], extras: ['motion'] }],
    ['music-fan', 'Music On', 'hosts', 'Walking to the beat.', { pose: 'walk', expression: 'content', top: 'hoodie', topColor: 'lilac', skin: 'deep', hair: 'afro', headwear: 'headphones', extras: ['notes'] }],
    ['approver', 'The Approver', 'hosts', 'Checked and approved.', { prop: 'paper', expression: 'happy', top: 'vest', topColor: 'deep', skin: 'golden', hair: 'curly', facewear: ['glasses'], extras: ['check'] }],
    ['reacher', 'The Reacher', 'hosts', 'Reaching for the next idea.', { pose: 'reach', expression: 'determined', top: 'tee', topColor: 'teal', skin: 'light', hair: 'ponytail', hairColor: 'brown' }]
  ];
  var ROBOTS = [
    ['ai-judge', 'The AI Judge', 'robots', 'Gavel up. Verdict ready.', { kind: 'robot', arm: 'gavel', screen: 'mline' }],
    ['ai-thinking', 'AI Thinking', 'robots', 'Weighing both sides.', { kind: 'robot', arm: 'rdown', screen: 'loading', extras: ['thought'] }],
    ['ai-approves', 'AI Approves', 'robots', 'Strong argument.', { kind: 'robot', arm: 'wave', screen: 'check' }],
    ['ai-rejects', 'AI Rejects', 'robots', 'That was a fallacy.', { kind: 'robot', arm: 'point', screen: 'cross' }],
    ['ai-confused', 'AI Confused', 'robots', 'Please rephrase.', { kind: 'robot', arm: 'rdown', screen: 'question' }],
    ['ai-happy', 'AI Happy', 'robots', 'Great debate, both of you.', { kind: 'robot', arm: 'wave', screen: 'happy', leftArm: 'up' }],
    ['ai-helper', 'AI Helper', 'robots', 'Here to help.', { kind: 'robot', arm: 'wave', screen: 'eyes' }],
    ['ai-clipboard', 'AI Scorekeeper', 'robots', 'Keeping score.', { kind: 'robot', arm: 'clipboard', screen: 'eyes' }],
    ['ai-love', 'AI Loves This', 'robots', 'Favourite debate of the day.', { kind: 'robot', arm: 'rdown', screen: 'heart', extras: ['hearts'] }],
    ['ai-live', 'AI Live', 'robots', 'Judging live.', { kind: 'robot', arm: 'point', screen: 'text', screenText: 'LIVE' }]
  ];
  var ROBOT_SKINS = [
    { suffix: '', name: '', o: {} },
    { suffix: '-dark', name: ' (dark)', o: { bodyColor: COLORS.steel, bodyColor2: COLORS.slate } },
    { suffix: '-neon', name: ' (neon)', o: { bodyColor: COLORS.neon, bodyColor2: COLORS.mint, glowColor: COLORS.neon } },
    { suffix: '-cream', name: ' (cream)', o: { bodyColor: COLORS.cream, bodyColor2: COLORS.sand } }
  ];
  var VARIANTS_PER_ROLE = 4;

  var META = {}, SPECS = {}, ORDER = [];
  function register(id, name, role, desc, spec, variantOf) {
    var tags = [role].concat(spec.prop ? [spec.prop] : [], spec.pose ? [spec.pose] : [], spec.expression ? [spec.expression] : [], spec.kind === 'robot' ? ['robot', 'ai'] : []);
    spec.name = name;
    META[id] = { id: id, name: name, role: role, tags: tags, description: desc, variantOf: variantOf || null };
    SPECS[id] = spec; ORDER.push(id);
  }
  ROLES.forEach(function (row) {
    var id = row[0], name = row[1], role = row[2], desc = row[3], base = row[4];
    register(id, name, role, desc, base);
    for (var v = 2; v <= VARIANTS_PER_ROLE; v++) {
      var r = rng(id + '#' + v), look = randomLook(r), spec = {}, k;
      // keep what makes the role (pose, prop, expression, extras, sign text), change the person
      for (k in look) spec[k] = look[k];
      ['pose', 'prop', 'expression', 'extras', 'signText', 'bubbleText', 'bubbleColor', 'seat', 'propColor'].forEach(function (key) { if (base[key] !== undefined) spec[key] = base[key]; });
      if (base.headwear === 'crown' || base.headwear === 'grad' || base.headwear === 'headphones') { spec.headwear = base.headwear; if (spec.hair === 'hijab' && base.headwear !== 'headphones') spec.headwear = null; }
      if (base.top === 'robe') spec.top = 'robe';
      if (base.bodywear && base.bodywear.indexOf('medal') >= 0) spec.bodywear = spec.bodywear.concat(['medal']);
      if (base.bodywear && base.bodywear.indexOf('backpack') >= 0 && spec.bodywear.indexOf('backpack') < 0) spec.bodywear = spec.bodywear.concat(['backpack']);
      if (base.bodywear && base.bodywear.indexOf('lanyard') >= 0 && spec.bodywear.indexOf('lanyard') < 0) spec.bodywear = spec.bodywear.concat(['lanyard']);
      if (spec.headwear === 'kufi' && base.headwear !== 'kufi' && r() < 0.5) spec.headwear = null;
      register(id + '-' + v, name + ' ' + v, role, desc, spec, id);
    }
  });
  ROBOTS.forEach(function (row) {
    ROBOT_SKINS.forEach(function (skin) {
      var spec = {}, k;
      for (k in row[4]) spec[k] = row[4][k];
      for (k in skin.o) spec[k] = skin.o[k];
      register(row[0] + skin.suffix, row[1] + skin.name, row[2], row[3], spec, skin.suffix ? row[0] : null);
    });
  });

  /* ------------------------------------------------------------------ ready-made scenes */
  var SCENES = {
    debate: { name: 'Two debaters', figures: [{ character: 'debater' }, { character: 'calm-debater', flip: true, gap: 30 }] },
    'heated-debate': { name: 'Heated debate', figures: [{ character: 'rebuttal' }, { character: 'closer', flip: true, gap: 40 }] },
    'judged-debate': { name: 'Debate with the AI judge', overlap: 30, figures: [{ character: 'debater' }, { character: 'ai-judge', gap: 10 }, { character: 'calm-debater', flip: true, gap: 10 }] },
    verdict: { name: 'The verdict', figures: [{ character: 'ai-approves' }, { character: 'winner', gap: 20 }] },
    'study-group': { name: 'Study group', figures: [{ character: 'bookworm' }, { character: 'note-taker', gap: 10 }, { character: 'thinker', flip: true, gap: 10 }] },
    audience: { name: 'The audience', overlap: 60, figures: [{ character: 'audience-shocked' }, { character: 'hype' }, { character: 'audience-laughing' }, { character: 'skeptic', flip: true }] },
    interview: { name: 'Interview', figures: [{ character: 'interviewer' }, { character: 'thinker', flip: true, gap: 30 }] },
    podcast: { name: 'Podcast', figures: [{ character: 'host' }, { character: 'listener', flip: true, gap: 40 }] },
    classroom: { name: 'Classroom', figures: [{ character: 'teacher' }, { character: 'question-asker', gap: 30 }, { character: 'student', gap: 10 }] },
    podium: { name: 'Winners', overlap: 20, figures: [{ character: 'runner-up', scale: 0.92 }, { character: 'champion' }, { character: 'good-loser', flip: true, scale: 0.92 }] },
    protest: { name: 'Sign squad', overlap: -12, figures: [{ character: 'source-please' }, { character: 'change-my-mind' }, { character: 'agree' }] },
    'late-night': { name: 'Late night study', figures: [{ character: 'night-owl' }, { character: 'reader-in-the-zone', gap: 30 }] },
    'fact-check': { name: 'Fact check', figures: [{ character: 'fact-checker' }, { character: 'ai-rejects', gap: 20 }] },
    newcomers: { name: 'Welcome', figures: [{ character: 'newcomer' }, { character: 'host', flip: true, gap: 20 }] },
    'the-majlis': { name: 'The Majlis', overlap: 50, figures: [{ character: 'elder' }, { character: 'scholar' }, { character: 'moderator' }, { character: 'bookworm' }, { character: 'debater' }] }
  };

  /* ------------------------------------------------------------------ the 8 original stickers */
  var CLASSICS = {"debaters": {"title": "Two debaters", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"640\" height=\"430\" viewBox=\"0 0 640 430\" style=\"overflow: visible; display: block\"><defs><filter id=\"cut-debaters\" x=\"-20%\" y=\"-20%\" width=\"140%\" height=\"140%\"><feMorphology in=\"SourceAlpha\" operator=\"dilate\" radius=\"8\" result=\"d\"/><feFlood flood-color=\"#F2EFE6\"/><feComposite in2=\"d\" operator=\"in\" result=\"edge\"/><feDropShadow in=\"edge\" dx=\"0\" dy=\"6\" stdDeviation=\"6\" flood-color=\"#000\" flood-opacity=\"0.35\" result=\"sh\"/><feMerge><feMergeNode in=\"sh\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter></defs><g filter=\"url(#cut-debaters)\"><path d=\"M 150,318 L 138,400\" fill=\"none\" stroke=\"#1E2622\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 182,318 L 204,398\" fill=\"none\" stroke=\"#1E2622\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"114\" y=\"395\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><rect x=\"198\" y=\"393\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><path d=\"M 141.0,176 L 207.0,176 Q 217.0,176 211.0,202 L 207.0,326 L 125.0,326 L 122.6,202 Q 131.0,176 141.0,176 Z\" fill=\"#145C36\"/><path d=\"M 140,196 L 122,250 L 116,296\" fill=\"none\" stroke=\"#145C36\" stroke-width=\"24\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"116\" cy=\"304\" r=\"11\" fill=\"#D39A6E\"/><path d=\"M 192,194 L 240,214 L 286,196\" fill=\"none\" stroke=\"#145C36\" stroke-width=\"24\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"292\" cy=\"194\" r=\"11\" fill=\"#D39A6E\"/><path d=\"M 296,192 l 22,-6\" fill=\"none\" stroke=\"#D39A6E\" stroke-width=\"9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 150,176 Q 172,196 196,176\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"176\" cy=\"132\" r=\"30\" fill=\"#D39A6E\"/><path d=\"M 145,130 Q 142,94 176,95 Q 206,94 208,124 Q 190,110 170,114 Q 156,118 145,130 Z\" fill=\"#17110D\"/><circle cx=\"176\" cy=\"134\" r=\"3.4\" fill=\"#0B0F0C\"/><circle cx=\"192\" cy=\"134\" r=\"3.4\" fill=\"#0B0F0C\"/><ellipse cx=\"184\" cy=\"149\" rx=\"6.5\" ry=\"7.5\" fill=\"#0B0F0C\"/><path d=\"M 440,318 L 428,400\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 472,318 L 486,400\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"402\" y=\"395\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><rect x=\"480\" y=\"395\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><path d=\"M 417.0,176 L 483.0,176 Q 493.0,176 501.0,202 L 497.0,326 L 415.0,326 L 409.8,202 Q 407.0,176 417.0,176 Z\" fill=\"#F2EFE6\"/><path d=\"M 424,196 L 380,226 L 362,188\" fill=\"none\" stroke=\"#F2EFE6\" stroke-width=\"24\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"360\" cy=\"182\" r=\"11\" fill=\"#6B4028\"/><path d=\"M 488,196 L 520,244 L 534,206\" fill=\"none\" stroke=\"#F2EFE6\" stroke-width=\"24\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"536\" cy=\"200\" r=\"11\" fill=\"#6B4028\"/><path d=\"M 438,176 Q 456,190 474,176\" fill=\"none\" stroke=\"#239F5C\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 416,134 Q 412,88 456,88 Q 500,88 496,134 Q 500,176 474,190 L 438,190 Q 412,176 416,134 Z\" fill=\"#17110D\"/><circle cx=\"456\" cy=\"132\" r=\"30\" fill=\"#6B4028\"/><path d=\"M 424,130 Q 426,96 456,96 Q 486,96 488,130 Q 474,108 456,108 Q 438,108 424,130 Z\" fill=\"#17110D\"/><circle cx=\"442\" cy=\"134\" r=\"3.4\" fill=\"#0B0F0C\"/><circle cx=\"458\" cy=\"134\" r=\"3.4\" fill=\"#0B0F0C\"/><path d=\"M 445,148 h 10\" fill=\"none\" stroke=\"#0B0F0C\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 318,118 L 326,96\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 338,128 L 356,116\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 300,128 L 284,116\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"96\" y=\"18\" width=\"108\" height=\"72\" rx=\"26\" fill=\"#00FF66\"/><path d=\"M 110,88 L 102,116 L 140,88 Z\" fill=\"#00FF66\"/><text x=\"150.0\" y=\"72.72\" text-anchor=\"middle\" font-family=\"Poppins, sans-serif\" font-weight=\"700\" font-size=\"52\" fill=\"#0B0F0C\">!</text><rect x=\"430\" y=\"18\" width=\"108\" height=\"72\" rx=\"26\" fill=\"#F2EFE6\"/><path d=\"M 496,88 L 532,116 L 526,88 Z\" fill=\"#F2EFE6\"/><text x=\"484.0\" y=\"72.72\" text-anchor=\"middle\" font-family=\"Poppins, sans-serif\" font-weight=\"700\" font-size=\"52\" fill=\"#0B0F0C\">?</text></g></svg>"}, "reader": {"title": "Reader in the zone", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"460\" height=\"420\" viewBox=\"0 0 460 420\" style=\"overflow: visible; display: block\"><defs><filter id=\"cut-reader\" x=\"-20%\" y=\"-20%\" width=\"140%\" height=\"140%\"><feMorphology in=\"SourceAlpha\" operator=\"dilate\" radius=\"8\" result=\"d\"/><feFlood flood-color=\"#F2EFE6\"/><feComposite in2=\"d\" operator=\"in\" result=\"edge\"/><feDropShadow in=\"edge\" dx=\"0\" dy=\"6\" stdDeviation=\"6\" flood-color=\"#000\" flood-opacity=\"0.35\" result=\"sh\"/><feMerge><feMergeNode in=\"sh\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter></defs><g filter=\"url(#cut-reader)\"><circle cx=\"230\" cy=\"236\" r=\"178\" fill=\"#0B0F0C\"/><circle cx=\"230\" cy=\"236\" r=\"178\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"3\" stroke-dasharray=\"4 14\" stroke-linecap=\"round\"/><path d=\"M 20,90 q 12,-14 24,0 t 24,0 t 24,0\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 8,250 q 12,-14 24,0 t 24,0 t 24,0\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 420,110 q -12,-14 -24,0 t -24,0 t -24,0\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 436,290 q -12,-14 -24,0 t -24,0 t -24,0\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 96,356 Q 92,268 180,262 L 300,262 Q 376,270 372,356 Q 360,392 234,392 Q 108,392 96,356 Z\" fill=\"#145C36\"/><path d=\"M 196,318 L 262,336 L 300,322\" fill=\"none\" stroke=\"#1E2622\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 250,318 L 192,340 L 164,326\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 194.0,196 L 258.0,196 Q 268.0,196 270.0,222 L 266.0,324 L 186.0,324 L 182.0,222 Q 184.0,196 194.0,196 Z\" fill=\"#00FF66\"/><rect x=\"186\" y=\"142\" width=\"22\" height=\"62\" rx=\"11\" fill=\"#7A3B1C\"/><rect x=\"244\" y=\"142\" width=\"22\" height=\"62\" rx=\"11\" fill=\"#7A3B1C\"/><circle cx=\"226\" cy=\"150\" r=\"30\" fill=\"#F2C9A6\"/><path d=\"M 195,152 Q 196,112 228,113 Q 259,114 257,152 Q 248,130 228,128 Q 208,130 195,152 Z\" fill=\"#7A3B1C\"/><path d=\"M 215,152 q 4,4 8,0 M 231,152 q 4,4 8,0\" fill=\"none\" stroke=\"#0B0F0C\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 221,165 q 6,6 12,0\" fill=\"none\" stroke=\"#0B0F0C\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 192,146 Q 190,96 226,96 Q 262,96 260,146\" fill=\"none\" stroke=\"#0B0F0C\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"184\" y=\"138\" width=\"16\" height=\"28\" rx=\"7\" fill=\"#0B0F0C\"/><rect x=\"252\" y=\"138\" width=\"16\" height=\"28\" rx=\"7\" fill=\"#0B0F0C\"/><path d=\"M 196,214 L 186,262 L 204,272\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 256,214 L 266,262 L 248,272\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 226,256 L 172,240 L 172,292 L 226,306 Z\" fill=\"#F2EFE6\"/><path d=\"M 226,256 L 280,240 L 280,292 L 226,306 Z\" fill=\"#E2DDD0\"/><path d=\"M 226,256 L 226,306\" fill=\"none\" stroke=\"#239F5C\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 182,256 L 216,265\" fill=\"none\" stroke=\"#B9B4A7\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 182,266 L 216,275\" fill=\"none\" stroke=\"#B9B4A7\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 236,265 L 270,256\" fill=\"none\" stroke=\"#B9B4A7\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 236,275 L 270,266\" fill=\"none\" stroke=\"#B9B4A7\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"184\" cy=\"280\" r=\"11\" fill=\"#F2C9A6\"/><circle cx=\"268\" cy=\"280\" r=\"11\" fill=\"#F2C9A6\"/></g></svg>"}, "note-taker": {"title": "Taking notes", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"440\" height=\"420\" viewBox=\"0 0 440 420\" style=\"overflow: visible; display: block\"><defs><filter id=\"cut-notes\" x=\"-20%\" y=\"-20%\" width=\"140%\" height=\"140%\"><feMorphology in=\"SourceAlpha\" operator=\"dilate\" radius=\"8\" result=\"d\"/><feFlood flood-color=\"#F2EFE6\"/><feComposite in2=\"d\" operator=\"in\" result=\"edge\"/><feDropShadow in=\"edge\" dx=\"0\" dy=\"6\" stdDeviation=\"6\" flood-color=\"#000\" flood-opacity=\"0.35\" result=\"sh\"/><feMerge><feMergeNode in=\"sh\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter></defs><g filter=\"url(#cut-notes)\"><rect x=\"92\" y=\"286\" width=\"84\" height=\"16\" rx=\"8\" fill=\"#3A4540\"/><path d=\"M 104,300 L 98,390\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"10\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 164,300 L 170,390\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"10\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"206\" y=\"236\" width=\"206\" height=\"18\" rx=\"9\" fill=\"#239F5C\"/><path d=\"M 226,252 L 226,392\" fill=\"none\" stroke=\"#239F5C\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 392,252 L 392,392\" fill=\"none\" stroke=\"#239F5C\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 150,290 L 226,294 L 232,374\" fill=\"none\" stroke=\"#1E2622\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"228\" y=\"371\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><path d=\"M 130.0,168 L 190.0,168 Q 200.0,168 188.0,194 L 184.0,292 L 108.0,292 L 106.8,194 Q 120.0,168 130.0,168 Z\" fill=\"#F2EFE6\"/><circle cx=\"176\" cy=\"124\" r=\"30\" fill=\"#A0663F\"/><circle cx=\"152\" cy=\"110\" r=\"12\" fill=\"#17110D\"/><circle cx=\"162\" cy=\"96\" r=\"12\" fill=\"#17110D\"/><circle cx=\"178\" cy=\"91\" r=\"12\" fill=\"#17110D\"/><circle cx=\"194\" cy=\"96\" r=\"12\" fill=\"#17110D\"/><circle cx=\"203\" cy=\"110\" r=\"12\" fill=\"#17110D\"/><circle cx=\"147\" cy=\"126\" r=\"12\" fill=\"#17110D\"/><circle cx=\"205\" cy=\"124\" r=\"12\" fill=\"#17110D\"/><circle cx=\"176\" cy=\"126\" r=\"3.4\" fill=\"#0B0F0C\"/><circle cx=\"192\" cy=\"126\" r=\"3.4\" fill=\"#0B0F0C\"/><path d=\"M 179,140 h 10\" fill=\"none\" stroke=\"#0B0F0C\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 262,236 L 272,214 L 360,214 L 350,236 Z\" fill=\"#FFFFFF\"/><path d=\"M 282,222 L 342,222\" fill=\"none\" stroke=\"#C9C4B8\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 278,229 L 338,229\" fill=\"none\" stroke=\"#C9C4B8\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 170,188 L 236,214 L 286,216\" fill=\"none\" stroke=\"#F2EFE6\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"292\" cy=\"214\" r=\"11\" fill=\"#A0663F\"/><path d=\"M 288,212 L 318,184\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 150,192 L 206,230 L 262,230\" fill=\"none\" stroke=\"#F2EFE6\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"264\" cy=\"230\" r=\"11\" fill=\"#A0663F\"/><circle cx=\"270\" cy=\"90\" r=\"26\" fill=\"#00FF66\"/><rect x=\"258\" y=\"112\" width=\"24\" height=\"16\" rx=\"5\" fill=\"#0B0F0C\"/><path d=\"M 270,40 L 270,52\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 226,70 L 236,76\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 314,70 L 304,76\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g></svg>"}, "pacing-thinker": {"title": "Pacing, thinking", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"460\" height=\"420\" viewBox=\"0 0 460 420\" style=\"overflow: visible; display: block\"><defs><filter id=\"cut-pacer\" x=\"-20%\" y=\"-20%\" width=\"140%\" height=\"140%\"><feMorphology in=\"SourceAlpha\" operator=\"dilate\" radius=\"8\" result=\"d\"/><feFlood flood-color=\"#F2EFE6\"/><feComposite in2=\"d\" operator=\"in\" result=\"edge\"/><feDropShadow in=\"edge\" dx=\"0\" dy=\"6\" stdDeviation=\"6\" flood-color=\"#000\" flood-opacity=\"0.35\" result=\"sh\"/><feMerge><feMergeNode in=\"sh\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter></defs><g filter=\"url(#cut-pacer)\"><path d=\"M 206,300 L 170,346 L 150,392\" fill=\"none\" stroke=\"#1E2622\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"124\" y=\"387\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><path d=\"M 226,300 L 254,348 L 286,390\" fill=\"none\" stroke=\"#1E2622\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"282\" y=\"385\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><path d=\"M 206,184 L 176,240 L 196,262\" fill=\"none\" stroke=\"#239F5C\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 192.0,168 L 252.0,168 Q 262.0,168 258.0,194 L 254.0,306 L 178.0,306 L 175.2,194 Q 182.0,168 192.0,168 Z\" fill=\"#239F5C\"/><circle cx=\"222\" cy=\"122\" r=\"30\" fill=\"#F2C9A6\"/><circle cx=\"218\" cy=\"84\" r=\"13\" fill=\"#3B2415\"/><path d=\"M 191,120 Q 190,86 222,87 Q 253,87 253,118 Q 232,102 191,120 Z\" fill=\"#3B2415\"/><circle cx=\"222\" cy=\"124\" r=\"3.4\" fill=\"#0B0F0C\"/><circle cx=\"238\" cy=\"124\" r=\"3.4\" fill=\"#0B0F0C\"/><circle cx=\"230\" cy=\"138\" r=\"3.8\" fill=\"#0B0F0C\"/><path d=\"M 234,186 L 272,222 L 244,158\" fill=\"none\" stroke=\"#239F5C\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"242\" cy=\"152\" r=\"11\" fill=\"#F2C9A6\"/><circle cx=\"300\" cy=\"96\" r=\"9\" fill=\"#F2EFE6\"/><circle cx=\"318\" cy=\"74\" r=\"13\" fill=\"#F2EFE6\"/><rect x=\"300\" y=\"12\" width=\"136\" height=\"60\" rx=\"30\" fill=\"#F2EFE6\"/><path d=\"M 318,52 H 350 V 30 L 368,46 L 386,30 V 52 H 418\" fill=\"none\" stroke=\"#145C36\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g></svg>"}, "laptop": {"title": "Working on it", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"460\" height=\"420\" viewBox=\"0 0 460 420\" style=\"overflow: visible; display: block\"><defs><filter id=\"cut-laptop\" x=\"-20%\" y=\"-20%\" width=\"140%\" height=\"140%\"><feMorphology in=\"SourceAlpha\" operator=\"dilate\" radius=\"8\" result=\"d\"/><feFlood flood-color=\"#F2EFE6\"/><feComposite in2=\"d\" operator=\"in\" result=\"edge\"/><feDropShadow in=\"edge\" dx=\"0\" dy=\"6\" stdDeviation=\"6\" flood-color=\"#000\" flood-opacity=\"0.35\" result=\"sh\"/><feMerge><feMergeNode in=\"sh\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter></defs><g filter=\"url(#cut-laptop)\"><rect x=\"60\" y=\"292\" width=\"100\" height=\"16\" rx=\"8\" fill=\"#3A4540\"/><path d=\"M 74,306 L 68,392\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"10\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 148,306 L 154,392\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"10\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"200\" y=\"256\" width=\"220\" height=\"18\" rx=\"9\" fill=\"#145C36\"/><path d=\"M 222,272 L 222,392\" fill=\"none\" stroke=\"#145C36\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 398,272 L 398,392\" fill=\"none\" stroke=\"#145C36\" stroke-width=\"12\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 116,294 L 196,300 L 202,380\" fill=\"none\" stroke=\"#1E2622\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"198\" y=\"377\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><path d=\"M 91.0,170 L 153.0,170 Q 163.0,170 155.0,196 L 151.0,298 L 73.0,298 L 71.0,196 Q 81.0,170 91.0,170 Z\" fill=\"#2B3A33\"/><circle cx=\"130\" cy=\"124\" r=\"30\" fill=\"#D39A6E\"/><circle cx=\"130\" cy=\"126\" r=\"3.4\" fill=\"#0B0F0C\"/><circle cx=\"146\" cy=\"126\" r=\"3.4\" fill=\"#0B0F0C\"/><path d=\"M 132,139 q 6,6 12,0\" fill=\"none\" stroke=\"#0B0F0C\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 100,110 Q 112,84 136,90\" fill=\"none\" stroke=\"#17110D\" stroke-width=\"0\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 262,256 L 244,168 L 362,168 L 380,256 Z\" fill=\"#0B0F0C\"/><path d=\"M 256,244 L 242,180 L 352,180 L 366,244 Z\" fill=\"#00FF66\" opacity=\"0.9\"/><path d=\"M 272,208 H 290 V 196 L 302,206 L 314,196 V 208 H 332\" fill=\"none\" stroke=\"#0B0F0C\" stroke-width=\"5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"232\" y=\"250\" width=\"160\" height=\"8\" rx=\"4\" fill=\"#3A4540\"/><path d=\"M 134,190 L 200,238 L 252,250\" fill=\"none\" stroke=\"#2B3A33\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"256\" cy=\"250\" r=\"11\" fill=\"#D39A6E\"/><rect x=\"394\" y=\"222\" width=\"28\" height=\"34\" rx=\"6\" fill=\"#F2EFE6\"/><path d=\"M 422,230 q 12,4 0,16\" fill=\"none\" stroke=\"#F2EFE6\" stroke-width=\"5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 402,208 q -6,-8 0,-16 M 414,208 q -6,-8 0,-16\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g></svg>"}, "listener": {"title": "Listening", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"420\" height=\"420\" viewBox=\"0 0 420 420\" style=\"overflow: visible; display: block\"><defs><filter id=\"cut-listen\" x=\"-20%\" y=\"-20%\" width=\"140%\" height=\"140%\"><feMorphology in=\"SourceAlpha\" operator=\"dilate\" radius=\"8\" result=\"d\"/><feFlood flood-color=\"#F2EFE6\"/><feComposite in2=\"d\" operator=\"in\" result=\"edge\"/><feDropShadow in=\"edge\" dx=\"0\" dy=\"6\" stdDeviation=\"6\" flood-color=\"#000\" flood-opacity=\"0.35\" result=\"sh\"/><feMerge><feMergeNode in=\"sh\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter></defs><g filter=\"url(#cut-listen)\"><path d=\"M 118,160 L 136,160 L 150,300 L 132,300 Z\" fill=\"#3A4540\"/><rect x=\"128\" y=\"286\" width=\"150\" height=\"18\" rx=\"9\" fill=\"#3A4540\"/><path d=\"M 142,302 L 136,392\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"10\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 266,302 L 272,392\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"10\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 196,290 L 282,296 L 290,380\" fill=\"none\" stroke=\"#1E2622\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"286\" y=\"377\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><path d=\"M 180,292 L 260,300 L 250,382\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"26\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"246\" y=\"379\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><path d=\"M 150.0,168 L 214.0,168 Q 224.0,168 234.0,194 L 230.0,296 L 150.0,296 L 144.4,194 Q 140.0,168 150.0,168 Z\" fill=\"#00FF66\"/><rect x=\"156\" y=\"114\" width=\"22\" height=\"62\" rx=\"11\" fill=\"#3B2415\"/><rect x=\"214\" y=\"114\" width=\"22\" height=\"62\" rx=\"11\" fill=\"#3B2415\"/><circle cx=\"196\" cy=\"122\" r=\"30\" fill=\"#A0663F\"/><path d=\"M 165,124 Q 166,84 198,85 Q 229,86 227,124 Q 218,102 198,100 Q 178,102 165,124 Z\" fill=\"#3B2415\"/><path d=\"M 192,124 q 4,4 8,0 M 208,124 q 4,4 8,0\" fill=\"none\" stroke=\"#0B0F0C\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 198,137 q 6,6 12,0\" fill=\"none\" stroke=\"#0B0F0C\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 164,190 L 178,236 L 226,226\" fill=\"none\" stroke=\"#18C45A\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 216,190 L 230,240 L 170,234\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 305.2,85.7 Q 333.6,122 305.2,158.3\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"1.0\"/><path d=\"M 309.2,74.7 Q 345.6,122 309.2,169.3\" fill=\"none\" stroke=\"#F2EFE6\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.75\"/><path d=\"M 313.2,63.699999999999996 Q 357.6,122 313.2,180.3\" fill=\"none\" stroke=\"#F2EFE6\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.5\"/></g></svg>"}, "audience": {"title": "The audience reacts", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"440\" height=\"420\" viewBox=\"0 0 440 420\" style=\"overflow: visible; display: block\"><defs><filter id=\"cut-audience\" x=\"-20%\" y=\"-20%\" width=\"140%\" height=\"140%\"><feMorphology in=\"SourceAlpha\" operator=\"dilate\" radius=\"8\" result=\"d\"/><feFlood flood-color=\"#F2EFE6\"/><feComposite in2=\"d\" operator=\"in\" result=\"edge\"/><feDropShadow in=\"edge\" dx=\"0\" dy=\"6\" stdDeviation=\"6\" flood-color=\"#000\" flood-opacity=\"0.35\" result=\"sh\"/><feMerge><feMergeNode in=\"sh\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter></defs><g filter=\"url(#cut-audience)\"><path d=\"M 120,300 L 114,390\" fill=\"none\" stroke=\"#1E2622\" stroke-width=\"24\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 150,300 L 158,390\" fill=\"none\" stroke=\"#1E2622\" stroke-width=\"24\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"88\" y=\"385\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><rect x=\"152\" y=\"385\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><path d=\"M 107.0,172 L 165.0,172 Q 175.0,172 177.0,198 L 173.0,306 L 99.0,306 L 95.0,198 Q 97.0,172 107.0,172 Z\" fill=\"#239F5C\"/><circle cx=\"138\" cy=\"128\" r=\"30\" fill=\"#F2C9A6\"/><path d=\"M 107,126 Q 104,90 138,91 Q 168,90 170,120 Q 152,106 132,110 Q 118,114 107,126 Z\" fill=\"#17110D\"/><circle cx=\"138\" cy=\"130\" r=\"3.4\" fill=\"#0B0F0C\"/><circle cx=\"154\" cy=\"130\" r=\"3.4\" fill=\"#0B0F0C\"/><circle cx=\"146\" cy=\"144\" r=\"3.8\" fill=\"#0B0F0C\"/><path d=\"M 166,190 L 200,170 L 194,136\" fill=\"none\" stroke=\"#239F5C\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"194\" cy=\"132\" r=\"11\" fill=\"#F2C9A6\"/><path d=\"M 108,192 L 96,250 L 112,290\" fill=\"none\" stroke=\"#239F5C\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 270,300 L 262,390\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"24\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 300,300 L 306,390\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"24\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"236\" y=\"385\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><rect x=\"300\" y=\"385\" width=\"32\" height=\"17\" rx=\"8.5\" fill=\"#0B0F0C\"/><path d=\"M 257.0,172 L 315.0,172 Q 325.0,172 327.0,198 L 323.0,306 L 249.0,306 L 245.0,198 Q 247.0,172 257.0,172 Z\" fill=\"#F2EFE6\"/><circle cx=\"284\" cy=\"128\" r=\"30\" fill=\"#6B4028\"/><circle cx=\"260\" cy=\"114\" r=\"12\" fill=\"#17110D\"/><circle cx=\"270\" cy=\"100\" r=\"12\" fill=\"#17110D\"/><circle cx=\"286\" cy=\"95\" r=\"12\" fill=\"#17110D\"/><circle cx=\"302\" cy=\"100\" r=\"12\" fill=\"#17110D\"/><circle cx=\"311\" cy=\"114\" r=\"12\" fill=\"#17110D\"/><circle cx=\"255\" cy=\"130\" r=\"12\" fill=\"#17110D\"/><circle cx=\"313\" cy=\"128\" r=\"12\" fill=\"#17110D\"/><circle cx=\"270\" cy=\"130\" r=\"3.4\" fill=\"#0B0F0C\"/><circle cx=\"286\" cy=\"130\" r=\"3.4\" fill=\"#0B0F0C\"/><ellipse cx=\"278\" cy=\"145\" rx=\"6.5\" ry=\"7.5\" fill=\"#0B0F0C\"/><path d=\"M 256,190 L 236,236 L 256,262\" fill=\"none\" stroke=\"#F2EFE6\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 314,190 L 346,150 L 352,110\" fill=\"none\" stroke=\"#F2EFE6\" stroke-width=\"22\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"352\" cy=\"104\" r=\"11\" fill=\"#6B4028\"/><path d=\"M 374,86 L 392,72\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 380,110 L 402,108\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 360,66 L 366,46\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g></svg>"}, "ai-judge": {"title": "The AI judge", "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"420\" height=\"410\" viewBox=\"0 0 420 410\" style=\"overflow: visible; display: block\"><defs><filter id=\"cut-judge\" x=\"-20%\" y=\"-20%\" width=\"140%\" height=\"140%\"><feMorphology in=\"SourceAlpha\" operator=\"dilate\" radius=\"8\" result=\"d\"/><feFlood flood-color=\"#F2EFE6\"/><feComposite in2=\"d\" operator=\"in\" result=\"edge\"/><feDropShadow in=\"edge\" dx=\"0\" dy=\"6\" stdDeviation=\"6\" flood-color=\"#000\" flood-opacity=\"0.35\" result=\"sh\"/><feMerge><feMergeNode in=\"sh\"/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter></defs><g filter=\"url(#cut-judge)\"><path d=\"M 206,20 L 206,52\" fill=\"none\" stroke=\"#3A4540\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"206\" cy=\"16\" r=\"12\" fill=\"#00FF66\"/><rect x=\"130\" y=\"50\" width=\"152\" height=\"118\" rx=\"34\" fill=\"#DDE3DD\"/><rect x=\"148\" y=\"74\" width=\"116\" height=\"62\" rx=\"22\" fill=\"#0B0F0C\"/><path d=\"M 162,114 H 182 V 92 L 206,110 L 230,92 V 114 H 250\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"140\" y=\"182\" width=\"132\" height=\"126\" rx=\"30\" fill=\"#C9D1CA\"/><circle cx=\"206\" cy=\"236\" r=\"30\" fill=\"#0B0F0C\"/><path d=\"M 190,248 V 226 L 206,240 L 222,226 V 248\" fill=\"none\" stroke=\"#00FF66\" stroke-width=\"6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M 146,204 L 110,256 L 120,296\" fill=\"none\" stroke=\"#C9D1CA\" stroke-width=\"24\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"122\" cy=\"300\" r=\"14\" fill=\"#3A4540\"/><path d=\"M 266,204 L 310,196 L 324,150\" fill=\"none\" stroke=\"#C9D1CA\" stroke-width=\"24\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle cx=\"326\" cy=\"144\" r=\"14\" fill=\"#3A4540\"/><path d=\"M 326,144 L 352,96\" fill=\"none\" stroke=\"#8A5A34\" stroke-width=\"10\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"324\" y=\"66\" width=\"62\" height=\"34\" rx=\"9\" fill=\"#8A5A34\" transform=\"rotate(30 355 83)\"/><rect x=\"160\" y=\"306\" width=\"28\" height=\"70\" rx=\"12\" fill=\"#C9D1CA\"/><rect x=\"224\" y=\"306\" width=\"28\" height=\"70\" rx=\"12\" fill=\"#C9D1CA\"/><rect x=\"146\" y=\"366\" width=\"52\" height=\"22\" rx=\"11\" fill=\"#3A4540\"/><rect x=\"214\" y=\"366\" width=\"52\" height=\"22\" rx=\"11\" fill=\"#3A4540\"/></g></svg>"}};

  /* ------------------------------------------------------------------ public API */
  function list(filter) {
    var out = ORDER.map(function (id) { return META[id]; });
    if (!filter) return out;
    if (typeof filter === 'string') return out.filter(function (m) { return m.role === filter || m.tags.indexOf(filter) >= 0 || m.id.indexOf(filter) >= 0; });
    return out.filter(filter);
  }
  function get(id) {
    var s = SPECS[id];
    if (!s) return null;
    return JSON.parse(JSON.stringify(s));
  }
  function mount(target, idOrSpec, o) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) throw new Error('MajlisCharacters.mount: could not find ' + target);
    el.innerHTML = svg(idOrSpec, o);
    return el.firstChild;
  }
  function toPNG(idOrSpec, o) {
    o = o || {};
    var markup = o.scene ? scene(o.scene, o) : (typeof idOrSpec === 'string' && idOrSpec.indexOf('<svg') === 0 ? idOrSpec : svg(idOrSpec, o)), scale = o.scale || 3;
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('PNG failed')); }, 'image/png');
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
    });
  }
  function download(idOrSpec, filename, o) {
    o = o || {};
    filename = filename || (typeof idOrSpec === 'string' ? idOrSpec : 'character') + (o.format === 'svg' ? '.svg' : '.png');
    var save = function (blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    if (o.format === 'svg') { save(new Blob([typeof idOrSpec === 'string' && idOrSpec.indexOf('<svg') === 0 ? idOrSpec : svg(idOrSpec, o)], { type: 'image/svg+xml' })); return Promise.resolve(); }
    return toPNG(idOrSpec, o).then(save);
  }
  function classic(name) { var c = CLASSICS[name]; return c ? c.svg : null; }

  return {
    version: '1.0.0',
    list: list, get: get, svg: svg, mount: mount, random: random, crowd: crowd, scene: scene,
    scenes: function () { return Object.keys(SCENES).map(function (k) { return { id: k, name: SCENES[k].name, characters: SCENES[k].figures.map(function (f) { return f.character; }) }; }); },
    classic: classic, classics: function () { return Object.keys(CLASSICS).map(function (k) { return { id: k, name: CLASSICS[k].title }; }); },
    toPNG: toPNG, download: download,
    roles: function () { var seen = {}; ORDER.forEach(function (id) { seen[META[id].role] = 1; }); return Object.keys(seen); },
    // building blocks, for making your own
    parts: {
      colors: COLORS, skins: SKIN, hairColors: HAIR_COLORS, hairStyles: HAIR_STYLES, tops: TOPS, poses: Object.keys(POSES), expressions: Object.keys(EXPRESSIONS),
      props: Object.keys(PROPS), headwear: HEADWEAR, facewear: FACEWEAR, bodywear: BODYWEAR, extras: EXTRAS, robotScreens: ROBOT_SCREENS, robotArms: ['gavel', 'wave', 'point', 'rdown', 'clipboard']
    }
  };
});
