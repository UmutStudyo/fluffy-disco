/* =========================================================
   Avalanche — panel.js
   Üye kontrol paneli.

   Dürüst sınırlar (README'de ayrıntılı):
   • Oturum/a yetki kontrolü istemci tarafındadır; bu proje statik
     bir sitedir ve platformda çalıştırılabilir sunucu yoktur.
   • Kişisel alanlar AES-GCM ile şifreli saklanır; anahtar yalnızca
     girişte türetilir ve sekmeye özgü sessionStorage'da durur.
   • Forum ve ödeme sistemi YOK; ilgili yerler bunu açıkça belirtir.
   ========================================================= */
(function () {
  "use strict";

  var A = window.AvlAuth;
  if (!A) return;

  var I = window.AvlI18n;

  function T(key, fallback) {
    if (I && typeof I.t === "function") return I.t(key, fallback);
    return fallback != null ? fallback : key;
  }

  /* ---------- 0. Oturum kapısı ---------- */

  var session = A.getSession();
  if (!session) {
    window.location.replace("giris.html");
    return;
  }

  var me = null;          /* uyeler satırı */
  var profile = {};       /* çözülmüş kişisel alanlar */
  var aesKey = A.getKey(session.id);

  if (!aesKey) {
    /* Sekme kapanmış / anahtar yok → yeniden giriş gerekir */
    A.clearSession();
    window.location.replace("giris.html?yeniden=1");
    return;
  }

  /* ---------- Yardımcılar ---------- */

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
    return Number(n || 0).toLocaleString("tr-TR");
  }

  function fmtDate(ms) {
    if (!ms) return "—";
    try {
      return new Date(Number(ms)).toLocaleDateString("tr-TR", {
        day: "2-digit", month: "long", year: "numeric"
      });
    } catch (e) { return "—"; }
  }

  function fmtWhen(ms) {
    if (!ms) return "";
    var d = new Date(Number(ms));
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "az önce";
    if (diff < 3600) return Math.floor(diff / 60) + " dk önce";
    if (diff < 86400) return Math.floor(diff / 3600) + " sa önce";
    if (diff < 604800) return Math.floor(diff / 86400) + " gün önce";
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function initials(name) {
    var parts = String(name || "?").trim().split(/\s+/);
    var a = (parts[0] || "?")[0] || "?";
    var b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase();
  }

  function status(node, message, kind) {
    if (!node) return;
    node.textContent = message || "";
    node.classList.remove("is-error", "is-ok");
    if (kind) node.classList.add(kind);
  }

  function isSupreme(row) {
    if (!row || !row.supreme_bitis) return false;
    var end = new Date(row.supreme_bitis + "T23:59:59");
    return !isNaN(end.getTime()) && end.getTime() > Date.now();
  }

  /* ---------- 1. Üyeyi yükle ve profilini çöz ---------- */

  function loadMe() {
    if (usingSupabase) {
      var u = supabaseSession.user || {};
      var md = u.user_metadata || {};
      me = { id: u.id, kullanici_adi: md.username || (u.email || "").split("@")[0], konu_sayisi: 0, yorum_sayisi: 0, mesaj_sayisi: 0, durum: "aktif", rol: md.role || "user" };
      profile = { ad: md.ad || md.fullname || "", soyad: md.soyad || "", cinsiyet: md.cinsiyet || "", dogum_tarihi: md.dogum_tarihi || "", email: u.email || "" };
      renderIdentity();
      return Promise.resolve(me);
    }
    return A.getRow("uyeler", session.id).then(function (row) {
      if (!row) throw new Error("Hesap bulunamadı");
      me = row;
      return A.decryptFields(row, ["ad", "soyad", "cinsiyet", "dogum_tarihi", "email"], aesKey);
    }).then(function (p) {
      profile = p;
      renderIdentity();
      return me;
    });
  }

  function renderIdentity() {
    var full = ((profile.ad || "") + " " + (profile.soyad || "")).trim() || me.kullanici_adi;
    var supreme = isSupreme(me);

    el("sideName").innerHTML = supreme
      ? '<span class="supreme-name">' + esc(me.kullanici_adi) + "</span>"
      : esc(me.kullanici_adi);
    el("sideHandle").textContent = "@" + me.kullanici_adi;

    el("welcomeName").textContent = full;
    el("welcomeMeta").textContent =
      "@" + me.kullanici_adi + (supreme ? " · Supreme üye" : " · Standart üye");

    el("statKonu").textContent = money(me.konu_sayisi);
    el("statYorum").textContent = money(me.yorum_sayisi);
    el("statMesaj").textContent = money(me.mesaj_sayisi);

    /* Avatarlar */
    paintAvatar("sideAvatar", full, me);
    paintAvatar("bigAvatar", full, me);
    paintAvatar("editAvatar", full, me);

    /* Üyelik bilgileri */
    var kv = el("membershipKv");
    if (kv) {
      kv.innerHTML =
        row("Ad Soyad", full) +
        row("Kullanıcı Adı", "@" + me.kullanici_adi) +
        row("E-posta", profile.email || "—") +
        row("Cinsiyet", profile.cinsiyet || "—") +
        row("Doğum Tarihi", profile.dogum_tarihi ? fmtBirth(profile.dogum_tarihi) : "—") +
        row("Üyelik Tarihi", fmtDate(me.olusturma)) +
        row("Üyelik Türü", supreme ? "Supreme" : "Standart") +
        row("Durum", me.durum === "engelli" ? "Askıda" : "Aktif");
    }

    el("mobileBarTitle").textContent = "Hesabım";

    /* Kredi göstergesi yalnızca mobil çubukta kalır (Mağaza/Krediler
       bölümleri istem üzerine kaldırıldı). */
    var credit = Number(me.kredi || 0);
    var bar = el("mobileBarCredit");
    if (bar) bar.innerHTML = "<small>kredi</small>" + money(credit);
  }

  function fmtBirth(v) {
    var d = new Date(String(v) + "T00:00:00");
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  }

  function row(k, v) {
    return '<div class="kv__row"><span class="kv__k">' + esc(k) +
      '</span><span class="kv__v">' + esc(v) + "</span></div>";
  }

  function paintAvatar(nodeId, full, userRow) {
    var node = el(nodeId);
    if (!node) return;
    if (userRow.avatar_ref) {
      node.innerHTML = '<img alt="" src="' + esc(userRow.avatar_ref) + '" />';
    } else {
      node.textContent = initials(full);
    }
  }

  /* ---------- 2. Panel gezinme ---------- */

  var dash = el("dash");

  function showPanel(name) {
    Array.prototype.forEach.call(document.querySelectorAll(".dash-panel"), function (p) {
      p.classList.toggle("is-active", p.id === "p-" + name);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".dash__link[data-panel]"), function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-panel") === name);
    });

    var titles = {
      hesabim: "Hesabım", bildirimler: "Bildirimler", mesajlar: "Mesajlar",
      supreme: "Supreme", destek: "Destek"
    };
    var bar = el("mobileBarTitle");
    if (bar) bar.textContent = titles[name] || "Panel";

    closeDrawer();
    if (window.innerWidth < 980) window.scrollTo({ top: 0, behavior: "smooth" });

    if (name === "bildirimler") renderNotifs();
    if (name === "mesajlar") renderConvs();
    if (name === "destek") renderTickets();
  }

  Array.prototype.forEach.call(document.querySelectorAll(".dash__link[data-panel]"), function (btn) {
    btn.addEventListener("click", function () {
      showPanel(btn.getAttribute("data-panel"));
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-goto]"), function (btn) {
    btn.addEventListener("click", function () {
      showPanel(btn.getAttribute("data-goto"));
    });
  });

  /* Mobil çekmece */
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

  /* ---------- 3. Çıkış ---------- */

  var confirmBox = el("logoutConfirm");
  var logoutBtn = el("logoutBtn");

  function openConfirm() {
    if (!confirmBox) return;
    confirmBox.classList.add("is-open");
    confirmBox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeConfirm() {
    if (!confirmBox) return;
    confirmBox.classList.remove("is-open");
    confirmBox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (logoutBtn) logoutBtn.focus();
  }

  if (logoutBtn) logoutBtn.addEventListener("click", openConfirm);
  Array.prototype.forEach.call(document.querySelectorAll("[data-confirm-close]"), function (b) {
    b.addEventListener("click", closeConfirm);
  });

  var logoutYes = el("logoutYes");
  if (logoutYes) {
    logoutYes.addEventListener("click", function () {
      var rowId = me && me.id ? me.id : session.id;
      A.patchRow("uyeler", rowId, { oturum_token: "" }).catch(function () {
        /* çevrimdışı olsa da yerel oturumu kapat */
      }).then(function () {
        A.clearSession();
        A.clearKey();
        window.location.href = "index.html";
      });
    });
  }

  /* ---------- 4. Sunucu / TS3 kopyalama ---------- */

  Array.prototype.forEach.call(document.querySelectorAll("[data-copy-game]"), function (btn) {
    btn.addEventListener("click", function () {
      copy(btn.getAttribute("data-copy-game"), btn);
    });
  });

  function copy(text, btn) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = "Kopyalandı ✓";
      window.setTimeout(function () { btn.textContent = old; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallback(); });
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { /* yoksay */ }
      document.body.removeChild(ta);
    }
  }

  /* ---------- 5. Hareketler ---------- */

  function moveRow(m) {
    var amt = Number(m.miktar || 0);
    var cls = amt > 0 ? "plus" : amt < 0 ? "minus" : "info";
    var sign = amt > 0 ? "+" : "";
    return (
      '<div class="move">' +
      '<span class="move__dot move__dot--' + cls + '"></span>' +
      '<div class="move__body">' +
      '<div class="move__txt">' + esc(m.aciklama || m.tur || "İşlem") + "</div>" +
      '<div class="move__when">' + esc(fmtWhen(m.olusturma)) + "</div>" +
      "</div>" +
      (amt !== 0
        ? '<span class="move__amt move__amt--' + cls + '">' + sign + money(amt) + "</span>"
        : "") +
      "</div>"
    );
  }

  function loadMoves(limit, targetId) {
    return A.listAll("kredi_hareketleri", 400).then(function (rows) {
      var mine = rows
        .filter(function (r) { return r.uye_id === session.id; })
        .sort(function (a, b) { return Number(b.olusturma || 0) - Number(a.olusturma || 0); });

      var target = el(targetId);
      if (!target) return mine;

      if (!mine.length) {
        target.innerHTML = limit
          ? '<div class="empty"><strong>Hareket yok</strong>Kredi kazandığında burada görünür.</div>'
          : '<div class="empty"><strong>Geçmiş boş</strong>İlk kredini aldığında burada görünecek.</div>';
        return mine;
      }

      var list = limit ? mine.slice(0, limit) : mine;
      target.innerHTML = list.map(moveRow).join("");
      return mine;
    });
  }

  function addMove(amount, type, desc) {
    return A.createRow("kredi_hareketleri", {
      uye_id: session.id,
      miktar: amount,
      tur: type,
      aciklama: desc,
      olusturma: Date.now()
    });
  }

  /* ---------- 6. Bildirimler ---------- */

  var pendingReq = [];
  var unreadMsgs = [];
  var myTickets = [];

  function renderNotifs() {
    var host = el("notifList");
    if (!host) return;

    var items = [];

    pendingReq.forEach(function (r) {
      items.push({
        kind: "friend",
        who: r.gonderen_id,
        html:
          '<div class="notif__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.4" r="3.4"/><path d="M2.8 19.6c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6"/><path d="M18 8v6M15 11h6"/></svg></div>' +
          '<div class="notif__body"><div class="notif__txt"><strong>' +
          esc(nameOf(r.gonderen_id)) + "</strong> sana arkadaşlık isteği gönderdi.</div>" +
          '<div class="notif__when">' + esc(fmtWhen(r.olusturma)) + "</div>" +
          '<div class="notif__acts">' +
          '<button class="mini-btn mini-btn--ok" data-faccept="' + esc(r.id) + '">Kabul Et</button>' +
          '<button class="mini-btn mini-btn--no" data-freject="' + esc(r.id) + '">Reddet</button>' +
          "</div></div>",
        when: Number(r.olusturma || 0)
      });
    });

    unreadMsgs.forEach(function (m) {
      items.push({
        kind: "msg",
        html:
          '<div class="notif__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2 .5-4.6A7.5 7.5 0 0 1 12.5 5 7.5 7.5 0 0 1 20 12.5z"/></svg></div>' +
          '<div class="notif__body"><div class="notif__txt"><strong>' +
          esc(nameOf(m.gonderen_id)) + "</strong> sana mesaj gönderdi: " +
          esc(String(m.icerik || "").slice(0, 90)) + "</div>" +
          '<div class="notif__when">' + esc(fmtWhen(m.olusturma)) + "</div>" +
          '<div class="notif__acts"><button class="mini-btn" data-openmsg="' +
          esc(m.gonderen_id) + '">Sohbeti Aç</button></div></div>',
        when: Number(m.olusturma || 0)
      });
    });

    myTickets.forEach(function (t) {
      if (t.durum === "yanitlandi" || (t.cevap && t.durum !== "kapatildi")) {
        items.push({
          kind: "ticket",
          html:
            '<div class="notif__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.6l6-.9z"/></svg></div>' +
            '<div class="notif__body"><div class="notif__txt">Destek talebin yanıtlandı: <strong>' +
            esc(t.konu || t.baslik) + "</strong></div>" +
            '<div class="notif__when">' + esc(fmtWhen(t.olusturma)) + "</div>" +
            '<div class="notif__acts"><button class="mini-btn" data-goto="destek">Talebi Gör</button></div></div>',
          when: Number(t.olusturma || 0)
        });
      }
    });

    items.push({
      kind: "system",
      html:
        '<div class="notif__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.4M12 8v.2"/></svg></div>' +
        '<div class="notif__body"><div class="notif__txt">Avalanche hesabın oluşturuldu. Hoş geldin!</div>' +
        '<div class="notif__when">' + esc(fmtWhen(me && me.olusturma)) + "</div></div>",
      when: Number((me && me.olusturma) || 0)
    });

    items.sort(function (a, b) { return b.when - a.when; });

    /* Okundu / sil durumu `bildirimler` tablosundan gelir */
    var visible = items.filter(function (i) {
      var st = notifStore[i.kind + ":" + i.when];
      return !(st && st.gizli);
    });

    host.innerHTML = visible.map(function (i) {
      var key = i.kind + ":" + i.when;
      var st = notifStore[key] || {};
      return (
        '<div class="notif' + (st.okundu ? " is-read" : " is-new") + '" data-akey="' + esc(key) + '">' +
        i.html +
        '<div class="notif__acts notif__acts--own">' +
        '<button class="mini-btn" type="button" data-markread="' + esc(key) + '">' +
        esc(T("notif.markRead", "Okundu")) + "</button>" +
        '<button class="mini-btn mini-btn--no" type="button" data-delnotif="' + esc(key) + '">' +
        esc(T("notif.delete", "Sil")) + "</button>" +
        "</div></div>"
      );
    }).join("");

    /* Okundu işaretle */
    Array.prototype.forEach.call(host.querySelectorAll("[data-markread]"), function (b) {
      b.addEventListener("click", function () {
        var key = b.getAttribute("data-markread");
        var tip = key.split(":")[0];
        ensureNotifRow(key, {
          okundu: true,
          tip: tip === "friend" ? "arkadaslik" : tip === "msg" ? "mesaj" : tip === "ticket" ? "destek" : "sistem"
        }).then(function () {
          renderNotifs();
        }).catch(function () {});
      });
    });

    /* Bildirimi sil */
    Array.prototype.forEach.call(host.querySelectorAll("[data-delnotif]"), function (b) {
      b.addEventListener("click", function () {
        var key = b.getAttribute("data-delnotif");
        ensureNotifRow(key, { okundu: true, gizli: true }).then(function () {
          renderNotifs();
        }).catch(function () {});
      });
    });

    /* Eylemler */
    Array.prototype.forEach.call(host.querySelectorAll("[data-faccept]"), function (b) {
      b.addEventListener("click", function () {
        respondRequest(b.getAttribute("data-faccept"), "kabul");
      });
    });
    Array.prototype.forEach.call(host.querySelectorAll("[data-freject]"), function (b) {
      b.addEventListener("click", function () {
        respondRequest(b.getAttribute("data-freject"), "red");
      });
    });
    Array.prototype.forEach.call(host.querySelectorAll("[data-openmsg]"), function (b) {
      b.addEventListener("click", function () {
        showPanel("mesajlar");
        openThread(b.getAttribute("data-openmsg"));
      });
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-goto="destek"]'), function (b) {
      b.addEventListener("click", function () { showPanel("destek"); });
    });

    var badge = el("notifBadge");
    if (badge) {
      var n = pendingReq.length + unreadMsgs.length;
      borderlessApply(badge, n);
    }

    function borderlessApply(node, count) {
      node.textContent = count > 0 ? String(count) : "";
      node.setAttribute("data-count", count > 0 ? "1" : "0");
    }
  }

  /* Tümünü okundu işaretle */
  var markAllBtn = el("notifMarkAll");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", function () {
      var host = el("notifList");
      if (!host) return;
      var keys = [];
      Array.prototype.forEach.call(host.querySelectorAll("[data-akey]"), function (n) {
        keys.push(n.getAttribute("data-akey"));
      });
      if (!keys.length) return;

      markAllBtn.disabled = true;
      Promise.all(keys.map(function (key) {
        var tip = key.split(":")[0];
        return ensureNotifRow(key, {
          okundu: true,
          tip: tip === "friend" ? "arkadaslik" : tip === "msg" ? "mesaj" : tip === "ticket" ? "destek" : "sistem"
        }).catch(function () {});
      })).then(function () {
        markAllBtn.disabled = false;
        renderNotifs();
      });
    });
  }

  /* ---------- 7. Üye dizini ---------- */

  var userCache = {};

  function nameOf(id) {
    if (userCache[id]) return userCache[id].kullanici_adi || "üye";
    return "üye";
  }

  var allUsers = [];

  /* Yalnızca sohbet/istek ilişkisi olan üyeleri çöz.
     Tüm üye tablosu ASLA indirilmez. */
  function loadUserCache() {
    var ids = [];
    friends.forEach(function (f) { ids.push(f.id); });
    requests.forEach(function (r) { ids.push(r.gonderen_id); });
    sent.forEach(function (s) { ids.push(s.alan_id); });
    allMessages.forEach(function (m) {
      ids.push(m.gonderen_id);
      ids.push(m.alan_id);
    });

    return A.resolveUsers(ids, userCache).then(function (store) {
      /* Arkadaş kayıtlarını çözülmüş kullanıcıyla tazele */
      friends = friends.map(function (f) {
        return { id: f.id, user: store[f.id] || f.user, since: f.since };
      });
      allUsers = Object.keys(store).map(function (k) { return store[k]; });
      return store;
    });
  }

  /* ---------- 8. Mesajlar ---------- */

  var friends = [];     /* kabul edilmiş: {user, since} */
  var requests = [];    /* gelen istekler */
  var sent = [];        /* gönderdiğim istekler */
  var blocked = [];     /* engellediğim id'ler */
  var activeThread = null;
  var allMessages = [];

  function loadSocial() {
    return Promise.all([
      A.listAll("arkadasliklar", 800),
      A.listAll("mesajlar", 800),
      A.listAll("engeller", 400)
    ]).then(function (res) {
      var links = res[0], msgs = res[1], blk = res[2];
      allMessages = msgs;

      friends = [];
      requests = [];
      sent = [];

      links.forEach(function (l) {
        var mineSent = l.gonderen_id === session.id;
        var mineRecv = l.alan_id === session.id;
        if (!mineSent && !mineRecv) return;

        if (l.durum === "kabul") {
          var otherId = mineSent ? l.alan_id : l.gonderen_id;
          if (userCache[otherId]) {
            friends.push({ id: otherId, user: userCache[otherId], since: l.olusturma });
          }
        } else if (l.durum === "bekliyor") {
          if (mineRecv) requests.push(l);
          else sent.push(l);
        }
      });

      blocked = blk
        .filter(function (b) { return b.uye_id === session.id; })
        .map(function (b) { return b.engellenen_id; });

      pendingReq = requests;

      unreadMsgs = msgs.filter(function (m) {
        return m.alan_id === session.id && !m.okundu;
      });

      /* Sayaçlar */
      var msgBadge = el("msgBadge");
      if (msgBadge) {
        msgBadge.textContent = unreadMsgs.length ? String(unreadMsgs.length) : "";
        msgBadge.setAttribute("data-count", unreadMsgs.length ? "1" : "0");
      }

      return true;
    });
  }

  function respondRequest(linkId, action) {
    A.patchRow("arkadasliklar", linkId, {
      durum: action === "kabul" ? "kabul" : "red"
    }).then(function () {
      return loadSocial();
    }).then(function () {
      renderNotifs();
      renderConvs();
    }).catch(function () {
      /* yoksay */
    });
  }

  var currentTab = "sohbet";

  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () {
      currentTab = t.getAttribute("data-tab");
      Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (x) {
        var on = x === t;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-selected", on ? "true" : "false");
      });
      renderConvs();
    });
  });

  function lastMessageWith(otherId) {
    var pair = allMessages.filter(function (m) {
      return (
        (m.gonderen_id === session.id && m.alan_id === otherId) ||
        (m.gonderen_id === otherId && m.alan_id === session.id)
      );
    }).sort(function (a, b) {
      return Number(b.olusturma || 0) - Number(a.olusturma || 0);
    });
    return pair[0] || null;
  }

  function unreadFrom(otherId) {
    return allMessages.filter(function (m) {
      return m.gonderen_id === otherId && m.alan_id === session.id && !m.okundu;
    }).length;
  }

  function renderConvs() {
    var host = el("convList");
    if (!host) return;

    if (currentTab === "istek") {
      if (!requests.length) {
        host.innerHTML = '<div class="empty"><strong>İstek yok</strong>Gelen arkadaşlık isteği bulunmuyor.</div>';
        return;
      }
      host.innerHTML = requests.map(function (r) {
        return (
          '<div class="conv" style="cursor:default">' +
          '<span class="conv__av">' + esc(initials(nameOf(r.gonderen_id))) + "</span>" +
          '<div class="conv__body"><div class="conv__name">' + esc(nameOf(r.gonderen_id)) + "</div>" +
          '<div class="conv__last">' + esc(fmtWhen(r.olusturma)) + "</div></div>" +
          '<button class="mini-btn mini-btn--ok" data-faccept="' + esc(r.id) + '">Kabul</button>' +
          "</div>"
        );
      }).join("");
      Array.prototype.forEach.call(host.querySelectorAll("[data-faccept]"), function (b) {
        b.addEventListener("click", function () {
          respondRequest(b.getAttribute("data-faccept"), "kabul");
        });
      });
      return;
    }

    if (currentTab === "arkadas") {
      if (!friends.length) {
        host.innerHTML = '<div class="empty"><strong>Henüz arkadaş yok</strong>Yukarıdan kullanıcı adıyla ara.</div>';
        return;
      }
      host.innerHTML = friends.map(function (f) {
        return (
          '<button class="conv" type="button" data-open="' + esc(f.id) + '">' +
          '<span class="conv__av">' + esc(initials(f.user.kullanici_adi)) + "</span>" +
          '<div class="conv__body"><div class="conv__name">' + esc(f.user.kullanici_adi) + "</div>" +
          '<div class="conv__last">Arkadaş</div></div></button>'
        );
      }).join("");
      bindOpen(host);
      return;
    }

    /* Sohbetler */
    var withMsgs = friends.filter(function (f) { return !!lastMessageWith(f.id); });
    if (!friends.length) {
      host.innerHTML = '<div class="empty"><strong>Sohbet yok</strong>Arkadaş ekleyince burada görünür.</div>';
      return;
    }
    var list = withMsgs.length ? withMsgs : friends;
    host.innerHTML = list.map(function (f) {
      var last = lastMessageWith(f.id);
      var n = unreadFrom(f.id);
      return (
        '<button class="conv' + (activeThread === f.id ? " is-active" : "") +
        '" type="button" data-open="' + esc(f.id) + '">' +
        '<span class="conv__av">' + esc(initials(f.user.kullanici_adi)) + "</span>" +
        '<div class="conv__body"><div class="conv__name">' + esc(f.user.kullanici_adi) + "</div>" +
        '<div class="conv__last">' +
        esc(last ? String(last.icerik || "").slice(0, 34) : "Sohbeti başlat") +
        "</div></div>" +
        (n ? '<span class="conv__n">' + n + "</span>" : "") +
        "</button>"
      );
    }).join("");
    bindOpen(host);
  }

  function bindOpen(host) {
    Array.prototype.forEach.call(host.querySelectorAll("[data-open]"), function (b) {
      b.addEventListener("click", function () {
        openThread(b.getAttribute("data-open"));
      });
    });
  }

  /* Arkadaş arama */
  var searchInput = el("friendSearch");
  var searchResults = el("searchResults");
  var searchTimer = null;

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        var q = searchInput.value.trim().toLowerCase();
        if (!q) { searchResults.innerHTML = ""; return; }
        renderSearch(q);
      }, 220);
    });
  }

  function renderSearch(q) {
    if (!q) return;

    /* Sunucu tarafı arama: tüm üye tablosu indirilmez */
    A.searchUsers(q, 12).then(function (rows) {
      var hits = rows.filter(function (u) {
        return u.id !== session.id;
      }).slice(0, 6);

      if (!hits.length) {
        searchResults.innerHTML =
          '<div class="empty" style="padding:14px"><strong>Bulunamadı</strong>Bu kullanıcı adıyla eşleşen üye yok.</div>';
        return;
      }

      hits.forEach(function (u) { userCache[u.id] = u; });

      searchResults.innerHTML = hits.map(function (u) {
        var isFriend = friends.some(function (f) { return f.id === u.id; });
        var isSent = sent.some(function (s) { return s.alan_id === u.id; });
        var isBlocked = blocked.indexOf(u.id) > -1;
        var label = isFriend ? "Arkadaş" : isSent ? "İstek gönderildi" : isBlocked ? "Engelli" : "İstek Gönder";
        return (
          '<div class="conv" style="cursor:default">' +
          '<span class="conv__av">' + esc(initials(u.kullanici_adi)) + "</span>" +
          '<div class="conv__body"><div class="conv__name">' + esc(u.kullanici_adi) + "</div>" +
          '<div class="conv__last">' + esc(label) + "</div></div>" +
          (!isFriend && !isSent && !isBlocked
            ? '<button class="mini-btn" data-add="' + esc(u.id) + '">+</button>'
            : "") +
          "</div>"
        );
      }).join("");

      Array.prototype.forEach.call(searchResults.querySelectorAll("[data-add]"), function (b) {
        b.addEventListener("click", function () {
          sendRequest(b.getAttribute("data-add"));
        });
      });
    });
  }

  function sendRequest(targetId) {
    if (targetId === session.id) return;
    var exists = friends.some(function (f) { return f.id === targetId; }) ||
      sent.some(function (s) { return s.alan_id === targetId; }) ||
      requests.some(function (r) { return r.gonderen_id === targetId; });
    if (exists) return;

    A.createRow("arkadasliklar", {
      gonderen_id: session.id,
      alan_id: targetId,
      durum: "bekliyor",
      olusturma: Date.now()
    }).then(function () {
      return loadSocial();
    }).then(function () {
      renderConvs();
      renderNotifs();
      if (searchInput) renderSearch(searchInput.value.trim().toLowerCase());
    }).catch(function () { /* yoksay */ });
  }

  function openThread(otherId) {
    activeThread = otherId;
    var u = userCache[otherId];
    if (!u) return;

    el("threadTitle").textContent = u.kullanici_adi;
    el("unfriendBtn").hidden = false;
    el("blockBtn").hidden = false;
    el("msgForm").hidden = false;

    paintThread();
    markRead(otherId);
    renderConvs();
  }

  function paintThread() {
    var host = el("thread");
    if (!host || !activeThread) return;

    var msgs = allMessages.filter(function (m) {
      return (
        (m.gonderen_id === session.id && m.alan_id === activeThread) ||
        (m.gonderen_id === activeThread && m.alan_id === session.id)
      );
    }).sort(function (a, b) {
      return Number(a.olusturma || 0) - Number(b.olusturma || 0);
    });

    if (!msgs.length) {
      host.innerHTML = '<div class="empty"><strong>Sohbet boş</strong>İlk mesajı sen gönder.</div>';
      return;
    }

    host.innerHTML = msgs.map(function (m) {
      var mine = m.gonderen_id === session.id;
      return (
        '<div class="bubble' + (mine ? " bubble--me" : "") + '">' +
        esc(m.icerik) +
        '<span class="bubble__when">' + esc(fmtWhen(m.olusturma)) + "</span></div>"
      );
    }).join("");
    host.scrollTop = host.scrollHeight;
  }

  function markRead(otherId) {
    var toMark = allMessages.filter(function (m) {
      return m.gonderen_id === otherId && m.alan_id === session.id && !m.okundu;
    });
    if (!toMark.length) return;
    Promise.all(toMark.map(function (m) {
      m.okundu = true;
      return A.patchRow("mesajlar", m.id, { okundu: true }).catch(function () {});
    })).then(function () {
      unreadMsgs = allMessages.filter(function (m) {
        return m.alan_id === session.id && !m.okundu;
      });
      var badge = el("msgBadge");
      if (badge) {
        badge.textContent = unreadMsgs.length ? String(unreadMsgs.length) : "";
        badge.setAttribute("data-count", unreadMsgs.length ? "1" : "0");
      }
    });
  }

  var msgForm = el("msgForm");
  if (msgForm) {
    msgForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = el("msgInput");
      var text = input ? input.value.trim() : "";
      if (!text || !activeThread) return;
      input.value = "";

      A.createRow("mesajlar", {
        gonderen_id: session.id,
        alan_id: activeThread,
        icerik: text.slice(0, 500),
        okundu: false,
        olusturma: Date.now()
      }).then(function (created) {
        allMessages.push(created);
        paintThread();
        renderConvs();
        /* mesaj sayacı */
        var count = Number(me.mesaj_sayisi || 0) + 1;
        me.mesaj_sayisi = count;
        el("statMesaj").textContent = money(count);
        return A.patchRow("uyeler", session.id, { mesaj_sayisi: count }).catch(function () {});
      }).catch(function () { /* yoksay */ });
    });
  }

  var unfriendBtn = el("unfriendBtn");
  if (unfriendBtn) {
    unfriendBtn.addEventListener("click", function () {
      if (!activeThread) return;
      A.listAll("arkadasliklar", 800).then(function (rows) {
        var link = rows.filter(function (l) {
          return (
            l.durum === "kabul" &&
            ((l.gonderen_id === session.id && l.alan_id === activeThread) ||
              (l.alan_id === session.id && l.gonderen_id === activeThread))
          );
        })[0];
        if (!link) return null;
        return A.deleteRow("arkadasliklar", link.id);
      }).then(function () {
        activeThread = null;
        el("threadTitle").textContent = "Sohbet seç";
        el("thread").innerHTML = '<div class="empty"><strong>Sohbetten çıkıldı</strong>Arkadaşlık kaldırıldı.</div>';
        el("msgForm").hidden = true;
        el("unfriendBtn").hidden = true;
        el("blockBtn").hidden = true;
        return loadSocial();
      }).then(function () {
        renderConvs();
        renderNotifs();
      }).catch(function () { /* yoksay */ });
    });
  }

  var blockBtn = el("blockBtn");
  if (blockBtn) {
    blockBtn.addEventListener("click", function () {
      if (!activeThread) return;
      var target = activeThread;
      A.createRow("engeller", {
        uye_id: session.id,
        engellenen_id: target,
        olusturma: Date.now()
      }).then(function () {
        activeThread = null;
        el("threadTitle").textContent = "Sohbet seç";
        el("thread").innerHTML = '<div class="empty"><strong>Kullanıcı engellendi</strong>Bu üyeden artık mesaj alamazsın.</div>';
        el("msgForm").hidden = true;
        el("unfriendBtn").hidden = true;
        el("blockBtn").hidden = true;
        return loadSocial();
      }).then(function () {
        renderConvs();
        renderNotifs();
      }).catch(function () { /* yoksay */ });
    });
  }

  /* ---------- 9. Avatar ---------- */

  var avatarPick = el("avatarPick");
  var avatarFile = el("avatarFile");
  var avatarStatus = el("avatarStatus");

  var MAX_NORMAL = 200 * 1024;
  var MAX_SUPREME = 3 * 1024 * 1024;
  var ALLOWED = ["image/png", "image/jpeg", "image/gif"];

  if (avatarPick && avatarFile) {
    avatarPick.addEventListener("click", function () { avatarFile.click(); });

    avatarFile.addEventListener("change", function () {
      var file = avatarFile.files && avatarFile.files[0];
      if (!file) return;
      status(avatarStatus, "", null);

      var supreme = isSupreme(me);

      if (ALLOWED.indexOf(file.type) === -1) {
        status(avatarStatus, "Yalnızca PNG, JPG veya GIF yükleyebilirsin.", "is-error");
        avatarFile.value = "";
        return;
      }

      if (file.type === "image/gif" && !supreme) {
        status(avatarStatus, "GIF avatar yalnızca Supreme üyeler içindir.", "is-error");
        avatarFile.value = "";
        return;
      }

      var limit = supreme ? MAX_SUPREME : MAX_NORMAL;
      if (file.size > limit) {
        status(
          avatarStatus,
          supreme
            ? "Dosya çok büyük. Supreme üyeler en fazla 3 MB yükleyebilir."
            : "Dosya çok büyük. Standart hesaplar en fazla 200 KB yükleyebilir. (Supreme: 3 MB)",
          "is-error"
        );
        avatarFile.value = "";
        return;
      }

      status(avatarStatus, "Yükleniyor…", null);

      var name = encodeURIComponent(file.name || "avatar");
      fetch("/files/avatarlar", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-File-Name": name,
          "Idempotency-Key": (window.crypto && window.crypto.randomUUID)
            ? window.crypto.randomUUID()
            : String(Date.now())
        },
        body: file
      }).then(function (res) {
        if (res.status === 401) {
          throw new Error("Görsel yüklemek için yeniden giriş yapman gerekiyor.");
        }
        if (res.status === 404 || res.status === 503) {
          throw new Error(
            "Görsel yükleme bu ortamda etkin değil. Site yayına alındıktan sonra çalışacak."
          );
        }
        if (res.status === 413) {
          throw new Error("Dosya sunucu sınırını aşıyor. Daha küçük bir görsel seç.");
        }
        if (!res.ok) throw new Error("Yükleme başarısız (" + res.status + ").");
        return res.json();
      }).then(function (data) {
        var ref = data && data.reference;
        if (!ref) throw new Error("Sunucudan geçerli bir dosya referansı gelmedi.");

        return A.patchRow("uyeler", session.id, {
          avatar_ref: ref,
          avatar_turu: file.type
        }).then(function () {
          me.avatar_ref = ref;
          me.avatar_turu = file.type;
          renderIdentity();
          status(avatarStatus, "Profil fotoğrafın güncellendi.", "is-ok");
        });
      }).catch(function (err) {
        status(avatarStatus, err.message || "Yükleme başarısız.", "is-error");
      }).then(function () {
        avatarFile.value = "";
      });
    });
  }

  /* ---------- 10. Mağaza ---------- */

  function renderShop() {
    var host = el("shopGrid");
    if (!host) return;

    A.listAll("magaza", 100).then(function (rows) {
      var items = rows.filter(function (r) { return r.aktif !== false; });
      host.innerHTML = items.map(function (p) {
        var img = p.gorsel_url
          ? '<img class="shop-card__img" src="' + esc(p.gorsel_url) + '" alt="' + esc(p.ad) + '" loading="lazy" />'
          : '<div class="shop-card__img"></div>';
        var affordable = Number((me && me.kredi) || 0) >= Number(p.kredi_fiyat || 0);
        return (
          '<article class="shop-card">' + img +
          '<div class="shop-card__body">' +
          '<h3 class="shop-card__name">' + esc(p.ad) + "</h3>" +
          '<p class="shop-card__desc">' + esc(p.aciklama) + "</p>" +
          '<div class="shop-card__foot">' +
          '<span class="price-tag">' + money(p.kredi_fiyat) + " <small>kredi</small></span>" +
          '<button class="mini-btn" data-buy="' + esc(p.id) + '"' +
          (affordable ? "" : " disabled") +
          ">" + (affordable ? "Satın Al" : "Yetersiz") + "</button>" +
          "</div></div></article>"
        );
      }).join("");

      Array.prototype.forEach.call(host.querySelectorAll("[data-buy]"), function (b) {
        b.addEventListener("click", function () { buy(b.getAttribute("data-buy")); });
      });
    }).catch(function () {
      host.innerHTML = '<div class="empty"><strong>Mağaza yüklenemedi</strong>Bağlantını kontrol et.</div>';
    });
  }

  /* Supreme bitişini satın alma tarihinden itibaren `gun` kadar uzat.
     Mevcut Supreme hâlâ geçerliyse kalan sürenin üzerine eklenir. */
  function extendSupreme(row, gun) {
    var days = Number(gun || 0);
    if (!days) return null;

    var base = new Date();
    if (row && row.supreme_bitis) {
      var current = new Date(String(row.supreme_bitis) + "T23:59:59");
      if (!isNaN(current.getTime()) && current.getTime() > base.getTime()) {
        base = current;
      }
    }
    base.setDate(base.getDate() + days);

    var y = base.getFullYear();
    var m = ("0" + (base.getMonth() + 1)).slice(-2);
    var d = ("0" + base.getDate()).slice(-2);
    return y + "-" + m + "-" + d;
  }

  function buy(productId) {
    var shopStatus = el("shopStatus");
    status(shopStatus, "", null);

    A.listAll("magaza", 100).then(function (rows) {
      var p = rows.filter(function (r) { return r.id === productId; })[0];
      if (!p) throw new Error("Ürün bulunamadı.");

      var credit = Number(me.kredi || 0);
      var price = Number(p.kredi_fiyat || 0);
      if (credit < price) throw new Error("Yeterli kredin yok.");
      if (Number(p.stok) <= 0) throw new Error("Ürün stokta yok.");

      var next = credit - price;
      me.kredi = next;

      var newEnd = extendSupreme(me, p.gun);
      var patch = { kredi: next };
      if (newEnd) patch.supreme_bitis = newEnd;

      return A.patchRow("uyeler", session.id, patch)
        .then(function () {
          if (newEnd) me.supreme_bitis = newEnd;
          renderIdentity();
          renderSupreme();
          renderProfile();
          loadMoves(5, "recentMoves");
          return addMove(-price, "magaza", p.ad + " satın alındı");
        })
        .then(function () {
          return A.patchRow("magaza", p.id, { stok: Math.max(0, Number(p.stok) - 1) });
        })
        .then(function () {
          status(
            shopStatus,
            p.ad + " satın alındı. " + money(next) + " kredin kaldı." +
              (newEnd ? " Supreme bitişi: " + newEnd : ""),
            "is-ok"
          );
          renderShop();
          renderCredits();
        });
    }).catch(function (err) {
      status(shopStatus, err.message || "Satın alma tamamlanamadı.", "is-error");
    });
  }

  /* ---------- 11. Krediler ---------- */

  function renderCredits() {
    var credit = Number((me && me.kredi) || 0);
    /* Mağaza/Krediler bölümleri kaldırıldı; öğeler yoksa sessizce geç. */
    var num = el("creditNum");
    if (num) num.textContent = money(credit);
    var shopNum = el("shopCredit");
    if (shopNum) shopNum.textContent = money(credit);

    var today = A.todayKey();
    var claimed = !!me && me.son_gunluk_kredi === today;
    var btn = el("dailyBtn");
    var note = el("dailyNote");

    if (btn) {
      btn.disabled = claimed;
      btn.textContent = claimed ? "Bugün Alındı" : "Günlük 10 Kredi Al";
    }
    if (note) {
      note.textContent = claimed
        ? "Günlük kredini bugün aldın. Yarın Türkiye saati 00:00'da yenilenir."
        : "Günde bir kez alınabilir. Türkiye saati 00:00'da yenilenir.";
    }

    loadMoves(0, "creditHistory");
  }

  var dailyBtn = el("dailyBtn");
  if (dailyBtn) {
    dailyBtn.addEventListener("click", function () {
      var today = A.todayKey();
      if (me.son_gunluk_kredi === today) return;

      var next = Number(me.kredi || 0) + 10;
      me.son_gunluk_kredi = today;
      me.kredi = next;

      A.patchRow("uyeler", session.id, {
        kredi: next,
        son_gunluk_kredi: today
      }).then(function () {
        renderIdentity();
        return addMove(10, "gunluk", "Günlük giriş kredisi");
      }).then(function () {
        renderCredits();
        loadMoves(5, "recentMoves");
      }).catch(function () {
        /* yoksay */
      });
    });
  }

  /* ---------- 12. Supreme ---------- */

  function renderSupreme() {
    var badge = el("supremeState");
    var supreme = isSupreme(me);
    if (badge) {
      badge.textContent = supreme ? "Aktif" : "Aktif Değil";
    }
  }

  /* ---------- 13. Destek ---------- */

  var CAT_LABEL = {
    yanitlandi: "Yanıtlandı",
    bekliyor: "Bekleniyor",
    kapatildi: "Kapatıldı"
  };

  function renderTickets() {
    var host = el("ticketList");
    if (!host) return;

    A.listAll("destek_talepleri", 400).then(function (rows) {
      myTickets = rows
        .filter(function (t) { return t.uye_id === session.id; })
        .sort(function (a, b) { return Number(b.olusturma || 0) - Number(a.olusturma || 0); });

      if (!myTickets.length) {
        host.innerHTML =
          '<div class="empty"><strong>Talep yok</strong>Yukarıdaki formdan ilk destek talebini oluştur.</div>';
        return;
      }

      host.innerHTML = myTickets.map(function (t) {
        var durum = t.durum || "bekliyor";
        return (
          '<div class="ticket">' +
          '<div class="ticket__head">' +
          '<span class="ticket__title">' + esc(t.konu || t.baslik) + "</span>" +
          '<span class="tag tag--' + esc(durum) + '">' + esc(CAT_LABEL[durum] || durum) + "</span>" +
          "</div>" +
          '<div class="ticket__body">' +
          (t.kategori ? "<strong>" + esc(t.kategori) + "</strong> · " : "") +
          esc(t.baslik || "") +
          (t.aciklama ? "<br />" + esc(t.aciklama) : "") +
          "</div>" +
          (t.cevap
            ? '<div class="ticket__reply"><strong>Destek yanıtı</strong>' + esc(t.cevap) + "</div>"
            : "") +
          "</div>"
        );
      }).join("");
    }).catch(function () {
      host.innerHTML = '<div class="empty"><strong>Talepler yüklenemedi</strong>Bağlantını kontrol et.</div>';
    });
  }

  var ticketForm = el("ticketForm");
  if (ticketForm) {
    ticketForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var tStatus = el("ticketStatus");
      status(tStatus, "", null);

      var konu = (el("tKonu").value || "").trim();
      var baslik = (el("tBaslik").value || "").trim();
      var kategori = (el("tKategori").value || "").trim();
      var aciklama = (el("tAciklama").value || "").trim();

      if (!konu || !baslik || !kategori || !aciklama) {
        status(tStatus, "Konu, başlık, kategori ve açıklama alanlarını doldurun.", "is-error");
        return;
      }

      A.createRow("destek_talepleri", {
        uye_id: session.id,
        konu: konu,
        baslik: baslik,
        kategori: kategori,
        aciklama: aciklama,
        durum: "bekliyor",
        cevap: "",
        olusturma: Date.now()
      }).then(function () {
        el("tKonu").value = "";
        el("tBaslik").value = "";
        el("tKategori").value = "";
        el("tAciklama").value = "";
        status(tStatus, "Destek talebin oluşturuldu. Durum: Bekleniyor.", "is-ok");
        renderTickets();
      }).catch(function () {
        status(tStatus, "Talep oluşturulamadı. Tekrar deneyin.", "is-error");
      });
    });
  }

  /* ---------- 13b. Profil Bilgileri (istersen 5) ----------
     E-posta değiştirilemez. Kullanıcı adı 72 saatte bir kez. */

  var KADI_ARALIK = 72 * 3600 * 1000;

  function kadiKilitKalan() {
    var last = Number((me && me.son_kadi_degisim) || 0);
    if (!last) return 0;
    var kalan = KADI_ARALIK - (Date.now() - last);
    return kalan > 0 ? kalan : 0;
  }

  function renderProfile() {
    if (el("pAd")) el("pAd").value = profile.ad || "";
    if (el("pSoyad")) el("pSoyad").value = profile.soyad || "";
    if (el("pKadi")) el("pKadi").value = me.kullanici_adi || "";
    if (el("pEmail")) el("pEmail").value = profile.email || "";
    if (el("pCinsiyet")) el("pCinsiyet").value = profile.cinsiyet || "";
    if (el("pDogum")) el("pDogum").value = profile.dogum_tarihi || "";

    var kalan = kadiKilitKalan();
    var kadi = el("pKadi");
    var note = el("pKadiNote");

    if (kadi) kadi.disabled = kalan > 0;

    if (note) {
      if (kalan > 0) {
        var saat = Math.ceil(kalan / 3600000);
        note.textContent =
          (I ? I.t("profile.nextChange", "Sonraki değişiklik") : "Sonraki değişiklik") +
          ": " + saat + " " + (I && I.lang() === "en" ? "h" : "sa") +
          " · " + (I ? I.t("profile.cooldown", "Kullanıcı adı 72 saatte yalnızca bir kez değiştirilebilir.") : "Kullanıcı adı 72 saatte yalnızca bir kez değiştirilebilir.");
      } else {
        note.textContent = I ? I.t("profile.cooldown", "Kullanıcı adı 72 saatte yalnızca bir kez değiştirilebilir.") : "Kullanıcı adı 72 saatte yalnızca bir kez değiştirilebilir.";
      }
    }
  }

  function pErr(inputId, errId, msg) {
    var input = el(inputId);
    var err = el(errId);
    if (input) input.classList.toggle("is-invalid", !!msg);
    if (err) {
      err.textContent = msg || "";
      err.classList.toggle("is-shown", !!msg);
    }
    return !msg;
  }

  var profileForm = el("profileForm");
  if (profileForm) {
    profileForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var out = el("profileStatus");
      var save = el("profileSave");
      status(out, "", null);

      var ad = (el("pAd").value || "").trim();
      var soyad = (el("pSoyad").value || "").trim();
      var kadi = (el("pKadi").value || "").trim().toLowerCase();
      var cinsiyet = el("pCinsiyet").value || "";
      var dogum = el("pDogum").value || "";

      var ok = true;
      ok = pErr("pAd", "epAd", ad.length < 2 ? "Ad en az 2 karakter olmalı." : "") && ok;
      ok = pErr("pSoyad", "epSoyad", soyad.length < 2 ? "Soyad en az 2 karakter olmalı." : "") && ok;

      var kadiHata = "";
      if (kadi !== String(me.kullanici_adi || "").toLowerCase()) {
        if (kadiKilitKalan() > 0) {
          kadiHata = "Kullanıcı adı 72 saatte yalnızca bir kez değiştirilebilir.";
        } else {
          kadiHata = A.kullaniciAdiHatasi(kadi);
        }
      }
      ok = pErr("pKadi", "epKadi", kadiHata) && ok;
      ok = pErr("pDogum", "epDogum", A.dogumTarihiHatasi(dogum)) && ok;

      if (!ok) {
        status(out, "Lütfen işaretli alanları düzeltin.", "is-error");
        return;
      }

      if (save) { save.disabled = true; save.textContent = "Kaydediliyor…"; }
      status(out, "Kaydediliyor…", null);

      var kadiDegisti = kadi !== String(me.kullanici_adi || "").toLowerCase();

      var uniq = kadiDegisti
        ? A.byUsername(kadi).then(function (row) {
            return !!row && row.id !== session.id;
          })
        : Promise.resolve(false);

      uniq
        .then(function (taken) {
          if (taken) throw new Error("Bu kullanıcı adı zaten kullanılıyor.");
          return A.encryptFields(
            { ad: ad, soyad: soyad, cinsiyet: cinsiyet, dogum_tarihi: dogum },
            aesKey
          );
        })
        .then(function (enc) {
          var patch = {
            ad: enc.ad,
            soyad: enc.soyad,
            cinsiyet: enc.cinsiyet,
            dogum_tarihi: enc.dogum_tarihi
          };
          if (kadiDegisti) {
            patch.kullanici_adi = kadi;
            patch.son_kadi_degisim = Date.now();
          }
          return A.patchRow("uyeler", session.id, patch);
        })
        .then(function () {
          profile.ad = ad;
          profile.soyad = soyad;
          profile.cinsiyet = cinsiyet;
          profile.dogum_tarihi = dogum;
          if (kadiDegisti) {
            me.kullanici_adi = kadi;
            me.son_kadi_degisim = Date.now();
          }
          renderIdentity();
          renderProfile();
          status(out, "Profil bilgilerin güncellendi.", "is-ok");
        })
        .catch(function (err) {
          status(out, err.message || "Kaydedilemedi. Tekrar deneyin.", "is-error");
        })
        .then(function () {
          if (save) {
            save.disabled = false;
            save.textContent = "Değişiklikleri Kaydet";
          }
        });
    });
  }

  /* ---------- 13a. Bildirim durumu (istersen 6) ----------
     Okundu / sil / tümünü okundu, `bildirimler` tablosunda tutulur.
     7 günden eski kayıtlar açılışta temizlenir. */

  var BILDIRIM_GUN = 7;
  var notifStore = {};   /* anahtar -> satır */

  function notifKeyOf(item) {
    return item.key || ("sys:" + String(item.when || 0));
  }

  function loadNotifState() {
    return A.listAll("bildirimler", 400)
      .then(function (rows) {
        notifStore = {};
        rows.forEach(function (r) {
          if (r.uye_id !== session.id) return;
          if (!r.anahtar) return;
          notifStore[r.anahtar] = r;
        });
      })
      .catch(function () { notifStore = {}; });
  }

  function ensureNotifRow(anahtar, patch) {
    var body = {
      uye_id: session.id,
      anahtar: anahtar,
      metin: "",
      okundu: false,
      gizli: false,
      olusturma: Date.now()
    };
    Object.keys(patch || {}).forEach(function (k) { body[k] = patch[k]; });

    var existing = notifStore[anahtar];
    if (existing) {
      var merged = {};
      Object.keys(patch || {}).forEach(function (k) { merged[k] = patch[k]; });
      return A.patchRow("bildirimler", existing.id, merged).then(function (row) {
        notifStore[anahtar] = Object.assign({}, existing, merged);
        return row;
      });
    }

    return A.createRow("bildirimler", body).then(function (row) {
      if (row && row.id) notifStore[anahtar] = row;
      return row;
    });
  }

  /* 7 günden eski bildirim kayıtlarını sil */
  function purgeNotifications() {
    var sinir = Date.now() - BILDIRIM_GUN * 86400000;
    var eski = Object.keys(notifStore)
      .map(function (k) { return notifStore[k]; })
      .filter(function (r) { return Number(r.olusturma || 0) < sinir; });

    if (!eski.length) return Promise.resolve(0);

    return Promise.all(eski.map(function (r) {
      return A.deleteRow("bildirimler", r.id)
        .then(function () { delete notifStore[r.anahtar]; })
        .catch(function () {});
    })).then(function () { return eski.length; });
  }

  /* 3 günden eski mesajları sunucu kayıtlarından sil (istersen 7) */
  function purgeMessages() {
    var sinir = Date.now() - 3 * 86400000;
    var eski = allMessages.filter(function (m) {
      return Number(m.olusturma || 0) < sinir &&
        (m.gonderen_id === session.id || m.alan_id === session.id);
    });

    if (!eski.length) return Promise.resolve(0);

    return Promise.all(eski.map(function (m) {
      return A.deleteRow("mesajlar", m.id).catch(function () {});
    })).then(function () {
      allMessages = allMessages.filter(function (m) { return eski.indexOf(m) === -1; });
      return eski.length;
    });
  }

  /* ---------- 14. Başlat ---------- */

  loadMe()
    .then(function () {
      renderProfile();
      /* Önce ilişkiler, sonra isim çözümü: loadUserCache
         friends/requests/messages listelerine ihtiyaç duyar. */
      return loadSocial();
    })
    .then(function () {
      /* 7 günden eski bildirimler ve 3 günden eski mesajlar temizlenir */
      return Promise.all([loadNotifState(), purgeMessages()]);
    })
    .then(function () {
      return purgeNotifications();
    })
    .then(function () {
      return loadUserCache();
    })
    .then(function () {
      renderNotifs();
      renderConvs();
      renderSupreme();
      return loadMoves(5, "recentMoves");
    })
    .catch(function (err) {
      var box = el("welcomeMeta");
      if (box) box.textContent = "Veriler yüklenemedi: " + (err.message || "bağlantı hatası");
    });

  /* Hash ile bölüm açma (#mesajlar gibi) */
  var hash = String(window.location.hash || "").replace("#", "");
  if (hash && el("p-" + hash)) showPanel(hash);
})();
