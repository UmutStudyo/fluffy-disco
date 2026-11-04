/* =========================================================
   Avalanche — main.js
   Ortak davranışlar:
   1) Header gölgesi (scroll)
   2) Mobil menü
   3) Yönetici durumu — Europe/Istanbul gerçek zamanlı
   4) Scroll reveal
   5) Adres kopyalama (sunucu / TeamSpeak)
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 1. Header scroll durumu ---------- */
  var header = document.getElementById("siteHeader");

  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 2. Mobil menü ---------- */
  var burger = document.getElementById("burger");
  var mainnav = document.getElementById("mainnav");

  function closeMenu() {
    if (!burger || !mainnav) return;
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Menüyü aç");
    mainnav.classList.remove("is-open");
  }

  if (burger && mainnav) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", open ? "false" : "true");
      burger.setAttribute("aria-label", open ? "Menüyü aç" : "Menüyü kapat");
      mainnav.classList.toggle("is-open", !open);
    });

    mainnav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1000) closeMenu();
    });
  }

  /* ---------- 3. Yönetici durumu (Europe/Istanbul) ----------
     Kullanıcının cihaz saat dilimi DEĞİL, her zaman Türkiye saati.
     Tek zaman kontrol sistemi: gece yarısından itibaren geçen DAKİKA
     bir kez hesaplanır, üç aralık da o tek değerden türetilir. Böylece
     saat/dakika geçişlerinde bantlar çakışmaz veya boşluk bırakmaz.
       Müsait  11:59–18:59
       Yoğun   18:59–22:59
       Meşgul  22:59–11:59 */
  var STATUS_MAP = {
    mesgul: { key: "status.occupied", label: "Meşgul", color: "#f2635b", glow: "rgba(242,99,91,.75)" },
    yogun: { key: "status.busy", label: "Yoğun", color: "#f2b544", glow: "rgba(242,181,68,.75)" },
    musait: { key: "status.available", label: "Müsait", color: "#35d07f", glow: "rgba(53,208,127,.75)" }
  };

  var statusBtn = document.getElementById("statusBtn");
  var statusCard = document.getElementById("statusCard");
  var statusWrap = statusBtn ? statusBtn.closest(".status") : null;
  var statusNow = document.getElementById("statusNow");
  var statusClock = document.getElementById("statusClock");
  var statusDot = document.getElementById("statusDot");
  var statusRows = document.querySelectorAll(".status__row[data-status]");

  var clockFormatter = null;
  try {
    clockFormatter = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  } catch (err) {
    clockFormatter = null;
  }

  /* Europe/Istanbul yerel saat bileşenleri (DST güvenli) */
  function istanbulParts() {
    var now = new Date();

    if (clockFormatter) {
      try {
        var parts = { hour: 0, minute: 0, second: 0 };
        clockFormatter.formatToParts(now).forEach(function (part) {
          if (part.type === "hour") parts.hour = parseInt(part.value, 10) % 24;
          if (part.type === "minute") parts.minute = parseInt(part.value, 10);
          if (part.type === "second") parts.second = parseInt(part.value, 10);
        });
        return parts;
      } catch (err2) {
        /* aşağıdaki sabit ofsete düş */
      }
    }

    /* Yedek: Türkiye 2016'dan beri kalıcı UTC+3 */
    var t = new Date(now.getTime() + 3 * 3600 * 1000);
    return { hour: t.getUTCHours(), minute: t.getUTCMinutes(), second: t.getUTCSeconds() };
  }

  /* Bant sınırları — tek kaynak (dakika cinsinden) */
  var BAND = {
    musaitStart: 11 * 60 + 59,   /* 11:59 */
    yogunStart: 18 * 60 + 59,    /* 18:59 */
    mesgulStart: 22 * 60 + 59    /* 22:59 */
  };

  /* Tek zaman kontrolü: verilen saat/dakikadan durum anahtarı üretir.
     Sınır dakikaları bir sonraki banda aittir (18:59 → yoğun). */
  function statusKeyFor(hour, minute) {
    var m = hour * 60 + (minute || 0);

    if (m >= BAND.musaitStart && m < BAND.yogunStart) return "musait";
    if (m >= BAND.yogunStart && m < BAND.mesgulStart) return "yogun";
    return "mesgul";
  }

  function pad(value) {
    return value < 10 ? "0" + value : String(value);
  }

  var lastKey = null;

  function renderStatus() {
    var parts = istanbulParts();
    var key = statusKeyFor(parts.hour, parts.minute);
    var info = STATUS_MAP[key];
    var i18n = window.AvlI18n;
    var label = i18n ? i18n.t(info.key, info.label) : info.label;

    if (statusClock) {
      statusClock.textContent = pad(parts.hour) + ":" + pad(parts.minute) + ":" + pad(parts.second);
    }

    /* Durum değişmediyse DOM'u yeniden yazmayalım */
    if (key !== lastKey || renderStatus.lastLabel !== label) {
      lastKey = key;
      renderStatus.lastLabel = label;

      if (statusNow) statusNow.textContent = label;

      if (statusDot) {
        statusDot.style.background = info.color;
        statusDot.style.boxShadow = "0 0 8px " + info.glow;
      }

      if (statusBtn) {
        statusBtn.style.setProperty("--status-color", info.color);
        statusBtn.style.setProperty("--status-glow", info.glow);
        statusBtn.setAttribute("aria-label", label);
        statusBtn.setAttribute("data-status", key);
      }

      Array.prototype.forEach.call(statusRows, function (row) {
        row.classList.toggle("is-current", row.getAttribute("data-status") === key);
      });
    }
  }

  renderStatus();
  window.setInterval(renderStatus, 1000);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) renderStatus();
  });

  /* Kalkan kutusu — hover CSS ile, tıklama/dokunma JS ile */
  if (statusBtn && statusCard) {
    statusBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      var open = statusCard.classList.toggle("is-open");
      statusBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", function (event) {
      if (statusWrap && statusWrap.contains(event.target)) return;
      statusCard.classList.remove("is-open");
      statusBtn.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        statusCard.classList.remove("is-open");
        statusBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- 4. Scroll reveal ---------- */
  var pending = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var stagger = 0;
  var ticking = false;

  function checkReveals() {
    ticking = false;
    var vh = window.innerHeight || document.documentElement.clientHeight;

    for (var i = pending.length - 1; i >= 0; i -= 1) {
      var el = pending[i];
      var rect = el.getBoundingClientRect();

      if (rect.top < vh * 0.92 && rect.bottom > -80) {
        el.style.transitionDelay = Math.min(stagger, 6) * 55 + "ms";
        stagger += 1;
        el.classList.add("is-visible");
        pending.splice(i, 1);
      }
    }
  }

  function onRevealScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(checkReveals);
  }

  if (pending.length && reduceMotion) {
    pending.forEach(function (el) {
      el.classList.add("is-visible");
    });
    pending = [];
  } else if (pending.length) {
    checkReveals();
    window.addEventListener("scroll", onRevealScroll, { passive: true });
    window.addEventListener("resize", onRevealScroll, { passive: true });
    window.addEventListener("load", checkReveals);

    window.setTimeout(function () {
      pending.forEach(function (el) {
        el.classList.add("is-visible");
      });
      pending = [];
    }, 3000);
  }

  /* ---------- 5. Kopyala (sunucu / TeamSpeak adresi) ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    /* Yedek: gizli textarea + execCommand */
    return new Promise(function (resolve, reject) {
      try {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.top = "-1000px";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(area);
        if (ok) resolve();
        else reject(new Error("kopyalanamadı"));
      } catch (err) {
        reject(err);
      }
    });
  }

  Array.prototype.forEach.call(
    document.querySelectorAll("[data-copy]"),
    function (btn) {
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-copy") || "";
        if (!value) return;

        var label = btn.querySelector("[data-copy-label]");
        var original = label ? label.textContent : "";

        copyText(value)
          .then(function () {
            btn.classList.add("is-copied");
            if (label) label.textContent = "Kopyalandı";
          })
          .catch(function () {
            btn.classList.add("is-copy-error");
            if (label) label.textContent = "Kopyalanamadı";
          })
          .then(function () {
            window.setTimeout(function () {
              btn.classList.remove("is-copied");
              btn.classList.remove("is-copy-error");
              if (label) label.textContent = original;
            }, 1800);
          });
      });
    }
  );

  /* ---------- 6. Aydınlık / karanlık tema ----------
     Seçim localStorage'da saklanır; varsayılan karanlık.
     İlk boyamadan önce <head>'deki küçük script uygular (flash yok). */
  var THEME_KEY = "avl_theme";
  var root = document.documentElement;
  var themeBtn = document.getElementById("themeBtn");

  function currentTheme() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function applyTheme(theme, persist) {
    if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");

    if (themeBtn) {
      var light = theme === "light";
      themeBtn.setAttribute("aria-pressed", light ? "true" : "false");
      themeBtn.setAttribute(
        "aria-label",
        light ? "Karanlık moda geç" : "Aydınlık moda geç"
      );
      themeBtn.setAttribute("title", light ? "Karanlık mod" : "Aydınlık mod");
    }

    if (persist) {
      try {
        window.localStorage.setItem(THEME_KEY, theme);
      } catch (err) {
        /* gizli mod / depolama kapalı — sessizce geç */
      }
    }
  }

  applyTheme(currentTheme(), false);

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      applyTheme(currentTheme() === "light" ? "dark" : "light", true);
    });
  }

  /* Başka sekmede tema değişirse yakala */
  window.addEventListener("storage", function (event) {
    if (event.key === THEME_KEY) {
      applyTheme(event.newValue === "light" ? "light" : "dark", false);
    }
    if (event.key === "avl_lang" && window.AvlI18n) {
      window.AvlI18n.apply(event.newValue === "en" ? "en" : "tr");
    }
  });

  /* ---------- 6b. Dil değiştirici ---------- */
  Array.prototype.forEach.call(
    document.querySelectorAll("[data-lang-btn]"),
    function (btn) {
      btn.addEventListener("click", function () {
        if (!window.AvlI18n) return;
        window.AvlI18n.set(btn.getAttribute("data-lang-btn"), true);
        renderStatus();
      });
    }
  );

  /* ---------- 7. Hakkımızda açılır alt menüsü ---------- */
  var submenuToggles = document.querySelectorAll("[data-submenu-toggle]");

  Array.prototype.forEach.call(submenuToggles, function (toggle) {
    var menuId = toggle.getAttribute("aria-controls");
    var menu = menuId ? document.getElementById(menuId) : null;
    if (!menu) return;

    toggle.addEventListener("click", function (event) {
      event.stopPropagation();
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", open ? "false" : "true");
      toggle.setAttribute(
        "aria-label",
        open ? "Hakkımızda alt menüsünü aç" : "Hakkımızda alt menüsünü kapat"
      );
      menu.classList.toggle("is-open", !open);
    });
  });

  /* Dışarı tıklama ve Escape alt menüyü kapatır */
  document.addEventListener("click", function (event) {
    Array.prototype.forEach.call(submenuToggles, function (toggle) {
      var menuId = toggle.getAttribute("aria-controls");
      var menu = menuId ? document.getElementById(menuId) : null;
      if (!menu) return;
      if (menu.contains(event.target) || toggle.contains(event.target)) return;
      toggle.setAttribute("aria-expanded", "false");
      menu.classList.remove("is-open");
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    Array.prototype.forEach.call(submenuToggles, function (toggle) {
      var menuId = toggle.getAttribute("aria-controls");
      var menu = menuId ? document.getElementById(menuId) : null;
      if (menu) menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  /* ---------- 8. Üyelik ----------
     Giriş, kayıt, üye paneli ve yönetici paneli artık AYRI SAYFALARDIR
     (giris.html, kayit.html, panel.html, admin.html).
     Açılır pencere kullanılmaz; oturum arayüzü bu dosyada değildir. */
})();
