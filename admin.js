/* =========================================================
   Avalanche — admin.js
   Yönetici paneli.

   GÜVENLİK AKIŞI
   • Panel açıldığında hiçbir bölüm görünmez; önce giriş formu gelir.
   • Kimlik bilgileri frontend'de DÜZ METİN yoktur. `admin_giris`
     tablosunda PBKDF2-SHA256 tuzu + doğrulayıcısı (210.000 tur) durur.
   • Girişte 4 haneli güvenlik kodu da zorunludur. Kod yanlışsa
     giriş engellenir.
   • Başarılı girişte oturum sessionStorage'a yazılır ve her bölüm
     açılışı bu oturumu yeniden doğrular.

   DÜRÜST SINIR (README'de ayrıntılı): Bu proje statik bir sitedir;
   platformda çalıştırılabilir sunucu yoktur. Bu nedenle yetki kontrolü
   uygulama düzeyinde kalır ve sunucu tarafından zorlanmaz. Tablo
   uçları herkese açıktır; bu panel prototip niteliğindedir.
   ========================================================= */
(function () {
  "use strict";

  var A = window.AvlAuth;
  if (!A) return;

  var I = window.AvlI18n;
  function T(k, f) {
    if (I && typeof I.t === "function") return I.t(k, f);
    return f != null ? f : k;
  }

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function money(n) {
    return Number(n || 0).toLocaleString(I && I.lang() === "en" ? "en-US" : "tr-TR");
  }

  function fmt(ms) {
    var t = Number(ms || 0);
    if (!t) return "—";
    try {
      return new Date(t).toLocaleString("tr-TR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch (e) { return "—"; }
  }

  function when(ms) {
    var t = Number(ms || 0);
    if (!t) return "";
    var diff = (Date.now() - t) / 1000;
    if (diff < 60) return "az önce";
    if (diff < 3600) return Math.floor(diff / 60) + " dk önce";
    if (diff < 86400) return Math.floor(diff / 3600) + " sa önce";
    if (diff < 2592000) return Math.floor(diff / 86400) + " gün önce";
    return new Date(t).toLocaleDateString("tr-TR");
  }

  function status(node, message, kind) {
    if (!node) return;
    node.textContent = message || "";
    node.classList.remove("is-error", "is-ok");
    if (kind) node.classList.add(kind);
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  var dash = el("dash");

  /* =========================================================
     1. Yönetici oturumu
     ========================================================= */

  var ADMIN_SESSION = "avl_admin_oturum";
  var me = null;            /* { rol: "admin" } */

  function readAdminSession() {
    try {
      var raw = window.sessionStorage.getItem(ADMIN_SESSION);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.token) return null;
      if (Number(s.exp || 0) < Date.now()) return null;
      return s;
    } catch (e) { return null; }
  }

  function writeAdminSession() {
    try {
      window.sessionStorage.setItem(ADMIN_SESSION, JSON.stringify({
        token: A.hex(A.random(20)),
        exp: Date.now() + 2 * 3600 * 1000
      }));
    } catch (e) { /* depolama kapalı */ }
  }

  function clearAdminSession() {
    try { window.sessionStorage.removeItem(ADMIN_SESSION); } catch (e) {}
  }

  /* Kritik işlemler için yetki kapısı — her işlem öncesi çağrılır */
  function guard() {
    if (me && readAdminSession()) return true;
    showGate();
    return false;
  }

  /* =========================================================
     2. Bölüm gezinme
     ========================================================= */

  var TITLES = {
    genel: "Genel Bakış",
    uyeler: "Kullanıcılar",
    forum: "Forum",
    destek: "Destek",
    bildirim: "Bildirimler",
    magaza: "Supreme / Mağaza",
    kayitlar: "İşlem Kayıtları"
  };

  function showPanelRaw(name) {
    Array.prototype.forEach.call(document.querySelectorAll(".dash-panel"), function (p) {
      p.classList.toggle("is-active", p.id === "p-" + name);
    });
    if (name !== "giris") {
      Array.prototype.forEach.call(document.querySelectorAll(".dash__link[data-panel]"), function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-panel") === name);
      });
    }
    var bar = el("mobileBarTitle");
    if (bar) bar.textContent = TITLES[name] || "Yönetim";
    closeDrawer();
  }

  function showPanel(name) {
    if (!guard()) return;
    showPanelRaw(name);

    if (name === "genel") loadOverview();
    if (name === "uyeler") loadUsers();
    if (name === "forum") loadForum();
    if (name === "destek") loadTickets();
    if (name === "bildirim") loadAnnounceTargets();
    if (name === "magaza") loadShop();
    if (name === "kayitlar") loadLogs();
  }

  Array.prototype.forEach.call(document.querySelectorAll(".dash__link[data-panel]"), function (b) {
    b.addEventListener("click", function () {
      showPanel(b.getAttribute("data-panel"));
    });
  });

  function openDrawer() {
    if (!dash) return;
    dash.classList.add("is-sideopen");
    var b = el("dashBurger");
    if (b) b.setAttribute("aria-expanded", "true");
  }

  function closeDrawer() {
    if (!dash) return;
    dash.classList.remove("is-sideopen");
    var b = el("dashBurger");
    if (b) b.setAttribute("aria-expanded", "false");
  }

  var burger = el("dashBurger");
  if (burger) {
    burger.addEventListener("click", function () {
      if (dash.classList.contains("is-sideopen")) closeDrawer();
      else openDrawer();
    });
  }

  var scrim = el("dashScrim");
  if (scrim) scrim.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  /* =========================================================
     3. Çıkış
     ========================================================= */

  var confirmBox = el("logoutConfirm");
  var logoutBtn = el("logoutBtn");
  var pendingAction = null;

  function askConfirm(title, text, onYes) {
    if (!confirmBox) { onYes(); return; }
    var h = el("logoutTitle");
    if (h) h.textContent = title;
    var p = confirmBox.querySelector(".confirm__box p");
    if (p) p.textContent = text;
    pendingAction = onYes;
    confirmBox.classList.add("is-open");
    confirmBox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeConfirm() {
    if (!confirmBox) return;
    confirmBox.classList.remove("is-open");
    confirmBox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    pendingAction = null;
    if (logoutBtn) logoutBtn.focus();
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      if (!me) { showGate(); return; }
      askConfirm(
        "Çıkış yapmak istediğine emin misin?",
        "Yönetici oturumun kapatılacak.",
        function () {
          clearAdminSession();
          me = null;
          window.location.href = "index.html";
        }
      );
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-confirm-close]"), function (b) {
    b.addEventListener("click", closeConfirm);
  });

  var logoutYes = el("logoutYes");
  if (logoutYes) {
    logoutYes.addEventListener("click", function () {
      var fn = pendingAction;
      pendingAction = null;
      closeConfirm();
      if (typeof fn === "function") fn();
    });
  }

  /* =========================================================
     4. Giriş kapısı + 4 haneli kod
     ========================================================= */

  var adminCaptcha = "";

  function setAdminCaptcha() {
    adminCaptcha = A.newCaptcha();
    var img = el("aCatchaImg");
    if (img) {
      img.textContent = adminCaptcha;
      img.classList.remove("is-wrong");
    }
    var input = el("aCaptcha");
    if (input) input.value = "";
  }

  function showFieldErr(inputId, errId, message) {
    var input = el(inputId);
    var err = el(errId);
    if (input) input.classList.toggle("is-invalid", !!message);
    if (err) {
      err.textContent = message || "";
      err.classList.toggle("is-shown", !!message);
    }
    return !message;
  }

  function showGate() {
    me = null;
    if (dash) dash.classList.add("is-gated");
    Array.prototype.forEach.call(document.querySelectorAll(".dash__link[data-panel]"), function (b) {
      b.classList.add("is-locked");
    });
    showPanelRaw("giris");
  }

  setAdminCaptcha();

  var captchaRefresh = el("aCaptchaNew");
  if (captchaRefresh) {
    captchaRefresh.addEventListener("click", function () {
      setAdminCaptcha();
      showFieldErr("aCaptcha", "eACaptcha", "");
      var input = el("aCaptcha");
      if (input) input.focus();
    });
  }

  var captchaInput = el("aCaptcha");
  if (captchaInput) {
    captchaInput.addEventListener("input", function () {
      captchaInput.value = captchaInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    });
  }

  /* admin_giris tablosunda kimlik ara */
  function findAdminRow(kimlik) {
    var raw = String(kimlik || "").trim();
    if (!raw) return Promise.resolve(null);
    var lower = raw.toLowerCase();

    return A.api("admin_giris?search=" + encodeURIComponent(lower) + "&limit=50")
      .then(function (res) {
        var rows = (res && res.data) || [];
        return rows.filter(function (r) {
          var u = String(r.kullanici_adi || "").toLowerCase();
          var e = String(r.email || "").toLowerCase();
          return u === lower || e === lower;
        })[0] || null;
      })
      .catch(function () { return null; });
  }

  /* Giriş denemesini kaydet */
  function logLogin(kimlik, ok, note) {
    return A.createRow("admin_giris_kayit", {
      kullanici_adi: String(kimlik || "").slice(0, 60),
      basari: !!ok,
      not: note || "",
      olusturma: Date.now()
    }).catch(function () {});
  }

  /* Yönetim işlemini kaydet */
  function logAction(islem, hedef, detay, sonuc) {
    return A.createRow("admin_islem", {
      yonetici: "admin",
      islem: islem,
      hedef: String(hedef || ""),
      detay: String(detay || "").slice(0, 500),
      sonuc: sonuc || "ok",
      olusturma: Date.now()
    }).catch(function () {});
  }

  var adminForm = el("adminForm");
  if (adminForm) {
    adminForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var kimlikInput = el("aKimlik");
      var sifreInput = el("aSifre");
      var submit = el("aLoginSubmit");
      var out = el("aLoginStatus");

      status(out, "", null);

      var kimlik = kimlikInput ? kimlikInput.value.trim() : "";
      var sifre = sifreInput ? sifreInput.value : "";
      var code = captchaInput ? captchaInput.value.toUpperCase() : "";

      var ok = true;
      ok = showFieldErr("aKimlik", "eAKimlik", kimlik ? "" : "Kullanıcı adı veya e-posta girin.") && ok;
      ok = showFieldErr("aSifre", "eASifre", sifre ? "" : "Şifrenizi girin.") && ok;

      var codeErr = "";
      if (!code) codeErr = "Güvenlik kodunu girin.";
      else if (code !== adminCaptcha) codeErr = "Güvenlik kodu yanlış.";
      ok = showFieldErr("aCaptcha", "eACaptcha", codeErr) && ok;

      if (!ok) {
        if (code !== adminCaptcha) {
          setAdminCaptcha();
          var img = el("aCatchaImg");
          if (img) img.classList.add("is-wrong");
        }
        status(out, "Lütfen işaretli alanları doldurun.", "is-error");
        return;
      }

      if (!window.crypto || !window.crypto.subtle) {
        status(out, "Bu tarayıcı güvenli şifreleme desteklemiyor.", "is-error");
        return;
      }

      if (submit) {
        submit.disabled = true;
        submit.textContent = "Kontrol ediliyor…";
      }
      status(out, "Kontrol ediliyor…", null);

      findAdminRow(kimlik)
        .then(function (row) {
          if (!row) return false;
          var parts = String(row.sifre_hash || "").split(":");
          if (parts.length !== 2) return false;
          var salt = A.fromB64(parts[0]);
          var verifier = parts[1];
          return A.derive(sifre, salt).then(function (bits) {
            return A.safeEqual(A.b64(bits.slice(0, 32)), verifier);
          });
        })
        .then(function (granted) {
          logLogin(kimlik, granted, granted ? "başarılı" : "hatalı kimlik veya şifre");

          if (!granted) {
            showFieldErr("aKimlik", "eAKimlik", "");
            showFieldErr("aSifre", "eASifre", "Kullanıcı adı veya şifre hatalı.");
            status(out, "Kullanıcı adı veya şifre hatalı.", "is-error");
            setAdminCaptcha();
            return false;
          }

          writeAdminSession();
          if (sifreInput) sifreInput.value = "";
          if (captchaInput) captchaInput.value = "";
          status(out, "Giriş başarılı. Panel açılıyor…", "is-ok");

          window.setTimeout(function () { enterPanel(); }, 360);
          return true;
        })
        .catch(function () {
          status(out, "Giriş yapılamadı. Bağlantını kontrol edip tekrar dene.", "is-error");
        })
        .then(function () {
          if (submit) {
            submit.disabled = false;
            submit.textContent = "Giriş Yap";
          }
        });
    });
  }

  function enterPanel() {
    if (!readAdminSession()) { showGate(); return; }
    me = { rol: "admin" };
    if (dash) dash.classList.remove("is-gated");
    Array.prototype.forEach.call(document.querySelectorAll(".dash__link[data-panel]"), function (b) {
      b.classList.remove("is-locked");
    });
    showPanel("genel");
  }

  /* =========================================================
     5. Genel Bakış
     ========================================================= */

  function statBox(label, value, sub) {
    return '<div class="stat-box"><div class="stat-box__label">' + esc(label) +
      '</div><div class="stat-box__val">' + esc(value) +
      (sub ? "<small>" + esc(sub) + "</small>" : "") + "</div></div>";
  }

  function loadOverview() {
    var host = el("ovStats");
    if (!host) return;
    host.innerHTML = '<div class="empty"><strong>Yükleniyor…</strong></div>';

    Promise.all([
      A.listAll("uyeler", 1000).catch(function () { return []; }),
      A.listAll("forum_konular", 800).catch(function () { return []; }),
      A.listAll("forum_yorumlar", 800).catch(function () { return []; }),
      A.listAll("destek_talepleri", 500).catch(function () { return []; })
    ]).then(function (res) {
      var users = res[0], topics = res[1], replies = res[2], tickets = res[3];

      var today = todayKey();
      var todayCount = users.filter(function (u) {
        if (!u.olusturma) return false;
        var d = new Date(Number(u.olusturma));
        var k = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
        return k === today;
      }).length;

      var active = users.filter(function (u) { return u.durum !== "engelli"; }).length;
      var openTickets = tickets.filter(function (t) { return t.durum === "bekliyor"; }).length;

      host.innerHTML =
        statBox("Toplam üye", money(users.length)) +
        statBox("Aktif kullanıcı", money(active)) +
        statBox("Bugün kayıt", money(todayCount)) +
        statBox("Toplam konu", money(topics.length)) +
        statBox("Toplam yorum", money(replies.length)) +
        statBox("Açık destek", money(openTickets));

      var badge = el("userCount");
      if (badge) {
        badge.textContent = users.length ? String(users.length) : "";
        badge.setAttribute("data-count", users.length ? "1" : "0");
      }
      var tb = el("ticketCount");
      if (tb) {
        tb.textContent = openTickets ? String(openTickets) : "";
        tb.setAttribute("data-count", openTickets ? "1" : "0");
      }

      allUsers = users;
      paintChart(users);
    }).catch(function () {
      host.innerHTML = '<div class="empty"><strong>İstatistikler yüklenemedi</strong></div>';
    });

    loadActionLog("ovLog", 100);
  }

  /* Son 7 günün kayıt grafiği (bağımlılık yok) */
  function paintChart(users) {
    var panel = el("p-genel");
    if (!panel) return;

    var old = el("ovChart");
    if (old) old.parentNode.removeChild(old);

    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        key: d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2),
        label: d.toLocaleDateString("tr-TR", { weekday: "short" }),
        n: 0
      });
    }

    users.forEach(function (u) {
      if (!u.olusturma) return;
      var dt = new Date(Number(u.olusturma));
      var k = dt.getFullYear() + "-" + ("0" + (dt.getMonth() + 1)).slice(-2) + "-" + ("0" + dt.getDate()).slice(-2);
      days.forEach(function (day) { if (day.key === k) day.n += 1; });
    });

    var max = Math.max.apply(null, days.map(function (d) { return d.n; }).concat([1]));

    var card = document.createElement("div");
    card.className = "pcard";
    card.id = "ovChart";
    card.style.marginBottom = "16px";
    card.innerHTML =
      '<h3 class="pcard__title">Son 7 Gün Kayıt</h3>' +
      '<div class="bar-chart">' +
      days.map(function (d) {
        var h = Math.round((d.n / max) * 100);
        return '<div class="bar-chart__col">' +
          '<span class="bar-chart__n">' + d.n + "</span>" +
          '<span class="bar-chart__bar" style="height:' + Math.max(3, h) + '%"></span>' +
          '<span class="bar-chart__lbl">' + esc(d.label) + "</span></div>";
      }).join("") +
      "</div>";

    var logCard = el("ovLog");
    if (logCard && logCard.parentNode) logCard.parentNode.parentNode.insertBefore(card, logCard.parentNode);
    else panel.appendChild(card);
  }

  /* =========================================================
     6. İşlem kaydı listeleri
     ========================================================= */

  function moveLine(txt, sub, amt) {
    return '<div class="move">' +
      '<span class="move__dot move__dot--info"></span>' +
      '<div class="move__body"><div class="move__txt">' + esc(txt) + "</div>" +
      '<div class="move__when">' + esc(sub) + "</div></div>" +
      (amt ? '<span class="move__amt">' + esc(amt) + "</span>" : "") +
      "</div>";
  }

  function loadActionLog(hostId, limit) {
    var host = el(hostId);
    if (!host) return;

    A.listAll("admin_islem", 500).then(function (rows) {
      var list = rows.sort(function (a, b) {
        return Number(b.olusturma || 0) - Number(a.olusturma || 0);
      }).slice(0, limit || 100);

      if (!list.length) {
        host.innerHTML = '<div class="empty"><strong>Kayıt yok</strong>Yönetim işlemleri burada listelenir.</div>';
        return;
      }

      host.innerHTML = list.map(function (r) {
        return moveLine(
          (r.islem || "işlem") + (r.hedef ? " · " + r.hedef : ""),
          fmt(r.olusturma) + (r.detay ? " · " + r.detay : ""),
          ""
        );
      }).join("");
    }).catch(function () {
      host.innerHTML = '<div class="empty"><strong>Kayıtlar yüklenemedi</strong></div>';
    });
  }

  function loadLogs() {
    var host = el("loginLog");
    if (host) {
      A.listAll("admin_giris_kayit", 500).then(function (rows) {
        var list = rows.sort(function (a, b) {
          return Number(b.olusturma || 0) - Number(a.olusturma || 0);
        }).slice(0, 100);

        if (!list.length) {
          host.innerHTML = '<div class="empty"><strong>Kayıt yok</strong>Giriş denemeleri burada listelenir.</div>';
          return;
        }

        host.innerHTML = list.map(function (r) {
          return '<div class="move">' +
            '<span class="move__dot move__dot--' + (r.basari ? "plus" : "minus") + '"></span>' +
            '<div class="move__body"><div class="move__txt">' +
            esc(r.kullanici_adi || "—") + " — " + (r.basari ? "Başarılı giriş" : "Başarısız deneme") +
            '</div><div class="move__when">' + esc(fmt(r.olusturma)) +
            (r.not ? " · " + esc(r.not) : "") + "</div></div></div>";
        }).join("");
      }).catch(function () {
        host.innerHTML = '<div class="empty"><strong>Yüklenemedi</strong></div>';
      });
    }

    loadActionLog("actionLog", 100);
  }

  /* =========================================================
     7. Kullanıcı yönetimi
     ========================================================= */

  var allUsers = [];

  function loadUsers() {
    var host = el("userTable");
    if (!host) return;
    host.innerHTML = '<div class="empty"><strong>Yükleniyor…</strong></div>';

    A.listAll("uyeler", 1000).then(function (rows) {
      allUsers = rows;
      var badge = el("userCount");
      if (badge) {
        badge.textContent = rows.length ? String(rows.length) : "";
        badge.setAttribute("data-count", rows.length ? "1" : "0");
      }
      paintUsers(rows);
      fillAnnounceTargets(rows);
    }).catch(function () {
      host.innerHTML = '<div class="empty"><strong>Üyeler yüklenemedi</strong>Bağlantını kontrol et.</div>';
    });
  }

  function isSupreme(u) {
    if (!u || !u.supreme_bitis) return false;
    var d = new Date(String(u.supreme_bitis) + "T23:59:59");
    return !isNaN(d.getTime()) && d.getTime() > Date.now();
  }

  function paintUsers(rows) {
    var host = el("userTable");
    if (!host) return;

    if (!rows.length) {
      host.innerHTML = '<div class="empty"><strong>Üye yok</strong>Henüz kayıt yapılmamış.</div>';
      return;
    }

    host.innerHTML = rows.map(function (u) {
      var sup = isSupreme(u);
      var roleLabel = u.rol === "admin" ? "Yönetici" : sup ? "Supreme" : "Üye";
      var stateLabel = u.durum === "engelli" ? "Askıda" : u.durum === "yasakli" ? "Yasaklı" : "Aktif";

      return (
        '<div class="admin-row" data-user="' + esc(u.id) + '">' +
        '<span class="conv__av">' + esc(String(u.kullanici_adi || "?").slice(0, 2).toUpperCase()) + "</span>" +
        '<span class="admin-row__main">' +
        '<strong class="admin-row__name">' + esc(u.kullanici_adi) + "</strong>" +
        '<span class="admin-row__sub">' + esc(roleLabel) +
        (sup ? " · bitiş " + esc(u.supreme_bitis) : "") +
        " · " + money(u.kredi) + " kredi</span>" +
        "</span>" +
        '<span class="tag tag--' + (u.durum === "engelli" || u.durum === "yasakli" ? "kapatildi" : "yanitlandi") + '">' +
        esc(stateLabel) + "</span>" +
        '<span class="admin-row__acts">' +
        '<button class="mini-btn" type="button" data-usupreme="' + esc(u.id) + '">Supreme</button>' +
        '<button class="mini-btn" type="button" data-upremium="' + esc(u.id) + '">Kredi</button>' +
        '<button class="mini-btn" type="button" data-ususpend="' + esc(u.id) + '">' +
        (u.durum === "engelli" ? "Askıdan Al" : "Askıya Al") + "</button>" +
        '<button class="mini-btn mini-btn--no" type="button" data-uban="' + esc(u.id) + '">' +
        (u.durum === "yasakli" ? "Yasağı Kaldır" : "Yasakla") + "</button>" +
        '<button class="mini-btn mini-btn--no" type="button" data-udel="' + esc(u.id) + '">Sil</button>' +
        "</span></div>"
      );
    }).join("");

    /* Supreme ver */
    Array.prototype.forEach.call(host.querySelectorAll("[data-usupreme]"), function (b) {
      b.addEventListener("click", function () {
        if (!guard()) return;
        var id = b.getAttribute("data-usupreme");
        var day = window.prompt("Kaç gün Supreme verilsin? (1, 3, 7, 14, 30)", "7");
        if (day == null) return;
        var n = parseInt(day, 10);
        if (!n || n < 1 || n > 365) { window.alert("1–365 arası bir gün sayısı gir."); return; }

        var end = new Date();
        end.setDate(end.getDate() + n);
        var key = end.getFullYear() + "-" + ("0" + (end.getMonth() + 1)).slice(-2) + "-" + ("0" + end.getDate()).slice(-2);

        A.patchRow("uyeler", id, { supreme_bitis: key }).then(function () {
          logAction("Supreme verildi", id, n + " gün · bitiş " + key);
          loadUsers();
        }).catch(function () {});
      });
    });

    /* Kredi ekle */
    Array.prototype.forEach.call(host.querySelectorAll("[data-upremium]"), function (b) {
      b.addEventListener("click", function () {
        if (!guard()) return;
        var id = b.getAttribute("data-upremium");
        var raw = window.prompt("Eklenecek kredi (eksi değer düşer):", "50");
        if (raw == null) return;
        var n = parseInt(raw, 10);
        if (isNaN(n)) return;

        var target = allUsers.filter(function (u) { return u.id === id; })[0];
        if (!target) return;
        var next = Math.max(0, Number(target.kredi || 0) + n);

        A.patchRow("uyeler", id, { kredi: next }).then(function () {
          logAction("Kredi güncellendi", id, n + " → " + next);
          loadUsers();
        }).catch(function () {});
      });
    });

    /* Askıya al / al */
    Array.prototype.forEach.call(host.querySelectorAll("[data-ususpend]"), function (b) {
      b.addEventListener("click", function () {
        if (!guard()) return;
        var id = b.getAttribute("data-ususpend");
        var target = allUsers.filter(function (u) { return u.id === id; })[0];
        if (!target) return;
        var next = target.durum === "engelli" ? "aktif" : "engelli";

        A.patchRow("uyeler", id, { durum: next, oturum_token: next === "engelli" ? "" : target.oturum_token }).then(function () {
          logAction(next === "engelli" ? "Askıya alındı" : "Askı kaldırıldı", id, "");
          loadUsers();
        }).catch(function () {});
      });
    });

    /* Yasakla / kaldır */
    Array.prototype.forEach.call(host.querySelectorAll("[data-uban]"), function (b) {
      b.addEventListener("click", function () {
        if (!guard()) return;
        var id = b.getAttribute("data-uban");
        var target = allUsers.filter(function (u) { return u.id === id; })[0];
        if (!target) return;
        var banned = target.durum === "yasakli";
        var next = banned ? "aktif" : "yasakli";

        askConfirm(
          banned ? "Yasağı kaldır" : "Kullanıcıyı yasakla",
          (banned ? "Yasak kaldırılacak: " : "Kalıcı yasak uygulanacak: ") + (target.kullanici_adi || ""),
          function () {
            A.patchRow("uyeler", id, { durum: next, oturum_token: "" }).then(function () {
              logAction(banned ? "Yasak kaldırıldı" : "Yasaklandı", id, target.kullanici_adi || "");
              loadUsers();
            }).catch(function () {});
          }
        );
      });
    });

    /* Sil */
    Array.prototype.forEach.call(host.querySelectorAll("[data-udel]"), function (b) {
      b.addEventListener("click", function () {
        if (!guard()) return;
        var id = b.getAttribute("data-udel");
        var target = allUsers.filter(function (u) { return u.id === id; })[0];

        askConfirm(
          "Kullanıcı silinsin mi?",
          "Bu işlem geri alınamaz: " + ((target && target.kullanici_adi) || id),
          function () {
            A.deleteRow("uyeler", id).then(function () {
              logAction("Kullanıcı silindi", id, (target && target.kullanici_adi) || "");
              loadUsers();
            }).catch(function () {});
          }
        );
      });
    });
  }

  var userSearch = el("userSearch");
  if (userSearch) {
    userSearch.addEventListener("input", function () {
      var q = userSearch.value.trim().toLowerCase();
      if (!q) { paintUsers(allUsers); return; }
      paintUsers(allUsers.filter(function (u) {
        return String(u.kullanici_adi || "").toLowerCase().indexOf(q) > -1;
      }));
    });
  }

  /* =========================================================
     8. Forum yönetimi
     ========================================================= */

  function loadForum() {
    var host = el("adminForum");
    if (!host) return;
    host.innerHTML = '<div class="pcard"><div class="empty"><strong>Yükleniyor…</strong></div></div>';

    A.listAll("forum_konular", 600).then(function (rows) {
      var list = rows.sort(function (a, b) {
        return Number(b.olusturma || 0) - Number(a.olusturma || 0);
      });

      if (!list.length) {
        host.innerHTML = '<div class="pcard"><div class="empty"><strong>Konu yok</strong>Forumda henüz konu açılmamış.</div></div>';
        return;
      }

      host.innerHTML = list.map(function (t) {
        return (
          '<div class="ticket" style="margin-bottom:10px" data-fpost="' + esc(t.id) + '">' +
          '<div class="ticket__head">' +
          '<span class="ticket__title">' + esc(t.baslik) + "</span>" +
          (t.sabit ? '<span class="tag tag--yanitlandi">Sabit</span>' : "") +
          (t.kilitli ? '<span class="tag tag--kapatildi">Kilitli</span>' : "") +
          (t.gizli ? '<span class="tag tag--bekliyor">Gizli</span>' : "") +
          "</div>" +
          '<div class="ticket__body">' + esc(t.yazar || "üye") + " · " +
          esc(t.kategori) + " · " + Number(t.yorum_sayisi || 0) + " yorum · " +
          Number(t.begeni || 0) + " beğeni</div>" +
          '<div style="padding:0 15px 14px" class="btn-row">' +
          '<button class="mini-btn" type="button" data-fpin="' + esc(t.id) + '">' +
          (t.sabit ? "Sabitlemeyi Kaldır" : "Sabitle") + "</button>" +
          '<button class="mini-btn" type="button" data-flock="' + esc(t.id) + '">' +
          (t.kilitli ? "Kilidi Aç" : "Kilitle") + "</button>" +
          '<button class="mini-btn mini-btn--no" type="button" data-fhide="' + esc(t.id) + '">' +
          (t.gizli ? "Yayına Al" : "Gizle") + "</button>" +
          '<button class="mini-btn mini-btn--no" type="button" data-fdel="' + esc(t.id) + '">Sil</button>' +
          "</div></div>"
        );
      }).join("");

      function findT(id) {
        return list.filter(function (x) { return x.id === id; })[0];
      }

      function patch(id, body, label) {
        if (!guard()) return;
        A.patchRow("forum_konular", id, body).then(function () {
          var t = findT(id);
          logAction(label, id, (t && t.baslik) || "");
          loadForum();
        }).catch(function () {});
      }

      Array.prototype.forEach.call(host.querySelectorAll("[data-fpin]"), function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-fpin");
          var t = findT(id);
          patch(id, { sabit: !(t && t.sabit) }, (t && t.sabit) ? "Sabit kaldırıldı" : "Konu sabitlendi");
        });
      });

      Array.prototype.forEach.call(host.querySelectorAll("[data-flock]"), function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-flock");
          var t = findT(id);
          patch(id, { kilitli: !(t && t.kilitli) }, (t && t.kilitli) ? "Kilit açıldı" : "Konu kilitlendi");
        });
      });

      Array.prototype.forEach.call(host.querySelectorAll("[data-fhide]"), function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-fhide");
          var t = findT(id);
          patch(id, { gizli: !(t && t.gizli) }, (t && t.gizli) ? "Konu yayınlandı" : "Konu gizlendi");
        });
      });

      Array.prototype.forEach.call(host.querySelectorAll("[data-fdel]"), function (b) {
        b.addEventListener("click", function () {
          if (!guard()) return;
          var id = b.getAttribute("data-fdel");
          var t = findT(id);
          askConfirm("Konu silinsin mi?", "Konu ve yanıtları kaldırılacak: " + ((t && t.baslik) || id), function () {
            A.listAll("forum_yorumlar", 600).then(function (all) {
              return Promise.all(all.filter(function (r) { return r.konu_id === id; }).map(function (r) {
                return A.deleteRow("forum_yorumlar", r.id).catch(function () {});
              }));
            }).then(function () {
              return A.deleteRow("forum_konular", id);
            }).then(function () {
              logAction("Konu silindi", id, (t && t.baslik) || "");
              loadForum();
            }).catch(function () {});
          });
        });
      });
    }).catch(function () {
      host.innerHTML = '<div class="pcard"><div class="empty"><strong>Forum yüklenemedi</strong></div></div>';
    });
  }

  /* =========================================================
     9. Destek yönetimi
     ========================================================= */

  var CAT = { yanitlandi: "Yanıtlandı", bekliyor: "Bekleniyor", kapatildi: "Kapatıldı" };

  function loadTickets() {
    var host = el("adminTickets");
    if (!host) return;

    A.listAll("destek_talepleri", 500).then(function (rows) {
      var list = rows.sort(function (a, b) {
        return Number(b.olusturma || 0) - Number(a.olusturma || 0);
      });

      var pending = list.filter(function (t) { return t.durum === "bekliyor"; }).length;
      var badge = el("ticketCount");
      if (badge) {
        badge.textContent = pending ? String(pending) : "";
        badge.setAttribute("data-count", pending ? "1" : "0");
      }

      if (!list.length) {
        host.innerHTML = '<div class="empty"><strong>Talep yok</strong>Henüz destek talebi oluşturulmamış.</div>';
        return;
      }

      host.innerHTML = list.map(function (t) {
        var durum = t.durum || "bekliyor";
        return (
          '<div class="ticket" style="margin-bottom:10px" data-ticket="' + esc(t.id) + '">' +
          '<div class="ticket__head">' +
          '<span class="ticket__title">' + esc(t.konu || t.baslik) + "</span>" +
          '<span class="tag tag--' + esc(durum) + '">' + esc(CAT[durum] || durum) + "</span>" +
          "</div>" +
          '<div class="ticket__body">' +
          (t.kategori ? "<strong>" + esc(t.kategori) + "</strong> · " : "") +
          esc(t.baslik || "") + (t.aciklama ? "<br />" + esc(t.aciklama) : "") +
          "</div>" +
          (t.cevap ? '<div class="ticket__reply"><strong>Yanıt</strong>' + esc(t.cevap) + "</div>" : "") +
          '<div style="padding:0 15px 14px">' +
          '<textarea class="input" rows="3" placeholder="Yanıt yaz…" data-reply="' + esc(t.id) + '">' +
          esc(t.cevap || "") + "</textarea>" +
          '<div class="btn-row" style="margin-top:8px">' +
          '<button class="mini-btn mini-btn--ok" data-answer="' + esc(t.id) + '">Yanıtla</button>' +
          '<button class="mini-btn" data-close="' + esc(t.id) + '">Kapat</button>' +
          "</div></div></div>"
        );
      }).join("");

      Array.prototype.forEach.call(host.querySelectorAll("[data-answer]"), function (b) {
        b.addEventListener("click", function () {
          if (!guard()) return;
          var id = b.getAttribute("data-answer");
          var ta = host.querySelector('[data-reply="' + id + '"]');
          var text = ta ? ta.value.trim() : "";
          if (!text) return;

          A.patchRow("destek_talepleri", id, { cevap: text, durum: "yanitlandi" }).then(function () {
            logAction("Destek yanıtlandı", id, text.slice(0, 80));
            loadTickets();
          }).catch(function () {});
        });
      });

      Array.prototype.forEach.call(host.querySelectorAll("[data-close]"), function (b) {
        b.addEventListener("click", function () {
          if (!guard()) return;
          var id = b.getAttribute("data-close");
          A.patchRow("destek_talepleri", id, { durum: "kapatildi" }).then(function () {
            logAction("Destek kapatıldı", id, "");
            loadTickets();
          }).catch(function () {});
        });
      });
    }).catch(function () {
      host.innerHTML = '<div class="empty"><strong>Talepler yüklenemedi</strong></div>';
    });
  }

  /* =========================================================
     10. Bildirim yönetimi
     ========================================================= */

  function fillAnnounceTargets(rows) {
    var sel = el("anTarget");
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="all">Tüm üyeler</option>' +
      (rows || []).map(function (u) {
        return '<option value="' + esc(u.id) + '">' + esc(u.kullanici_adi) + "</option>";
      }).join("");
    if (current && (current === "all" || (rows || []).some(function (u) { return u.id === current; }))) {
      sel.value = current;
    }
  }

  function loadAnnounceTargets() {
    if (allUsers.length) { fillAnnounceTargets(allUsers); return; }
    A.listAll("uyeler", 1000).then(function (rows) {
      allUsers = rows;
      fillAnnounceTargets(rows);
    }).catch(function () {});
  }

  var announceForm = el("announceForm");
  if (announceForm) {
    announceForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!guard()) return;

      var out = el("anStatus");
      var send = el("anSend");
      var target = el("anTarget").value;
      var text = el("anText").value.trim();

      if (text.length < 3) {
        status(out, "Duyuru metni en az 3 karakter olmalı.", "is-error");
        return;
      }

      var targets = target === "all"
        ? allUsers.map(function (u) { return u.id; })
        : [target];

      if (!targets.length) {
        status(out, "Hedef üye bulunamadı.", "is-error");
        return;
      }

      if (send) { send.disabled = true; send.textContent = "Gönderiliyor…"; }
      status(out, "Gönderiliyor…", null);

      var now = Date.now();
      Promise.all(targets.map(function (uid, i) {
        return A.createRow("bildirimler", {
          uye_id: uid,
          anahtar: "duyuru:" + now + ":" + i,
          tip: "sistem",
          metin: text.slice(0, 400),
          okundu: false,
          gizli: false,
          olusturma: now
        }).catch(function () { return null; });
      })).then(function () {
        logAction("Duyuru gönderildi", target, text.slice(0, 80));
        status(out, targets.length + " üyeye duyuru gönderildi.", "is-ok");
        el("anText").value = "";
      }).catch(function () {
        status(out, "Duyuru gönderilemedi.", "is-error");
      }).then(function () {
        if (send) { send.disabled = false; send.textContent = "Gönder"; }
      });
    });
  }

  /* =========================================================
     11. Mağaza / Supreme
     ========================================================= */

  function loadShop() {
    var host = el("adminShop");
    if (!host) return;

    A.listAll("magaza", 100).then(function (rows) {
      if (!rows.length) {
        host.innerHTML = '<div class="empty"><strong>Ürün yok</strong>Mağaza ürünleri henüz eklenmedi.</div>';
        return;
      }
      host.innerHTML = '<div class="kv">' + rows.map(function (p) {
        return '<div class="kv__row">' +
          '<span class="kv__k" style="color:var(--text)">' + esc(p.ad) + "</span>" +
          '<span class="kv__v" style="font-size:12px">' +
          money(p.kredi_fiyat) + " kredi · stok " + money(p.stok) +
          (p.gun ? " · " + money(p.gun) + " gün" : "") +
          "</span></div>";
      }).join("") + "</div>";
    }).catch(function () {
      host.innerHTML = '<div class="empty"><strong>Mağaza yüklenemedi</strong></div>';
    });
  }

  /* =========================================================
     12. Başlat
     ========================================================= */

  if (readAdminSession()) {
    enterPanel();
  } else {
    showGate();
    var focusTarget = el("aKimlik");
    if (focusTarget) window.setTimeout(function () { focusTarget.focus(); }, 120);
  }
})();
