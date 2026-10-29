/* In-page links on the home page without "#section" in the address bar.
 *
 * The nav, the footer and the hero link to sections of the home page (#top,
 * #drop, #pricing...). Left to the browser, every click leaves the section in
 * the address bar, so a visitor ends up looking at adronis.app/#top. This
 * scrolls to the section itself and leaves the address as it was.
 *
 * A visitor who arrives with a section in the link (another page sending them
 * to /#faq, say) is scrolled there once the section has rendered, and the
 * address is then cleaned up too.
 *
 * Sections are rendered by the page's runtime, which also keeps a hidden copy
 * of the raw template in the page. That copy is skipped.
 */
(function () {
  var SECTION = /^#[A-Za-z][\w-]*$/;

  function findSection(id) {
    var all = document.querySelectorAll('[id="' + id + '"]');
    for (var i = all.length - 1; i >= 0; i--) {
      if (!all[i].closest("x-dc")) return all[i];
    }
    return null;
  }

  function cleanAddress() {
    try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) {}
  }

  function goTo(id) {
    if (id === "top") {
      window.scrollTo({ top: 0, behavior: smooth() });
      return true;
    }
    var target = findSection(id);
    if (!target) return false;
    target.scrollIntoView({ block: "start", behavior: smooth() });
    // The skip link moves keyboard focus to the content, as a normal jump would.
    if (target.hasAttribute("tabindex")) {
      try { target.focus({ preventScroll: true }); } catch (e) {}
    }
    return true;
  }

  function smooth() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    } catch (e) { return "auto"; }
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest && e.target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href");
    if (!SECTION.test(href)) return;
    if (goTo(href.slice(1))) {
      e.preventDefault();
      if (location.hash) cleanAddress();
    }
  });

  // Arrived with a section in the link: wait for it to render, then go there.
  if (SECTION.test(location.hash)) {
    var id = location.hash.slice(1);
    var tries = 0;
    var attempt = function () {
      if (id === "top" || findSection(id)) {
        var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        fontsReady.then(function () {
          var target = id === "top" ? null : findSection(id);
          if (target) target.scrollIntoView({ block: "start" });
          else window.scrollTo(0, 0);
          cleanAddress();
        });
      } else if (++tries < 240) {
        // A timer, not an animation frame: a tab opened in the background
        // never paints, and the address should still be cleaned up.
        setTimeout(attempt, 16);
      } else {
        cleanAddress();
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attempt);
    else attempt();
  }
})();
