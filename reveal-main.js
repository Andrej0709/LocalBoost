/* Scroll-reveal for LocalBoost.dc.html — a generated design-canvas file.
   The canvas runtime re-asserts each element's own class/style attribute
   from its template on reconciliation, silently wiping any class or inline
   style added directly to a section. <html> sits outside that managed tree,
   so this toggles a class there instead and lets CSS in the file's own
   <style> block (selector: html.dcr-<id> #<id>) do the reveal — nothing
   here ever writes to the sections themselves. */
(function () {
  // #control (data-dash) already runs its own scroll-driven animation that
  // fights an external opacity/transform override, so it's left alone here.
  var IDS = ["operators", "silence", "engine", "live", "pricing", "testimonials", "finalcta"];
  var observedNodes = new WeakSet();
  var io = null;

  function getObserver() {
    if (io) return io;
    if (!("IntersectionObserver" in window)) return null;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        document.documentElement.classList.add("dcr-" + entry.target.id);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    return io;
  }

  function scan() {
    var observer = getObserver();
    IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || observedNodes.has(el)) return;
      observedNodes.add(el);
      if (observer) observer.observe(el);
      else document.documentElement.classList.add("dcr-" + id);
    });
  }

  function init() {
    scan();
    // The runtime replaces the whole section subtree once during mount —
    // keep watching so freshly-created nodes get observed too.
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
