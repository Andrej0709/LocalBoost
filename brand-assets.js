/* Brand material the customer uploads: their logo, photos of the place and
   what they sell, and their menu or price list. The engine works from these
   so an ad shows *their* pizza, not a pizza.

   Files live in the private "brand-assets" Storage bucket at
   <user id>/<kind>/<file>. The bucket's policies (schema.sql, section 10)
   limit each account to its own folder, cap how many files of each kind it
   keeps, and refuse anything that isn't JPEG, PNG or WebP (or a PDF menu)
   over 10 MB. The checks here only give a clearer message sooner.

   Needs auth.js (LBAuth) loaded first. */
(function () {
  var BUCKET = "brand-assets";
  var MAX_BYTES = 10 * 1024 * 1024;

  // Keep max in step with brand_asset_has_room() in schema.sql.
  var KINDS = {
    logo:   { max: 1,  types: ["image/png", "image/jpeg", "image/webp"] },
    photos: { max: 12, types: ["image/jpeg", "image/png", "image/webp"] },
    menu:   { max: 3,  types: ["image/jpeg", "image/png", "image/webp", "application/pdf"] }
  };
  var EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

  function db() { return LBAuth.db.storage.from(BUCKET); }
  function userId() { return LBAuth.getUser().id; }

  // "Margherita (2).JPG" -> "margherita-2", so the stored name stays readable
  // but only uses characters every Storage key accepts.
  function slug(name) {
    return String(name || "")
      .replace(/\.[^.]*$/, "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "file";
  }

  // What the customer sees: the name they uploaded, without our timestamp.
  function label(fileName) {
    return fileName.replace(/^\d+-/, "");
  }

  async function list(kind) {
    var res = await db().list(userId() + "/" + kind, { limit: 100, sortBy: { column: "created_at", order: "asc" } });
    if (res.error) throw LBAuth.friendlyError(res.error);
    return (res.data || [])
      // Storage lists a placeholder for an empty folder; real files carry an id.
      .filter(function (f) { return f.id && f.name !== ".emptyFolderPlaceholder"; })
      .map(function (f) {
        return {
          path: userId() + "/" + kind + "/" + f.name,
          name: label(f.name),
          size: f.metadata && f.metadata.size,
          isPdf: /\.pdf$/i.test(f.name)
        };
      });
  }

  async function listAll() {
    var kinds = Object.keys(KINDS);
    var lists = await Promise.all(kinds.map(list));
    var out = {};
    kinds.forEach(function (k, i) { out[k] = lists[i]; });
    return out;
  }

  // Throws an Error whose message can go straight to the customer.
  function check(kind, file, alreadyHeld) {
    var spec = KINDS[kind];
    if (alreadyHeld >= spec.max) {
      throw new Error("That's the most you can keep here — remove one first.");
    }
    if (spec.types.indexOf(file.type) < 0) {
      throw new Error(kind === "menu"
        ? "Use a JPEG, PNG, WebP or PDF file."
        : "Use a JPEG, PNG or WebP image.");
    }
    // A big image gets shrunk on upload; a PDF can't be.
    if (file.type === "application/pdf" && file.size > MAX_BYTES) throw new Error("That file is over 10 MB.");
  }

  // Phone cameras can take photos over the 10 MB cap. Redraw one like that at
  // 2560 px on the long side, which is still plenty for the engine.
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 2560 / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error("Couldn't read that image.")); return; }
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        }, "image/jpeg", 0.9);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Couldn't read that image."));
      };
      img.src = url;
    });
  }

  async function upload(kind, file) {
    if (file.size > MAX_BYTES && file.type !== "application/pdf") file = await shrink(file);
    if (file.size > MAX_BYTES) throw new Error("That file is over 10 MB.");
    // Digits only before the dash (label() strips them); the random tail keeps
    // two same-named files picked together from colliding.
    var stamp = Date.now() + String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    var path = userId() + "/" + kind + "/" + stamp + "-" + slug(file.name) + "." + EXT[file.type];
    var res = await db().upload(path, file, { contentType: file.type, upsert: false });
    if (res.error) throw LBAuth.friendlyError(res.error);
    return path;
  }

  async function remove(paths) {
    if (!paths.length) return;
    var res = await db().remove(paths);
    if (res.error) throw LBAuth.friendlyError(res.error);
  }

  // Short-lived links for showing the customer their own files.
  async function signedUrls(paths) {
    var out = {};
    if (!paths.length) return out;
    var res = await db().createSignedUrls(paths, 60 * 60);
    if (res.error) throw LBAuth.friendlyError(res.error);
    (res.data || []).forEach(function (r) { if (r.signedUrl) out[r.path] = r.signedUrl; });
    return out;
  }

  // Every file this account uploaded — LBAuth.deleteAccount runs this before
  // the login goes, since the database's cascade doesn't reach Storage.
  async function removeAll() {
    var all;
    try {
      all = await listAll();
    } catch (err) {
      // No bucket yet (schema.sql section 10 not run) means no files either.
      if (/bucket not found/i.test(err.message || "")) return;
      throw err;
    }
    var paths = [];
    Object.keys(all).forEach(function (k) {
      all[k].forEach(function (f) { paths.push(f.path); });
    });
    await remove(paths);
  }

  window.LBBrand = {
    KINDS: KINDS,
    accept: function (kind) { return KINDS[kind].types.join(","); },
    list: list,
    listAll: listAll,
    check: check,
    upload: upload,
    remove: remove,
    signedUrls: signedUrls,
    removeAll: removeAll
  };
})();
