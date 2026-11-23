/* Narrow proxy — Cloudflare Worker
 * 1. Cloudflare dashboard > Workers & Pages > Create > "Hello World" > Edit code > paste this whole file.
 * 2. Change KEY (letters and numbers only) and ALLOWED_SITES below, then Deploy.
 * 3. Copy your https://something.workers.dev address into the console's Browser settings (⚙) together with KEY.
 * Cookies are not forwarded, so logins won't work. Heavy sites (YouTube, Discord) usually won't either. */
const KEY = 'changeme123';                          // letters + numbers only; make it your own
const ALLOWED_SITES = ['https://YOURNAME.github.io']; // sites allowed to embed this proxy (origin only, no path)

const BLOCKED = /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/i;
const PATH_RE = new RegExp('^/' + KEY + '/(https?)/([^/]+)(/.*)?$');
const ATTRS = [['a','href'],['link','href'],['script','src'],['img','src'],['img','srcset'],['source','src'],['source','srcset'],['iframe','src'],['form','action'],['video','src'],['video','poster'],['audio','src'],['embed','src'],['input','src']];
const SHIM = `(function(){try{var m=location.pathname.match(/^\\/${KEY}\\/(https?)\\/([^\\/]+)(\\/.*)?$/);if(!m)return;
var real=m[1]+'://'+m[2]+(m[3]||'/')+location.search+location.hash;
function P(u){try{var a=new URL(u,location.href);if(a.origin!==location.origin&&/^https?:$/.test(a.protocol))return '/${KEY}/'+a.protocol.slice(0,-1)+'/'+a.host+a.pathname+a.search+a.hash}catch(e){}return u}
var f=window.fetch;window.fetch=function(i,o){try{if(typeof i==='string')i=P(i);else if(i&&i.url)i=new Request(P(i.url),i)}catch(e){}return f.call(this,i,o)};
var x=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){arguments[1]=P(String(u));return x.apply(this,arguments)};
var wo=window.open;window.open=function(u){return wo.call(window,u?P(String(u)):u,arguments[1],arguments[2])};
function tell(){parent.postMessage({narrowNav:real,title:document.title},'*')}tell();addEventListener('load',tell);
}catch(e){}})();`;

function wrap(u) { // absolute upstream URL -> proxied path
  return '/' + KEY + '/' + u.protocol.slice(0, -1) + '/' + u.host + u.pathname + u.search + u.hash;
}
function rewrite(v, base) {
  if (!v || /^\s*(data:|javascript:|mailto:|tel:|blob:|#|about:)/i.test(v)) return v;
  try { const u = new URL(v, base); return /^https?:$/.test(u.protocol) ? wrap(u) : v; } catch (e) { return v; }
}
class Attr {
  constructor(attr, base) { this.attr = attr; this.base = base; }
  element(el) {
    const v = el.getAttribute(this.attr);
    if (v == null) return;
    if (this.attr === 'srcset') el.setAttribute('srcset', v.split(',').map(p => { const t = p.trim().split(/\s+/); t[0] = rewrite(t[0], this.base); return t.join(' '); }).join(', '));
    else el.setAttribute(this.attr, rewrite(v, this.base));
    el.removeAttribute('integrity');
    if (el.tagName === 'a') el.removeAttribute('target');
  }
}

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const ref = req.headers.get('referer');
    // only embeddable by your own site(s) (or by pages this worker served)
    if (ref) { let ro = ''; try { ro = new URL(ref).origin; } catch (e) {} if (ro !== url.origin && !ALLOWED_SITES.includes(ro)) return new Response('Forbidden', { status: 403 }); }

    let m = url.pathname.match(PATH_RE);
    if (!m) { // root-relative request from a proxied page: recover the site from the Referer
      let rm = null; try { rm = ref && new URL(ref).pathname.match(PATH_RE); } catch (e) {}
      if (rm) return Response.redirect(url.origin + '/' + KEY + '/' + rm[1] + '/' + rm[2] + url.pathname + url.search, 302);
      return new Response('Narrow proxy is running.', { status: 404 });
    }
    const target = new URL(m[1] + '://' + m[2] + (m[3] || '/') + url.search);
    if (BLOCKED.test(target.hostname) || (target.port && target.port !== '80' && target.port !== '443')) return new Response('Blocked', { status: 403 });

    const h = new Headers(req.headers);
    ['host', 'cookie', 'referer', 'origin', 'cf-connecting-ip', 'x-forwarded-for', 'x-real-ip'].forEach(k => h.delete(k));
    let up;
    try {
      up = await fetch(target.href, { method: req.method, headers: h, body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body, redirect: 'manual' });
    } catch (e) { return new Response('Could not reach ' + target.host, { status: 502 }); }

    const out = new Headers(up.headers);
    ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'set-cookie', 'strict-transport-security', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy'].forEach(k => out.delete(k));
    out.set('Referrer-Policy', 'unsafe-url');
    out.set('X-Robots-Tag', 'noindex');
    if (up.status >= 300 && up.status < 400 && out.get('location')) {
      out.set('location', rewrite(out.get('location'), target.href));
      return new Response(null, { status: up.status, headers: out });
    }
    const ct = (out.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) {
      out.delete('content-length');
      let r = new HTMLRewriter()
        .on('head', { element(el) { el.prepend('<script>' + SHIM + '</script>', { html: true }); } })
        .on('base', { element(el) { el.remove(); } })
        .on('meta[http-equiv]', { element(el) { const v = (el.getAttribute('http-equiv') || '').toLowerCase(); if (v.includes('content-security') || v === 'refresh') el.remove(); } });
      ATTRS.forEach(([t, a]) => { r = r.on(t, new Attr(a, target.href)); });
      return r.transform(new Response(up.body, { status: up.status, headers: out }));
    }
    if (ct.includes('text/css')) {
      out.delete('content-length');
      const css = (await up.text()).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (s, q, v) => 'url(' + q + rewrite(v, target.href) + q + ')')
        .replace(/@import\s+(['"])([^'"]+)\1/g, (s, q, v) => '@import ' + q + rewrite(v, target.href) + q);
      return new Response(css, { status: up.status, headers: out });
    }
    return new Response(up.body, { status: up.status, headers: out });
  }
};
