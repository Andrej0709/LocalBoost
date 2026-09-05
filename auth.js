window.LBAuth = {
  isLoggedIn: function () {
    try { return localStorage.getItem("lb_logged_in") === "true"; } catch (e) { return false; }
  },
  getUser: function () {
    try { return JSON.parse(localStorage.getItem("lb_user") || "null"); } catch (e) { return null; }
  },
  login: function (user) {
    try {
      localStorage.setItem("lb_logged_in", "true");
      localStorage.setItem("lb_user", JSON.stringify(user || {}));
    } catch (e) {}
  },
  logout: function () {
    try {
      localStorage.removeItem("lb_logged_in");
      localStorage.removeItem("lb_user");
    } catch (e) {}
  }
};
