// ============================================================
// Kuiqr — First-launch Guided Tour
// A spotlight + coach-mark tour that runs on first launch.
// Exposes window.KuiqrTutorial.start(onComplete).
// ============================================================

(function () {
  "use strict";

  // ---- Tour content -------------------------------------------------------
  // Each step: { selector, title, text, tab?, placement? }
  //   selector : CSS selector of the element to spotlight (omit for a centered
  //              welcome / finale card with no target).
  //   tab      : optional tab to switch to before showing the step.
  //   placement: "auto" (default) | "top" | "bottom" — which side the card sits.
  const STEPS = [
    {
      title: "Welcome to Kuiqr",
      text:
        "Kuiqr scans QR codes from anywhere on your screen with a single shortcut — and everything stays on your device. Let's take a quick tour.",
    },
    {
      selector: ".scan-hero",
      title: "This is your scanner",
      text:
        "Everything lives in this little window. Keep it open while you work, or tuck it into your menu bar.",
      placement: "bottom",
    },
    {
      selector: "#drop-zone",
      title: "Scan from an image",
      text:
        "Paste an image from your clipboard (⌘V) or drag & drop one here. Kuiqr decodes it instantly in this window.",
      placement: "bottom",
    },
    {
      selector: "#scan-btn",
      title: "Or capture your screen",
      text:
        "Click this (or press the shortcut) to draw a box around any QR code on screen. Links open automatically; other text is copied for you.",
      placement: "bottom",
    },
    {
      selector: '.tab[data-tab="history"]',
      title: "Four simple tabs",
      text:
        "Switch anytime between Scan, History, Settings, and Generate from here.",
      placement: "bottom",
    },
    {
      tab: "settings",
      selector: "#shortcut-record-btn",
      title: "Make it yours",
      text:
        "Record your own shortcut and choose what happens after a scan — notifications, auto-open links, and more.",
      placement: "bottom",
    },
    {
      tab: "generate",
      selector: "#gen-input",
      title: "Need a QR instead?",
      text:
        "The Generate tab turns any link or text into a QR code you can download or copy.",
      placement: "bottom",
    },
    {
      title: "You're all set",
      text:
        "Press the shortcut or drop in an image to scan your first code. Welcome aboard!",
    },
  ];

  let root = null;
  let dimEl = null;
  let spotEl = null;
  let cardEl = null;
  let arrowEl = null;
  let fillEl = null;
  let stepLabelEl = null;
  let backBtn = null;
  let nextBtn = null;
  let current = 0;
  let active = false;
  let onDone = null;
  let rafId = 0;

  function buildDom() {
    root = document.createElement("div");
    root.className = "tut-root";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Kuiqr tour");

    dimEl = document.createElement("div");
    dimEl.className = "tut-dim";
    dimEl.style.display = "none";

    spotEl = document.createElement("div");
    spotEl.className = "tut-spotlight";

    cardEl = document.createElement("div");
    cardEl.className = "tut-card";

    cardEl.innerHTML = `
      <div class="tut-progress"><div class="tut-progress-fill"></div></div>
      <div class="tut-card-body">
        <h3 class="tut-title"></h3>
        <p class="tut-text"></p>
      </div>
      <div class="tut-footer">
        <span class="tut-step"></span>
        <button class="tut-btn tut-skip" type="button">Skip</button>
        <button class="tut-btn tut-back" type="button">Back</button>
        <button class="tut-btn tut-next" type="button">Next</button>
      </div>`;

    arrowEl = document.createElement("div");
    arrowEl.className = "tut-arrow";

    document.body.appendChild(root);
    root.appendChild(dimEl);
    root.appendChild(spotEl);
    root.appendChild(cardEl);
    root.appendChild(arrowEl);

    fillEl = cardEl.querySelector(".tut-progress-fill");
    stepLabelEl = cardEl.querySelector(".tut-step");
    backBtn = cardEl.querySelector(".tut-back");
    nextBtn = cardEl.querySelector(".tut-next");

    cardEl.querySelector(".tut-skip").addEventListener("click", finish);
    backBtn.addEventListener("click", () => go(current - 1));
    nextBtn.addEventListener("click", () => {
      if (current === STEPS.length - 1) finish();
      else go(current + 1);
    });

    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (current < STEPS.length - 1) go(current + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (current > 0) go(current - 1); }
    });

    window.addEventListener("resize", scheduleReposition);
    document.querySelectorAll(".tab-content").forEach((c) =>
      c.addEventListener("scroll", scheduleReposition, { passive: true })
    );
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function scheduleReposition() {
    if (!active) return;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      render(false);
    });
  }

  function switchToTab(name) {
    // Use the app's own tab switcher if available (skips the unsaved-changes
    // prompt so the tour can move freely). Fall back to a click.
    if (typeof window.switchTab === "function") window.switchTab(name);
    else {
      const t = document.querySelector('.tab[data-tab="' + name + '"]');
      if (t) t.click();
    }
  }

  async function render(animate) {
    const step = STEPS[current];
    const total = STEPS.length;

    // Header / text
    cardEl.querySelector(".tut-title").textContent = step.title;
    cardEl.querySelector(".tut-text").textContent = step.text;
    stepLabelEl.textContent = "Step " + (current + 1) + " of " + total;
    fillEl.style.width = ((current + 1) / total) * 100 + "%";
    backBtn.hidden = current === 0;
    nextBtn.textContent = current === total - 1 ? "Done" : "Next";

    // Tab switch (before measuring target)
    if (step.tab) {
      switchToTab(step.tab);
      await new Promise((r) => setTimeout(r, 80)); // let layout settle
    }

    const hasTarget = !!step.selector;
    const target = hasTarget ? document.querySelector(step.selector) : null;

    if (!hasTarget || !target) {
      // Centered card, no spotlight
      spotEl.style.display = "none";
      dimEl.style.display = "block";
      arrowEl.style.display = "none";

      const w = cardEl.offsetWidth;
      const h = cardEl.offsetHeight;
      cardEl.style.left = clamp((window.innerWidth - w) / 2, 12, window.innerWidth - w - 12) + "px";
      cardEl.style.top = clamp((window.innerHeight - h) / 2, 12, window.innerHeight - h - 12) + "px";
      return;
    }

    // Spotlight a real element
    dimEl.style.display = "none";
    spotEl.style.display = "block";

    if (target.scrollIntoView) {
      try { target.scrollIntoView({ block: "center", behavior: "auto" }); } catch (e) {}
    }
    // Re-measure after scroll
    const rect = target.getBoundingClientRect();
    const pad = 8;
    const sx = rect.left - pad;
    const sy = rect.top - pad;
    const sw = rect.width + pad * 2;
    const sh = rect.height + pad * 2;

    spotEl.style.left = sx + "px";
    spotEl.style.top = sy + "px";
    spotEl.style.width = sw + "px";
    spotEl.style.height = sh + "px";

    // Decide card placement
    let placement = step.placement || "auto";
    const targetCenterY = rect.top + rect.height / 2;
    if (placement === "auto") placement = targetCenterY < window.innerHeight * 0.5 ? "bottom" : "top";

    const gap = 16;
    const cardW = cardEl.offsetWidth;
    const cardH = cardEl.offsetHeight;
    let cardTop;
    let arrowDir;

    if (placement === "bottom") {
      cardTop = rect.bottom + gap + 7; // 7 = half arrow
      arrowDir = "up";
      // Flip if it would overflow the bottom of the window
      if (cardTop + cardH > window.innerHeight - 12) {
        cardTop = rect.top - gap - 7 - cardH;
        arrowDir = "down";
      }
    } else {
      cardTop = rect.top - gap - 7 - cardH;
      arrowDir = "down";
      if (cardTop < 12) {
        cardTop = rect.bottom + gap + 7;
        arrowDir = "up";
      }
    }

    let cardLeft = clamp(rect.left + rect.width / 2 - cardW / 2, 12, window.innerWidth - cardW - 12);
    cardLeft = clamp(cardLeft, 12, Math.max(12, window.innerWidth - cardW - 12));

    cardEl.style.left = cardLeft + "px";
    cardEl.style.top = cardTop + "px";

    // Arrow
    arrowEl.style.display = "block";
    arrowEl.className = "tut-arrow " + arrowDir;
    if (arrowDir === "up") {
      arrowEl.style.top = cardTop - 7 + "px";
    } else {
      arrowEl.style.top = cardTop + cardH - 7 + "px";
    }
    // Align arrow under the target's center (clamped within the card)
    const arrowCenterX = clamp(rect.left + rect.width / 2, cardLeft + 14, cardLeft + cardW - 14);
    arrowEl.style.left = arrowCenterX - 7 + "px";
  }

  function go(index) {
    if (index < 0 || index >= STEPS.length) return;
    current = index;
    render(true);
  }

  function finish() {
    if (!active) return;
    active = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    window.removeEventListener("resize", scheduleReposition);

    const done = onDone;
    onDone = null;

    const cleanup = () => {
      if (root && root.parentNode) root.parentNode.removeChild(root);
      root = dimEl = spotEl = cardEl = arrowEl = fillEl = stepLabelEl = backBtn = nextBtn = null;
      if (typeof done === "function") done();
    };

    if (root) {
      root.style.transition = "opacity 0.25s ease-out";
      root.style.opacity = "0";
      setTimeout(cleanup, 260);
    } else {
      cleanup();
    }
  }

  function start(onComplete) {
    if (active) return;
    if (typeof onComplete === "function") onDone = onComplete;
    active = true;
    current = 0;
    buildDom();
    // Focus the card so keyboard (Esc / arrows) works immediately
    setTimeout(() => { render(true); cardEl && cardEl.focus && cardEl.setAttribute("tabindex", "-1"); }, 30);
    setTimeout(() => { if (cardEl) cardEl.focus(); }, 60);
  }

  window.KuiqrTutorial = { start: start, STEPS: STEPS };
})();
