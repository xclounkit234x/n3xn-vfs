
/**
 * NRXN AIR · Advanced GX Particle Field
 * Lightweight canvas particle system with connections, mouse repulsion,
 * accent-color sync, and density scaling.
 */
(function () {
  const canvas = document.createElement("canvas");
  canvas.id = "gx-particles";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });
  let w = 0, h = 0, dpr = 1;
  let particles = [];
  let mouse = { x: -9999, y: -9999, active: false };
  let accent = "#a78bfa";
  let accentRgb = [167, 139, 250];
  let raf = 0;
  let density = 1;

  function parseAccent(css) {
    const el = document.createElement("div");
    el.style.color = css;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);
    const m = computed.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return [167, 139, 250];
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    density = Math.max(0.4, Math.min(1.2, (w * h) / 1.4e6));
    seed();
  }

  function seed() {
    const target = Math.floor(55 * density);
    particles = [];
    for (let i = 0; i < target; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.1 + Math.random() * 2.2,
        a: 0.25 + Math.random() * 0.55,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    const [cr, cg, cb] = accentRgb;
    const linkDist = 120;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.pulse += 0.018;
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;

      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 140 && dist > 0.1) {
          const force = (140 - dist) / 140;
          p.vx += (dx / dist) * force * 0.08;
          p.vy += (dy / dist) * force * 0.08;
        }
      }

      p.vx *= 0.992;
      p.vy *= 0.992;
      p.vx += (Math.random() - 0.5) * 0.012;
      p.vy += (Math.random() - 0.5) * 0.012;

      const glow = 0.55 + Math.sin(p.pulse) * 0.25;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${p.a * glow})`;
      ctx.fill();
    }

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < linkDist) {
          const alpha = (1 - dist / linkDist) * 0.22;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(tick);
  }

  function setAccent(cssColor) {
    accent = cssColor || "#a78bfa";
    accentRgb = parseAccent(accent);
  }

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });
  window.addEventListener("mouseleave", () => {
    mouse.active = false;
  });
  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (t) {
      mouse.x = t.clientX;
      mouse.y = t.clientY;
      mouse.active = true;
    }
  }, { passive: true });
  window.addEventListener("touchend", () => {
    mouse.active = false;
  });
  window.addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    resize();
    raf = requestAnimationFrame(tick);
  });

  // Observe CSS variable changes for live theme sync
  const root = document.documentElement;
  const observer = new MutationObserver(() => {
    const v = getComputedStyle(root).getPropertyValue("--accent").trim();
    if (v) setAccent(v);
  });
  observer.observe(root, { attributes: true, attributeFilter: ["style", "data-theme", "class"] });

  resize();
  setAccent(getComputedStyle(root).getPropertyValue("--accent").trim() || "#a78bfa");
  raf = requestAnimationFrame(tick);

  window.NRXNParticles = { setAccent, resize };
})();
