// public/theme-init.js
(function () {
  var t = localStorage.getItem("theme");
  if (t && t !== "auto") {
    document.documentElement.setAttribute("data-theme", t);
  }
})();
