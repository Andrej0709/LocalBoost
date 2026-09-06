/* <lb-planet> — dotted planet background driven by page scroll.
   Canvas 2D, retina aware. Dots start white/grey; as the page scrolls they
   light up in patches (accent blue) — one light per local business joining. */
(function () {
  if (customElements.get("lb-planet")) return;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

  function hexToRgb(h) {
    h = (h || "").trim().replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    if (isNaN(n)) return [168, 198, 240];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // planet drift across the page: x/y in viewport fractions, r in min-dimension fractions
  const PATH = [
    { p: 0.0, x: 0.84, y: 0.40, r: 0.52, tilt: -0.34 },
    { p: 0.16, x: 0.62, y: 0.30, r: 0.46, tilt: -0.20 },
    { p: 0.34, x: 0.17, y: 0.66, r: 0.60, tilt: 0.08 },
    { p: 0.50, x: 0.86, y: 0.52, r: 0.66, tilt: -0.12 },
    { p: 0.62, x: 0.50, y: 1.22, r: 0.76, tilt: 0.02 },
    { p: 0.74, x: 0.13, y: 0.44, r: 0.58, tilt: 0.16 },
    { p: 0.88, x: 0.52, y: 0.88, r: 0.82, tilt: -0.06 },
    { p: 1.0, x: 0.50, y: 1.06, r: 0.98, tilt: -0.02 }
  ];

  function sample(p) {
    let i = 0;
    while (i < PATH.length - 2 && p > PATH[i + 1].p) i++;
    const a = PATH[i], b = PATH[i + 1];
    const t = ease(clamp((p - a.p) / (b.p - a.p), 0, 1));
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      r: a.r + (b.r - a.r) * t,
      tilt: a.tilt + (b.tilt - a.tilt) * t
    };
  }

  class LBPlanet extends HTMLElement {
    static get observedAttributes() { return ["accent", "glow", "count"]; }

    attributeChangedCallback(name, _old, val) {
      if (!this._on) return;
      if (name === "glow") this.glowK = parseFloat(val || "1") || 1;
      if (name === "accent") { this.accent = hexToRgb(val || "#a8c6f0"); this.buildGlow(); }
      if (name === "count") {
        const n = parseInt(val || "0", 10);
        if (n > 0 && n !== this.pts.length) this.buildPoints(n);
      }
    }

    connectedCallback() {
      if (this._on) return;
      this._on = true;

      this.style.display = "block";
      this.style.position = "absolute";
      this.style.inset = "0";
      this.style.pointerEvents = "none";

      const cv = (this.cv = document.createElement("canvas"));
      cv.style.cssText = "display:block;width:100%;height:100%";
      this.appendChild(cv);
      this.ctx = cv.getContext("2d", { alpha: true });

      this.accent = hexToRgb(this.getAttribute("accent") || "#a8c6f0");
      this.base = hexToRgb(this.getAttribute("base") || this.getAttribute("accent") || "#a8c6f0");
      this.glowK = parseFloat(this.getAttribute("glow") || "1") || 1;
      this.reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;

      this.buildPoints(parseInt(this.getAttribute("count") || "0", 10));
      this.buildGlow();

      this.prog = this.target = this.reduced ? 0.55 : 0;
      this.spin = 0;
      this.t0 = performance.now();

      this.onResize = () => this.resize();
      this.onScroll = () => {
        const d = document.documentElement;
        this.target = clamp(d.scrollTop / Math.max(1, d.scrollHeight - innerHeight), 0, 1);
      };
      addEventListener("resize", this.onResize, { passive: true });
      addEventListener("scroll", this.onScroll, { passive: true });
      this.onScroll();
      this.resize();

      this.tick = this.tick.bind(this);
      this.raf = requestAnimationFrame(this.tick);
    }

    disconnectedCallback() {
      this._on = false;
      cancelAnimationFrame(this.raf);
      removeEventListener("resize", this.onResize);
      removeEventListener("scroll", this.onScroll);
    }

    buildPoints(count) {
      const small = Math.min(innerWidth, innerHeight) < 700;
      const n = count > 0 ? count : small ? 1500 : 2800;
      const pts = (this.pts = new Array(n));
      const gold = Math.PI * (3 - Math.sqrt(5));

      // cluster seeds give the lights a patchy, city-like spread
      const K = 15;
      const seeds = [];
      for (let s = 0; s < K; s++) {
        const y = 1 - (2 * (s + 0.5)) / K;
        const rr = Math.sqrt(Math.max(0, 1 - y * y));
        const th = gold * s * 3.7 + 1.1;
        seeds.push({ x: Math.cos(th) * rr, y: y, z: Math.sin(th) * rr, o: (s + Math.random() * 0.6) / K });
      }

      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n;
        const rr = Math.sqrt(Math.max(0, 1 - y * y));
        const th = gold * i;
        const x = Math.cos(th) * rr, z = Math.sin(th) * rr;

        let best = 0, bd = 9;
        for (let s = 0; s < K; s++) {
          const d = (x - seeds[s].x) ** 2 + (y - seeds[s].y) ** 2 + (z - seeds[s].z) ** 2;
          if (d < bd) { bd = d; best = s; }
        }
        // ~72% ever light up; the rest stay grey
        const thr = seeds[best].o * 0.94 + Math.sqrt(bd) * 0.1 + Math.random() * 0.055 - 0.055;
        pts[i] = { x, y, z, thr: thr / 0.72, jit: 0.72 + Math.random() * 0.5 };
      }
    }

    buildGlow() {
      const s = 48;
      const g = document.createElement("canvas");
      g.width = g.height = s;
      const c = g.getContext("2d");
      const rg = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      const [r, gr, b] = this.accent;
      rg.addColorStop(0, `rgba(${r},${gr},${b},.85)`);
      rg.addColorStop(0.28, `rgba(${r},${gr},${b},.30)`);
      rg.addColorStop(1, `rgba(${r},${gr},${b},0)`);
      c.fillStyle = rg;
      c.fillRect(0, 0, s, s);
      this.glow = g;
    }

    resize() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const r = this.getBoundingClientRect();
      this.w = Math.max(1, r.width);
      this.h = Math.max(1, r.height);
      this.dpr = dpr;
      this.cv.width = Math.round(this.w * dpr);
      this.cv.height = Math.round(this.h * dpr);
    }

    tick(now) {
      this.raf = requestAnimationFrame(this.tick);
      if (document.hidden) return;
      const ctx = this.ctx;
      if (!ctx) return;

      const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
      this.last = now;

      // adaptive degrade: if frames get expensive, thin the point cloud once
      if (!this._checked) {
        this._fr = (this._fr || 0) + 1;
        this._acc = (this._acc || 0) + dt;
        if (this._fr === 90) {
          this._checked = true;
          if (this._acc / 90 > 0.026 && this.pts.length > 900) this.buildPoints(Math.round(this.pts.length * 0.55));
        }
      }

      this.prog += (this.target - this.prog) * (this.reduced ? 1 : 0.075);
      const p = this.prog;

      if (!this.reduced) this.spin += dt * 0.055;
      const rotY = this.spin + p * Math.PI * 1.85;
      const view = sample(p);
      const tilt = view.tilt + (this.reduced ? 0 : Math.sin(now / 9000) * 0.02);

      const cy0 = Math.cos(tilt), sy0 = Math.sin(tilt);
      const cyy = Math.cos(rotY), syy = Math.sin(rotY);

      const dpr = this.dpr, w = this.cv.width, h = this.cv.height;
      const cx = view.x * w, cyc = view.y * h;
      const R = view.r * Math.min(w, h);
      const D = 3.1;

      ctx.clearRect(0, 0, w, h);

      const pts = this.pts, n = pts.length;
      const [br, bg, bb] = this.base;
      const [ar, ag, ab] = this.accent;
      const litScale = 0.85 + 0.18 * p;

      // grey dots first, lit dots on top
      const lit = [];
      ctx.fillStyle = `rgb(${br},${bg},${bb})`;

      for (let i = 0; i < n; i++) {
        const pt = pts[i];
        // rotate Y then X
        let x = pt.x * cyy + pt.z * syy;
        let z = -pt.x * syy + pt.z * cyy;
        const y = pt.y * cy0 - z * sy0;
        z = pt.y * sy0 + z * cy0;

        const k = D / (D - z);
        const px = cx + x * R * k;
        const py = cyc + y * R * k;
        if (px < -60 || py < -60 || px > w + 60 || py > h + 60) continue;

        const front = clamp((z + 1) / 2, 0, 1);
        const size = (0.62 + front * 1.55) * dpr;
        const on = smooth((p - pt.thr) * 7);

        if (on < 0.02) {
          ctx.globalAlpha = (0.10 + front * 0.30) * pt.jit;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, 6.283);
          ctx.fill();
        } else {
          lit.push(px, py, size, front, on * pt.jit);
        }
      }

      // glow halos
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < lit.length; i += 5) {
        const a = lit[i + 4] * (0.13 + lit[i + 3] * 0.26) * this.glowK;
        if (a < 0.015) continue;
        const g = (3.6 + lit[i + 3] * 6.4) * dpr * litScale;
        ctx.globalAlpha = clamp(a, 0, 1);
        ctx.drawImage(this.glow, lit[i] - g, lit[i + 1] - g, g * 2, g * 2);
      }
      ctx.globalCompositeOperation = "source-over";

      // lit cores
      ctx.fillStyle = `rgb(${ar},${ag},${ab})`;
      for (let i = 0; i < lit.length; i += 5) {
        ctx.globalAlpha = clamp(lit[i + 4] * (0.42 + lit[i + 3] * 0.58), 0, 1);
        ctx.beginPath();
        ctx.arc(lit[i], lit[i + 1], lit[i + 2] * 1.08, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  customElements.define("lb-planet", LBPlanet);
})();
