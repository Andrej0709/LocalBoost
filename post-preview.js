/* "See it as a post": an ad shown the way it will look in the app, before the
   owner approves it - an Instagram post or story, or a Facebook post, with the
   business's name and logo on top and the caption cut where the app cuts it.
   Seeing it in place makes yes or no an easier call than a bare picture does.

   Used by approvals.html (and the public demo there):
     LBPreview.setAccount({ name, website, logoUrl })   once the account is known
     LBPreview.kind(creative)    "ig-post", "ig-story", "fb-post" or null
     LBPreview.open(creative)    opens it; Escape, the X or a click outside closes

   It draws its own nodes and puts text in with textContent only, so nothing an
   ad says can turn into markup. Styles live in adronis.css (.pv-). */
(function () {
  var account = { name: "", website: "", logoUrl: null };

  function make(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Line icons, drawn here so the preview needs no files of its own.
  var ICONS = {
    heart: '<path d="M12 20s-7.5-4.6-9.2-9.1C1.6 7.6 3.9 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.2 0 5.5 3.1 4.3 6.4C19.5 15.4 12 20 12 20z"/>',
    comment: '<path d="M20.5 11.6c0 4.4-3.8 7.9-8.5 7.9-1.2 0-2.3-.2-3.3-.6L4 20l1.2-3.8c-1-1.3-1.7-2.9-1.7-4.6C3.5 7.2 7.3 3.7 12 3.7s8.5 3.5 8.5 7.9z"/>',
    send: '<path d="M21 3.5L10.2 13.3M21 3.5l-6.6 17-4.2-7.2L3 9.6l18-6.1z"/>',
    save: '<path d="M18.5 20.5L12 15.6l-6.5 4.9V4.5c0-.6.4-1 1-1h11c.6 0 1 .4 1 1v16z"/>',
    more: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
    like: '<path d="M7.5 20.5h-3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3m0 10v-10m0 10h9.3a2 2 0 0 0 2-1.6l1.2-6a2 2 0 0 0-2-2.4h-4.8l.8-3.8a1.7 1.7 0 0 0-3.2-1.1L7.5 10.5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };

  function icon(name, cls) {
    var span = make("span", "pv-icon" + (cls ? " " + cls : ""));
    span.setAttribute("aria-hidden", "true");
    var filled = name === "more";
    span.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="' + (filled ? "currentColor" : "none") +
      '" stroke="' + (filled ? "none" : "currentColor") + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      ICONS[name] + "</svg>";
    return span;
  }

  // The Instagram username: the handle from the brief when there is one,
  // otherwise the business name the way a handle is usually made from it.
  function handle() {
    var w = String(account.website || "").trim();
    var m = /^@([A-Za-z0-9._]{1,30})$/.exec(w) || /instagram\.com\/([A-Za-z0-9._]{1,30})/i.exec(w);
    if (m) return m[1].toLowerCase();
    var made = String(account.name || "").toLowerCase()
      .replace(/đ/g, "dj")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9._]+/g, "")
      .slice(0, 30);
    return made || "yourbusiness";
  }

  function displayName() {
    return String(account.name || "").trim() || "Your business";
  }

  function avatar() {
    var box = make("span", "pv-avatar");
    box.setAttribute("aria-hidden", "true");
    if (account.logoUrl) {
      var img = new Image();
      img.alt = "";
      img.src = account.logoUrl;
      box.appendChild(img);
    } else {
      var initials = displayName().split(/\s+/).filter(Boolean).slice(0, 2)
        .map(function (w) { return w.charAt(0); }).join("").toUpperCase();
      box.textContent = initials || "A";
    }
    return box;
  }

  // Hashtags and @mentions in the app's link colour, everything else plain.
  function richText(parent, text) {
    String(text).split(/([#@][\p{L}\p{N}_.]+)/u).forEach(function (part) {
      if (!part) return;
      if (/^[#@]/.test(part)) parent.appendChild(make("span", "pv-tag", part));
      else parent.appendChild(document.createTextNode(part));
    });
  }

  // The app shows the start of a long caption and a "more" to open the rest.
  function caption(parent, text, limit, moreLabel) {
    text = String(text || "").trim();
    var lines = text.split("\n");
    var cut = text.length > limit || lines.length > 2;
    if (!cut) { richText(parent, text); return; }

    var start = lines.slice(0, 2).join("\n");
    if (start.length > limit) {
      start = start.slice(0, limit);
      var space = start.lastIndexOf(" ");
      if (space > limit * 0.6) start = start.slice(0, space);
    }
    var shortPart = make("span");
    richText(shortPart, start.replace(/[\s.,;:!?-]+$/, ""));
    shortPart.appendChild(document.createTextNode("… "));
    var more = make("button", "pv-more-btn", moreLabel);
    more.type = "button";
    more.addEventListener("click", function () {
      parent.removeChild(shortPart);
      parent.removeChild(more);
      richText(parent, text);
    });
    parent.appendChild(shortPart);
    parent.appendChild(more);
  }

  function postText(creative) {
    return creative.caption || creative.headline || "";
  }

  // The feed shows a picture at its own shape, from 4:5 (tall) to 1.91:1
  // (wide), and crops anything beyond that. Until the picture has loaded, the
  // box takes the shape the ad's format names.
  function media(creative, ratio) {
    var box = make("div", "pv-media");
    box.style.aspectRatio = ratio || "1 / 1";
    var img = new Image();
    img.alt = creative.headline || "AI-generated creative";
    img.decoding = "async";
    img.addEventListener("load", function () {
      if (!img.naturalWidth || !img.naturalHeight) return;
      var r = Math.min(1.91, Math.max(0.8, img.naturalWidth / img.naturalHeight));
      box.style.aspectRatio = String(Math.round(r * 1000) / 1000);
    });
    img.src = creative.image_url;
    box.appendChild(img);
    return box;
  }

  // "4:5 post" -> "4 / 5"; a format with no ratio keeps the picture's own.
  function ratioOf(format) {
    var m = /(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/.exec(String(format || ""));
    return m ? m[1] + " / " + m[2] : null;
  }

  function kind(creative) {
    if (!creative || !creative.image_url) return null;
    var channel = String(creative.channel || "").toLowerCase();
    var story = /story|stories|9\s*:\s*16|reel/i.test(String(creative.format || ""));
    if (channel.indexOf("instagram") > -1) return story ? "ig-story" : "ig-post";
    if (channel.indexOf("facebook") > -1) return story ? "ig-story" : "fb-post";
    return null;
  }

  function igPost(creative) {
    var frame = make("div", "pv-frame pv-ig");
    var head = make("div", "pv-head");
    head.appendChild(avatar());
    head.appendChild(make("span", "pv-user", handle()));
    head.appendChild(icon("more", "pv-head-more"));
    frame.appendChild(head);

    frame.appendChild(media(creative, ratioOf(creative.format) || "4 / 5"));

    var actions = make("div", "pv-actions");
    actions.appendChild(icon("heart"));
    actions.appendChild(icon("comment"));
    actions.appendChild(icon("send"));
    actions.appendChild(make("span", "pv-spacer"));
    actions.appendChild(icon("save"));
    frame.appendChild(actions);

    var text = postText(creative);
    if (text) {
      var cap = make("p", "pv-caption");
      cap.appendChild(make("b", "pv-user", handle()));
      cap.appendChild(document.createTextNode(" "));
      caption(cap, text, 125, "more");
      frame.appendChild(cap);
    }
    frame.appendChild(make("div", "pv-time", "Just now"));
    return frame;
  }

  function igStory(creative) {
    var frame = make("div", "pv-frame pv-story");
    var img = new Image();
    img.alt = creative.headline || "AI-generated creative";
    img.src = creative.image_url;
    frame.appendChild(img);

    var top = make("div", "pv-story-top");
    top.appendChild(make("div", "pv-story-bar"));
    var who = make("div", "pv-story-who");
    who.appendChild(avatar());
    who.appendChild(make("span", "pv-user", handle()));
    who.appendChild(make("span", "pv-story-time", "now"));
    top.appendChild(who);
    frame.appendChild(top);

    var bottom = make("div", "pv-story-bottom");
    bottom.appendChild(make("span", "pv-story-reply", "Send message"));
    bottom.appendChild(icon("heart"));
    bottom.appendChild(icon("send"));
    frame.appendChild(bottom);
    return frame;
  }

  function fbPost(creative) {
    var frame = make("div", "pv-frame pv-fb");
    var head = make("div", "pv-head");
    head.appendChild(avatar());
    var who = make("div", "pv-fb-who");
    who.appendChild(make("b", "pv-user", displayName()));
    var when = make("span", "pv-fb-when");
    when.appendChild(make("span", "", "Just now"));
    when.appendChild(document.createTextNode(" · "));
    when.appendChild(icon("globe", "pv-icon-sm"));
    who.appendChild(when);
    head.appendChild(who);
    head.appendChild(icon("more", "pv-head-more"));
    frame.appendChild(head);

    var text = postText(creative);
    if (text) {
      var cap = make("p", "pv-caption pv-fb-text");
      caption(cap, text, 250, "See more");
      frame.appendChild(cap);
    }

    frame.appendChild(media(creative, ratioOf(creative.format)));

    var bar = make("div", "pv-fb-bar");
    [["like", "Like"], ["comment", "Comment"], ["send", "Share"]].forEach(function (b) {
      var item = make("span", "pv-fb-act");
      item.appendChild(icon(b[0], "pv-icon-sm"));
      item.appendChild(make("span", "", b[1]));
      bar.appendChild(item);
    });
    frame.appendChild(bar);
    return frame;
  }

  var TITLES = {
    "ig-post": "HOW IT LOOKS ON INSTAGRAM",
    "ig-story": "HOW IT LOOKS AS A STORY",
    "fb-post": "HOW IT LOOKS ON FACEBOOK"
  };

  function open(creative) {
    var type = kind(creative);
    if (!type) return;
    var opener = document.activeElement;

    var box = make("div", "pv-backdrop");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Preview of the ad as it will be posted");

    var column = make("div", "pv-column");
    var top = make("div", "pv-top");
    top.appendChild(make("span", "mono pv-title", TITLES[type]));
    var close = make("button", "pv-close");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.appendChild(icon("close"));
    top.appendChild(close);
    column.appendChild(top);

    column.appendChild(type === "ig-story" ? igStory(creative) : type === "fb-post" ? fbPost(creative) : igPost(creative));
    column.appendChild(make("p", "pv-note",
      "Close to what people will see — the app may crop or shorten it a little differently."));
    box.appendChild(column);

    function shut() {
      box.remove();
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.classList.remove("pv-lock");
      if (opener && opener.focus) opener.focus();
    }
    // Keys stay inside the preview while it is open: Escape closes it, Tab
    // walks only its own buttons, and the page's Y/N shortcuts don't fire
    // on the card underneath.
    function onKey(event) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); shut(); return; }
      if (event.key === "Tab") {
        var items = Array.prototype.slice.call(box.querySelectorAll("button"));
        if (!items.length) { event.preventDefault(); return; }
        var i = items.indexOf(document.activeElement);
        var next = event.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
        event.preventDefault();
        items[next].focus();
        return;
      }
      if (!/^(Enter| )$/.test(event.key)) event.stopPropagation();
    }
    close.addEventListener("click", shut);
    box.addEventListener("click", function (event) { if (event.target === box) shut(); });
    document.addEventListener("keydown", onKey, true);

    document.documentElement.classList.add("pv-lock");
    document.body.appendChild(box);
    close.focus();
  }

  window.LBPreview = {
    setAccount: function (info) {
      account.name = info.name || "";
      account.website = info.website || "";
      account.logoUrl = info.logoUrl || null;
    },
    kind: kind,
    open: open
  };
})();
