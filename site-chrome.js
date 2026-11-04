/* =========================================================
   Avalanche — site-chrome.js
   Tek kaynaktan üst menü (header).
   Sayfalar <header class="site-header" id="siteHeader"></header>
   iskeletini kullanır; içerik burada doldurulur.

   Üyelik: sağ üstteki hesap butonu oturum durumuna göre
   "Hesap Aç" veya "Profilim" gösterir. Giriş/kayıt/panel/admin
   ayrı sayfalardır — açılır pencere yoktur.
   ========================================================= */
(function () {
  "use strict";

  var host = document.getElementById("siteHeader");
  if (!host) return;

  /* Sayfa kendi header'ını yazdıysa dokunma (idempotent) */
  if (host.children.length > 0) return;

  /* Ana menü — Hakkımızda alt menülüdür */
  var NAV = [
    { file: "index.html", key: "nav.home", label: "Ana Sayfa" },
    { file: "duyurular.html", key: "nav.announcements", label: "Duyurular" },
    { file: "fiyatlar.html", key: "nav.prices", label: "Fiyatlar" },
    { file: "yonetim.html", key: "nav.management", label: "Yönetim" },
    {
      file: "hakkimizda.html",
      key: "nav.about",
      label: "Hakkımızda",
      children: [
        { file: "hakkimizda.html", key: "nav.who", label: "Biz Kimiz?" },
        { file: "kullanici-sozlesmesi.html", key: "nav.terms", label: "Kullanıcı Sözleşmesi" },
        { file: "urun-sozlesmesi.html", key: "nav.product", label: "Ürün Sözleşmesi" },
        { file: "gizlilik-politikasi.html", key: "nav.privacy", label: "Gizlilik Politikası" },
        { file: "kvkk-aydinlatma-metni.html", key: "nav.kvkk", label: "KVKK Aydınlatma Metni" },
        { file: "sss.html", key: "nav.faq", label: "Sıkça Sorulan Sorular" }
      ]
    },
    { file: "iletisim.html", key: "nav.contact", label: "İletişim" },
    { file: "forum.html", key: "nav.forum", label: "Forum" }
  ];

  /* Sosyal medya ikonları (logo yanında) */
  var SOCIALS = [
    {
      name: "instagram",
      href: "https://www.instagram.com/avlclancomtr",
      key: "social.instagram",
      label: "Instagram — @avlclancomtr"
    }
  ];

  /* Tema butonunun solundaki Telegram bağlantısı */
  var TELEGRAM = {
    href: "https://t.me/umutzio",
    key: "social.telegram",
    label: "Telegram — @umutzio"
  };

  /* Çeviri yardımcısı — i18n yüklenmemişse Türkçe metne düşer */
  function T(key, fallback) {
    var i18n = window.AvlI18n;
    if (!i18n) return fallback;
    var v = i18n.t(key, fallback);
    return v == null ? fallback : v;
  }

  var ICONS = {
    instagram:
      '<rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />' +
      '<circle cx="12" cy="12" r="4.1" />' +
      '<circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />',
    youtube:
      '<rect x="2" y="5" width="20" height="14" rx="4.5" />' +
      '<path d="M10.4 9.2l4.6 2.8-4.6 2.8z" fill="currentColor" stroke="none" />',
    tiktok:
      '<path d="M14.2 3v1.9a5.9 5.9 0 0 0 4.6 4.5v2.1a8 8 0 0 1-4.6-1.6v5.4a5.5 5.5 0 1 1-4.7-5.4v2.2a3.3 3.3 0 1 0 2.6 3.2V3z" />',
    telegram:
      '<path d="M21.2 4.1L2.9 11.2c-.8.3-.8 1.1 0 1.3l4.6 1.4 1.7 5.2c.2.7 1 .9 1.5.3l2.4-2.5 4.6 3.4c.6.4 1.4.1 1.6-.6l3-14.2c.2-.9-.6-1.6-1.1-1.4z" />' +
      '<path d="M7.5 13.9l10.2-6.3-7.4 7.1-.3 3.1" />'
  };

  function icon(name) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ICONS[name] +
      "</svg>"
    );
  }

  /* Aktif sayfayı dosya adından bul (kök '/' → index.html) */
  var path = window.location.pathname;
  var file = path.substring(path.lastIndexOf("/") + 1);
  if (!file) file = "index.html";

  function isActive(item) {
    if (item.file === file) return true;
    if (!item.children) return false;
    return item.children.some(function (child) {
      return child.file === file;
    });
  }

  var navHtml = NAV.map(function (item) {
    var active = isActive(item);
    /* Forum bağlantısı renk geçişli görünür. Gradyan `<a>` üzerine
       uygulanırsa bağlantının kendi arka plan/kenarlık kurallarıyla
       çakışıp bozuk görünüyordu; bu yüzden yalnızca içindeki metin
       katmanına uygulanır. data-i18n de o katmanda durur. */
    var isForum = item.key === "nav.forum";

    if (!item.children) {
      if (isForum) {
        return (
          '<a class="nav__link nav__link--forum' +
          (active ? " is-active" : "") +
          '" href="' +
          item.file +
          '"' +
          (active ? ' aria-current="page"' : "") +
          ">" +
          '<span class="nav__grad" data-i18n="' +
          item.key +
          '">' +
          item.label +
          "</span></a>"
        );
      }

      return (
        '<a class="nav__link' +
        (active ? " is-active" : "") +
        '" href="' +
        item.file +
        '" data-i18n="' +
        item.key +
        '"' +
        (active ? ' aria-current="page"' : "") +
        ">" +
        item.label +
        "</a>"
      );
    }

    var menuHtml = item.children
      .map(function (child) {
        var childActive = child.file === file;
        return (
          '<a class="nav__menu-link' +
          (childActive ? " is-active" : "") +
          '" href="' +
          child.file +
          '" data-i18n="' +
          child.key +
          '"' +
          (childActive ? ' aria-current="page"' : "") +
          ">" +
          child.label +
          "</a>"
        );
      })
      .join("");

    return (
      '<div class="nav__item nav__item--has-menu">' +
      '<a class="nav__link' +
      (active ? " is-active" : "") +
      '" href="' +
      item.file +
      '" data-i18n="' +
      item.key +
      '"' +
      (active ? ' aria-current="page"' : "") +
      ">" +
      item.label +
      "</a>" +
      '<button class="nav__toggle" type="button" aria-expanded="false" ' +
      'aria-controls="navAboutMenu" data-i18n-aria="nav.submenu.open" ' +
      'aria-label="Hakkımızda alt menüsünü aç" data-submenu-toggle>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6 9.5l6 6 6-6" />' +
      "</svg>" +
      "</button>" +
      '<div class="nav__menu" id="navAboutMenu">' +
      menuHtml +
      "</div>" +
      "</div>"
    );
  }).join("");

  var socialHtml = SOCIALS.map(function (item) {
    return (
      '<a class="icon-btn" href="' +
      item.href +
      '" target="_blank" rel="noopener noreferrer" data-i18n-aria="' +
      item.key +
      '" aria-label="' +
      item.label +
      '">' +
      icon(item.name) +
      "</a>"
    );
  }).join("");

  /* ---------- Oturum durumu (üst menü etiketi için) ---------- */
  var session = null;
  try {
    session = JSON.parse(window.localStorage.getItem("avl_oturum") || "null");
  } catch (err) {
    session = null;
  }
  var loggedIn = !!(session && session.id && session.token);
  var accountHref = loggedIn ? "panel.html" : "kayit.html";
  var accountLabel = loggedIn ? "Profilim" : "Hesap Aç";
  var accountKey = loggedIn ? "account.profile" : "account.signup";

  /* ---------- Dil değiştirici ---------- */
  var langHtml =
    '<div class="lang-switch" role="group" data-i18n-aria="lang.label" aria-label="Dil">' +
    '<button class="lang-btn" type="button" data-lang-btn="tr" aria-pressed="false" title="Türkçe">TR</button>' +
    '<span class="lang-sep" aria-hidden="true"></span>' +
    '<button class="lang-btn" type="button" data-lang-btn="en" aria-pressed="false" title="English">EN</button>' +
    "</div>";

  /* ---------- Yeni logo (referanstaki A) ---------- */
  var logoSvg =
    '<svg class="brand__glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
    '<defs><linearGradient id="avlGrad" x1="10%" y1="0%" x2="90%" y2="100%">' +
    '<stop offset="0%" stop-color="#ffffff" />' +
    '<stop offset="52%" stop-color="#dfe1e7" />' +
    '<stop offset="100%" stop-color="#a9adb8" />' +
    "</linearGradient></defs>" +
    /* Geçişli A: sol/sağ bacak + kesik orta çubuk */
    '<path d="M24 4.5 L43.5 43.5 H35.2 L24 20.4 L12.8 43.5 H4.5 Z" fill="url(#avlGrad)" />' +
    '<path d="M20.1 33.6h7.8l3.7 7.6h-15.2z" fill="#0b0b0c" opacity=".92" />' +
    "</svg>";

  host.innerHTML =
    '<div class="topbar">' +
    /* Sol: logo + ad + dil + sosyal ikonlar */
    '<div class="topbar__left">' +
    '<a class="brand" href="index.html" data-i18n-aria="brand.home" aria-label="Avalanche ana sayfa">' +
    logoSvg +
    '<span class="brand__name">Avalanche</span>' +
    "</a>" +
    langHtml +
    '<nav class="socials" data-i18n-aria="social.aria" aria-label="Sosyal medya">' +
    socialHtml +
    "</nav>" +
    "</div>" +
    /* Orta: sayfa bağlantıları (ekranın tam ortasında) */
    '<nav class="mainnav" id="mainnav" aria-label="Ana menü">' +
    navHtml +
    "</nav>" +
    /* Sağ: tema, yönetici durumu, üyelik, admin, mobil menü */
    '<div class="topbar__right">' +
    '<a class="icon-btn tg-btn" href="' +
    TELEGRAM.href +
    '" target="_blank" rel="noopener noreferrer" data-i18n-aria="' +
    TELEGRAM.key +
    '" data-i18n-title="' +
    TELEGRAM.key +
    '" aria-label="' +
    TELEGRAM.label +
    '" title="' +
    TELEGRAM.label +
    '">' +
    icon("telegram") +
    "</a>" +
    '<button class="theme-btn" id="themeBtn" type="button" data-theme-toggle ' +
    'aria-label="Aydınlık moda geç" aria-pressed="false">' +
    '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5 8.7 8.7 0 1 0 20.5 14.2z" />' +
    "</svg>" +
    '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4.1" />' +
    '<path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />' +
    "</svg>" +
    "</button>" +
    '<div class="status">' +
    '<button class="status__btn" id="statusBtn" type="button" aria-expanded="false" ' +
    'aria-controls="statusCard" aria-label="Yönetici durumu">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 2.8l7.4 3v6c0 4.6-3.1 8.2-7.4 9.4-4.3-1.2-7.4-4.8-7.4-9.4v-6z" />' +
    '<path d="M9 12.2l2.1 2.1 4-4.2" />' +
    "</svg>" +
    "</button>" +
    '<div class="status__card" id="statusCard" role="tooltip">' +
    '<p class="status__title" data-i18n="status.title">Yönetici Durumu</p>' +
    '<div class="status__now">' +
    '<span class="status__dot" id="statusDot" aria-hidden="true"></span>' +
    '<strong id="statusNow" data-i18n="status.loading">Yükleniyor…</strong>' +
    '<time id="statusClock">--:--:--</time>' +
    "</div>" +
    '<div class="status__hours">' +
    '<div class="status__row" data-status="musait">' +
    '<span class="status__dot dot--green" aria-hidden="true"></span>' +
    '<strong data-i18n="status.available">Müsait</strong><span>11:59–18:59</span>' +
    "</div>" +
    '<div class="status__row" data-status="yogun">' +
    '<span class="status__dot dot--amber" aria-hidden="true"></span>' +
    '<strong data-i18n="status.busy">Yoğun</strong><span>18:59–22:59</span>' +
    "</div>" +
    '<div class="status__row" data-status="mesgul">' +
    '<span class="status__dot dot--red" aria-hidden="true"></span>' +
    '<strong data-i18n="status.occupied">Meşgul</strong><span>22:59–11:59</span>' +
    "</div>" +
    "</div>" +
    '<p class="status__foot" data-i18n="status.foot">Türkiye saati · GMT+3</p>' +
    "</div>" +
    "</div>" +
    /* Üyelik: Hesap Aç / Profilim */
    '<a class="account-btn" id="accountBtn" href="' +
    accountHref +
    '" data-account-btn>' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="8.4" r="3.6" />' +
    '<path d="M4.8 20.2c0-3.7 3.2-6 7.2-6s7.2 2.3 7.2 6" />' +
    "</svg>" +
    '<span data-i18n="' +
    accountKey +
    '">' +
    accountLabel +
    "</span>" +
    "</a>" +
    /* Yönetici paneli — ayrı sayfa */
    '<a class="admin-btn" href="admin.html" data-i18n-aria="admin.panel" ' +
    'aria-label="Yönetici paneli" data-i18n-title="admin.panel" title="Yönetici paneli">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 2.8l7.4 3v6c0 4.6-3.1 8.2-7.4 9.4-4.3-1.2-7.4-4.8-7.4-9.4v-6z" />' +
    '<path d="M12 8.6v4.2M12 15.6v.2" />' +
    "</svg>" +
    "</a>" +
    '<button class="burger" id="burger" type="button" aria-expanded="false" ' +
    'aria-controls="mainnav" aria-label="Menüyü aç">' +
    "<span></span><span></span><span></span>" +
    "</button>" +
    "</div>" +
    "</div>";
})();
