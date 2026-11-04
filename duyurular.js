/* =========================================================
   Avalanche — duyurular.js
   Duyuru sayfası: kart listesi, arama, detay görünümü.
   Veri: `duyurular` tablosu (yönetim panelinden eklenir).
   ========================================================= */
(function () {
  "use strict";

  var A = window.AvlAuth;
  if (!A) return;

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function longDate(ms) {
    var t = Number(ms || 0);
    if (!t) return "—";
    var d = new Date(t);
    if (isNaN(d.getTime())) return "—";
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function initials(name) {
    var p = String(name || "A").trim().split(/\s+/);
    var a = (p[0] || "A")[0] || "A";
    var b = p.length > 1 ? p[p.length - 1][0] : "";
    return (a + b).toUpperCase();
  }

  /* İçerik HTML olarak saklanabilir; yalnızca güvenli etiketler basılır. */
  var ALLOWED = /^(b|strong|i|em|u|s|br|p|div|span|ul|ol|li|blockquote|h3|h4)$/i;

  function safeHtml(raw) {
    var src = String(raw == null ? "" : raw);
    if (src.indexOf("<") === -1) return esc(src).replace(/\n/g, "<br />");

    var doc;
    try {
      doc = new DOMParser().parseFromString("<div>" + src + "</div>", "text/html");
    } catch (e) { return esc(src); }
    var root = doc.body.firstChild;
    if (!root) return "";

    function clean(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) return;
        if (child.nodeType !== 1) { child.remove(); return; }
        var tag = child.tagName.toLowerCase();
        if (!ALLOWED.test(tag)) { child.remove(); return; }
        Array.prototype.slice.call(child.attributes).forEach(function (a) {
          child.removeAttribute(a.name);
        });
        clean(child);
      });
    }

    clean(root);
    return root.innerHTML;
  }

  var items = [];
  var term = "";

  function paint() {
    var host = el("annList");
    var counter = el("annCount");
    if (!host) return;

    var list = items.filter(function (d) {
      if (!term) return true;
      var hay = (String(d.baslik || "") + " " + String(d.ozet || "") + " " +
        String(d.sahip || "") + " " + String(d.icerik || "")).toLowerCase();
      return hay.indexOf(term) > -1;
    });

    if (counter) {
      counter.textContent = list.length
        ? list.length + " duyuru"
        : "";
    }

    if (!list.length) {
      host.innerHTML =
        '<div class="ann-empty"><strong>' +
        (term ? "Sonuç bulunamadı" : "Henüz duyuru yok") + "</strong>" +
        (term
          ? "Farklı bir kelimeyle aramayı dene."
          : "Yönetim duyuru yayımladığında burada listelenir.") +
        "</div>";
      return;
    }

    host.innerHTML = list.map(function (d, i) {
      var body = d.icerik && String(d.icerik).length > (d.ozet ? 0 : 0)
        ? safeHtml(d.icerik)
        : "";

      return (
        '<article class="ann-card reveal' + (i === 0 && !term ? " ann-card--new" : "") + '">' +
        '<header class="ann-card__head">' +
        '<span class="ann-card__av" aria-hidden="true">' + esc(initials(d.sahip)) + "</span>" +
        '<div class="ann-card__meta">' +
        '<span class="ann-card__owner">' + esc(d.sahip || "Yönetim") + "</span>" +
        '<time class="ann-card__date" datetime="' + esc(new Date(Number(d.olusturma || 0)).toISOString().slice(0, 10)) + '">' +
        esc(longDate(d.olusturma)) + "</time>" +
        "</div>" +
        (d.sabit ? '<span class="ann-card__pin">Sabit</span>' : "") +
        "</header>" +
        '<h3 class="ann-card__title">' + esc(d.baslik || "Duyuru") + "</h3>" +
        (d.ozet ? '<p class="ann-card__excerpt">' + esc(d.ozet) + "</p>" : "") +
        (body
          ? '<details class="ann-card__more"><summary>Devamını oku</summary>' +
            '<div class="ann-card__body">' + body + "</div></details>"
          : "") +
        "</article>"
      );
    }).join("");
  }

  function load() {
    var host = el("annList");
    if (!host) return;

    A.listAll("duyurular", 300).then(function (rows) {
      items = rows
        .filter(function (d) { return !d.gizli; })
        .sort(function (a, b) {
          if (!!b.sabit !== !!a.sabit) return b.sabit ? 1 : -1;
          return Number(b.olusturma || 0) - Number(a.olusturma || 0);
        });
      paint();
    }).catch(function () {
      host.innerHTML =
        '<div class="ann-empty"><strong>Duyurular yüklenemedi</strong>' +
        "Bağlantını kontrol edip sayfayı yenile.</div>";
    });
  }

  var search = el("annSearch");
  if (search) {
    var timer = null;
    search.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        term = search.value.trim().toLowerCase();
        paint();
      }, 160);
    });
  }

  load();
})();
