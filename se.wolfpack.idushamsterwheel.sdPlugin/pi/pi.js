// Settings panel wiring for Idus Hamster Wheel — OpenDeck (Linux) and Elgato Stream Deck (Windows).
// Fields with data-setting="name" are loaded from and saved to the key's settings. OpenDeck wants
// messages on the key's context, Stream Deck on the panel's own id (<html data-target="elgato">).
// Blocks with data-when="setting:value value" only show when that setting has one of those values
// (checkboxes: true / false).
(function () {
  const ELG = document.documentElement.dataset.target === "elgato";
  let socket = null, context = null, action = null, settings = {};
  const infoFns = [];

  function value(el) { return el.type === "checkbox" ? String(el.checked) : el.value; }
  function current(k) {
    const el = document.querySelector(`[data-setting="${k}"]`);
    return el ? value(el) : String(settings[k]);
  }

  function views() {
    document.querySelectorAll("[data-when]").forEach((el) => {
      const [k, vals] = el.dataset.when.split(":");
      el.hidden = !vals.split(" ").includes(current(k));
    });
    document.dispatchEvent(new CustomEvent("pi-settings", { detail: settings }));
  }

  function fill() {
    document.querySelectorAll("[data-setting]").forEach((el) => {
      const k = el.dataset.setting, v = settings[k];
      if (el.type === "checkbox") el.checked = v === undefined || v === null ? el.dataset.default === "true" : v === true || v === "true";
      else if (v !== undefined && v !== null && v !== "") el.value = v;
      else if (el.dataset.default !== undefined) el.value = el.dataset.default;
    });
    views();
  }

  function save() {
    document.querySelectorAll("[data-setting]").forEach((el) => {
      settings[el.dataset.setting] = el.type === "checkbox" ? el.checked : el.value.trim();
    });
    if (socket && socket.readyState === 1) socket.send(JSON.stringify({ event: "setSettings", context, payload: settings }));
    views();
  }

  function start(port, uuid, registerEvent, _info, actionInfo) {
    const a = typeof actionInfo === "string" ? JSON.parse(actionInfo) : actionInfo;
    context = ELG ? uuid : a.context; action = a.action;
    settings = (a.payload && a.payload.settings) || {};
    fill();
    socket = new WebSocket("ws://127.0.0.1:" + port);
    socket.onopen = () => {
      socket.send(JSON.stringify({ event: registerEvent, uuid }));
      PI.send({ cmd: "info" });
    };
    socket.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.event === "didReceiveSettings") { settings = (m.payload && m.payload.settings) || {}; fill(); }
      if (m.event === "sendToPropertyInspector" && m.payload && m.payload.type === "info") infoFns.forEach((fn) => fn(m.payload));
    };
  }

  window.PI = {
    send(payload) { if (socket && socket.readyState === 1) socket.send(JSON.stringify({ event: "sendToPlugin", context, action, payload })); },
    onInfo(fn) { infoFns.push(fn); },
    get settings() { return settings; },
  };
  window.connectElgatoStreamDeckSocket = start;
  window.connectSocket = start;
  if (window.openDeckConnection && window.openDeckConnection.then) window.openDeckConnection.then((a) => start.apply(null, a));

  document.addEventListener("DOMContentLoaded", () => {
    views();
    document.querySelectorAll("[data-setting]").forEach((el) => el.addEventListener("change", save));
    // Links open in the default browser (OpenDeck turns window.open with a target into openUrl)
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href^='http']");
      if (!a) return;
      e.preventDefault();
      if (ELG) { if (socket && socket.readyState === 1) socket.send(JSON.stringify({ event: "openUrl", payload: { url: a.href } })); }
      else window.open(a.href, "_blank");
    });
    // Copy buttons: data-copy-pre="<id of the pre>"
    document.querySelectorAll("[data-copy-pre]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const el = document.getElementById(btn.dataset.copyPre), text = el.textContent;
        const done = () => { const old = btn.dataset.label || btn.textContent; btn.dataset.label = old;
          btn.textContent = "Copied ✓"; btn.classList.add("done"); setTimeout(() => { btn.textContent = old; btn.classList.remove("done"); }, 2200); };
        const fallback = () => {
          const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
          if (ok) done(); else btn.textContent = "Press Ctrl+C";
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
        else fallback();
      });
    });
    const f = document.querySelector("footer[data-idus]");
    if (f) f.innerHTML = 'Made by Idus, with AI assistance (Claude) · <a href="https://github.com/Idus/idus-hamster-wheel">GitHub</a>' +
      (ELG ? " — help, source and feedback" : ' · <a href="https://ko-fi.com/N4N2QZHKK">☕ Tip me on Ko-fi</a>');
  });
})();
