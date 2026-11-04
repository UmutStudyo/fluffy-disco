/* =========================================================
   Avalanche — forum.js
   Gerçek forum: konu açma, yorum, beğeni, takip, profil,
   düzenleme/silme, kategori + konu arama, bildirim.

   Veri: forum_konular, forum_yorumlar, forum_begeniler,
         forum_takip tabloları (Table API).
   Okuma herkese açık; yazma için üye oturumu gerekir.
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

  var CATS = [
    { key: "genel", label: "Genel Sohbet" },
    { key: "duyurular", label: "Duyurular" },
    { key: "cs16", label: "CS 1.6" },
    { key: "jailbreak", label: "Jailbreak" },
    { key: "yardim", label: "Yardım ve Destek" },
    { key: "paylasimlar", label: "Paylaşımlar" },
    { key: "ban", label: "Ban İtirazları" }
  ];

  function catLabel(key) {
    var hit = CATS.filter(function (c) { return c.key === key; })[0];
    return hit ? hit.label : "Genel Sohbet";
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

  function initials(name) {
    var p = String(name || "?").trim().split(/\s+/);
    var a = (p[0] || "?")[0] || "?";
    var b = p.length > 1 ? p[p.length - 1][0] : "";
    return (a + b).toUpperCase();
  }

  /* ---------- Oturum ---------- */
  var session = A.getSession();
  var myId = session ? session.id : null;

  /* ---------- Durum ---------- */
  var topics = [];
  var likes = [];        /* benim beğenilerim */
  var following = [];    /* takip ettiğim id'ler */
  var activeCat = "all";
  var searchTerm = "";

  function isLoggedIn() { return !!myId; }

  /* Konu sahibi, konusunu açtıktan sonra yalnızca 3 gün düzenleyebilir. */
  var EDIT_WINDOW = 3 * 24 * 60 * 60 * 1000;

  function withinEditWindow(row) {
    var born = Number((row && row.olusturma) || 0);
    if (!born) return true;
    return Date.now() - born < EDIT_WINDOW;
  }

  /* Kullanıcının bu konudaki oyu: "begeni" | "begenmeme" | null */
  function myVoteOn(topicId) {
    var hit = likes.filter(function (l) { return l.konu_id === topicId; })[0];
    return hit ? (hit.tip === "begenmeme" ? "begenmeme" : "begeni") : null;
  }

  /* Yanıt oyları ayrı tabloda tutulur */
  var replyVotes = [];

  function myReplyVoteOn(replyId) {
    var hit = replyVotes.filter(function (v) { return v.yanit_id === replyId; })[0];
    return hit ? (hit.tip === "begenmeme" ? "begenmeme" : "begeni") : null;
  }

  /* ---------- Yazar görünümü ----------
     Kullanıcı adı rengi/gradyeni `uyeler.kadi_stil` alanından gelir.
     Yazar kayıtları önbelleğe alınır; ilk boyamada eksikse bir kez
     yüklenip yeniden çizilir (sonsuz döngü yok: önbellek dolunca durur). */
  var userCache = {};

  function loadAuthors(ids) {
    var missing = [];
    ids.forEach(function (id) {
      if (id && !userCache[id] && missing.indexOf(id) === -1) missing.push(id);
    });
    if (!missing.length) return Promise.resolve(false);

    return Promise.all(missing.slice(0, 60).map(function (id) {
      return A.getRow("uyeler", id).then(function (u) {
        userCache[id] = u || { id: id };
      }).catch(function () {
        userCache[id] = { id: id };
      });
    })).then(function () { return true; });
  }

  function authorHtml(name, id) {
    var u = id ? userCache[id] : null;
    if (u && typeof A.kadiHtml === "function") return A.kadiHtml(name, u);
    return esc(name || "üye");
  }

  /* ---------- Zengin metin güvenliği ----------
     Editör HTML üretir. Tabloda HTML olarak saklanır; ekrana basarken
     yalnızca biçimlendirme etiketlerine izin verilir, script/handler ve
     harici protokoller atılır. Böylece kullanıcı içeriği kod çalıştıramaz. */
  var ALLOWED = /^(b|strong|i|em|u|s|br|p|div|span|font|ul|ol|li|img|blockquote)$/i;

  function safeHtml(raw) {
    var src = String(raw == null ? "" : raw);
    /* Düz metin içerik (eski kayıtlar) satır sonlarını koru */
    if (src.indexOf("<") === -1) {
      return esc(src).replace(/\n/g, "<br />");
    }

    var doc;
    try {
      doc = new DOMParser().parseFromString("<div>" + src + "</div>", "text/html");
    } catch (e) {
      return esc(src);
    }
    var root = doc.body.firstChild;
    if (!root) return "";

    function clean(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) return;              /* metin */
        if (child.nodeType !== 1) { child.remove(); return; }

        var tag = child.tagName.toLowerCase();
        if (tag === "script" || tag === "style" || tag === "iframe" ||
            tag === "object" || tag === "embed" || !ALLOWED.test(tag)) {
          child.remove();
          return;
        }

        /* Önce güvenli değerleri OKU, sonra tüm nitelikleri temizle */
        var keepColor = tag === "font" ? child.getAttribute("color") : null;
        var keepSrc = tag === "img" ? child.getAttribute("src") : null;
        var keepAlt = tag === "img" ? child.getAttribute("alt") : null;

        Array.prototype.slice.call(child.attributes).forEach(function (a) {
          child.removeAttribute(a.name);
        });

        if (tag === "font") {
          if (/^#[0-9a-f]{3,8}$/i.test(String(keepColor || ""))) {
            child.setAttribute("color", keepColor);
          }
          clean(child);
          return;
        }

        if (tag === "img") {
          /* Yalnızca https/data-görsel kabul edilir; javascript: reddedilir */
          var ok = /^(https:\/\/|data:image\/(png|jpe?g|gif|webp);base64,)/i.test(String(keepSrc || ""));
          if (!ok) { child.remove(); return; }
          child.setAttribute("src", keepSrc);
          child.setAttribute("alt", String(keepAlt || "").slice(0, 120));
          child.setAttribute("loading", "lazy");
          return;
        }

        clean(child);
      });
    }

    clean(root);
    return root.innerHTML;
  }

  function requireLogin(msg) {
    if (isLoggedIn()) return true;
    window.location.href = "giris.html";
    return false;
  }

  /* ---------- Görünümler ---------- */
  var V = { list: el("forumListe"), topic: el("forumKonu"), newT: el("forumYeni"), prof: el("forumProfil") };

  function show(view) {
    Object.keys(V).forEach(function (k) {
      if (!V[k]) return;
      V[k].hidden = k !== view;
    });
    if (view === "list") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- Kategoriler ---------- */
  function paintCats() {
    var host = el("forumCats");
    if (!host) return;

    var counts = {};
    topics.forEach(function (t) {
      if (t.gizli) return;
      counts[t.kategori] = (counts[t.kategori] || 0) + 1;
    });

    var all = '<button class="forum-cat' + (activeCat === "all" ? " is-active" : "") +
      '" type="button" role="tab" data-cat="all" aria-selected="' + (activeCat === "all") + '">' +
      "Tümü <span class=\"forum-cat__n\">" + topics.filter(function (t) { return !t.gizli; }).length + "</span></button>";

    host.innerHTML = all + CATS.map(function (c) {
      var n = counts[c.key] || 0;
      return '<button class="forum-cat' + (activeCat === c.key ? " is-active" : "") +
        '" type="button" role="tab" data-cat="' + c.key + '" aria-selected="' + (activeCat === c.key) + '">' +
        esc(c.label) + ' <span class="forum-cat__n">' + n + "</span></button>";
    }).join("");

    Array.prototype.forEach.call(host.querySelectorAll("[data-cat]"), function (b) {
      b.addEventListener("click", function () {
        activeCat = b.getAttribute("data-cat");
        paintCats();
        paintTopics();
      });
    });

    /* Yeni konu formundaki seçenekler */
    var sel = el("fKategori");
    if (sel && !sel.options.length) {
      sel.innerHTML = CATS.map(function (c) {
        return '<option value="' + c.key + '">' + esc(c.label) + "</option>";
      }).join("");
    }
  }

  /* ---------- Konu listesi ---------- */
  function paintTopics() {
    var host = el("forumTopics");
    if (!host) return;

    var list = topics.filter(function (t) {
      if (t.gizli) return false;
      if (activeCat !== "all" && t.kategori !== activeCat) return false;
      if (!searchTerm) return true;
      var hay = (String(t.baslik || "") + " " + String(t.yazar || "") + " " +
        catLabel(t.kategori)).toLowerCase();
      return hay.indexOf(searchTerm) > -1;
    });

    list.sort(function (a, b) {
      if (!!b.sabit !== !!a.sabit) return b.sabit ? 1 : -1;
      return Number(b.son_hareket || b.olusturma || 0) - Number(a.son_hareket || a.olusturma || 0);
    });

    if (!list.length) {
      host.innerHTML =
        '<div class="forum-empty"><strong>Konu bulunamadı</strong>' +
        (searchTerm ? "Aramayla eşleşen konu yok. Farklı bir kelime dene." : "Bu kategoride henüz konu açılmamış. İlk konuyu sen aç.") +
        "</div>";
      return;
    }

    host.innerHTML = list.map(function (t) {
      var tags = "";
      if (t.sabit) tags += '<span class="forum-tag forum-tag--pin">Sabit</span>';
      if (t.kilitli) tags += '<span class="forum-tag forum-tag--lock">Kilitli</span>';

      return (
        '<button class="forum-topic" type="button" data-topic="' + esc(t.id) + '">' +
        '<span class="forum-topic__av">' + esc(initials(t.yazar)) + "</span>" +
        '<span class="forum-topic__main">' +
        '<span class="forum-topic__title">' + esc(t.baslik) + "</span>" +
        '<span class="forum-topic__meta">' +
        '<span class="forum-tag forum-tag--cat">' + esc(catLabel(t.kategori)) + "</span>" +
                "<span>" + authorHtml(t.yazar, t.uye_id) + "</span><span>·</span><span>" +
        esc(when(t.son_hareket || t.olusturma)) + "</span>" + tags +
        "</span></span>" +
        '<span class="forum-topic__stats">' +
        '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2 .5-4.6A7.5 7.5 0 0 1 12.5 5 7.5 7.5 0 0 1 20 12.5z"/></svg>' +
        Number(t.yorum_sayisi || 0) + "</span>" +
        '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5l-1.4-1.3C6 15.2 3 12.5 3 9.2A4.7 4.7 0 0 1 7.7 4.5c1.6 0 3.1.8 4.3 2.2 1.2-1.4 2.7-2.2 4.3-2.2A4.7 4.7 0 0 1 21 9.2c0 3.3-3 6-7.6 10z"/></svg>' +
        Number(t.begeni || 0) + "</span>" +
        "</span></button>"
      );
    }).join("");

    Array.prototype.forEach.call(host.querySelectorAll("[data-topic]"), function (b) {
      b.addEventListener("click", function () {
        window.location.hash = "konu=" + b.getAttribute("data-topic");
      });
    });
  }

  /* ---------- Konu görünümü ---------- */
  var currentTopic = null;
  /* Yanıt oyu hesabında güncel sayaçlar buradan okunur */
  var currentReplies = [];

  function renderTopic(id) {
    var host = el("forumTopicView");
    if (!host) return;
    show("topic");
    host.innerHTML = '<div class="forum-empty"><strong>Yükleniyor…</strong></div>';

    A.getRow("forum_konular", id).then(function (row) {
      if (!row || row.gizli) {
        host.innerHTML = '<div class="forum-empty"><strong>Konu bulunamadı</strong>Silinmiş olabilir.</div>';
        return;
      }
      currentTopic = row;

      return A.listAll("forum_yorumlar", 500).then(function (allReplies) {
        var replies = allReplies
          .filter(function (r) { return r.konu_id === row.id && !r.gizli; })
          .sort(function (a, b) { return Number(a.olusturma || 0) - Number(b.olusturma || 0); });

        currentReplies = replies;

        /* Yazar renkleri için eksik kayıtları yükle, sonra bir kez yeniden çiz */
        loadAuthors([row.uye_id].concat(replies.map(function (r) { return r.uye_id; })))
          .then(function (added) { if (added) renderTopic(id); });

        var vote = myVoteOn(row.id);
        var liked = vote === "begeni";
        var disliked = vote === "begenmeme";
        var mine = row.uye_id === myId;
        var editable = mine && withinEditWindow(row);
        var expired = mine && !withinEditWindow(row);

        var replyHtml = replies.length
          ? replies.map(function (r) {
              var own = r.uye_id === myId;
              var rv = myReplyVoteOn(r.id);
              var rVote = rv;
              return (
                '<div class="forum-reply" data-reply="' + esc(r.id) + '">' +
                '<div class="forum-reply__head">' +
                '<span class="forum-topic__av" style="width:28px;height:28px;border-radius:9px;font-size:10.5px">' +
                esc(initials(r.yazar)) + "</span>" +
                '<button class="forum-reply__who" type="button" data-author="' + esc(r.uye_id) + '">' +
                authorHtml(r.yazar, r.uye_id) + "</button>" +
                '<span class="forum-reply__when">' + esc(when(r.olusturma)) + "</span>" +
                "</div>" +
                '<div class="forum-reply__body">' + safeHtml(r.icerik) + "</div>" +
                '<div class="forum-acts forum-acts--reply">' +
                '<button class="mini-btn forum-vote' + (rVote === "begeni" ? " is-like" : "") +
                '" type="button" data-rvote="' + esc(r.id) + '" data-tip="begeni">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20.5V9.8l4.6-6.3a2 2 0 0 1 3.6 1.4l-.7 4h4.1a2 2 0 0 1 1.9 2.5l-1.6 6.6a2.4 2.4 0 0 1-2.3 1.8z"/><path d="M7 9.8H3.6v10.7H7"/></svg>' +
                '<span>' + Number(r.begeni || 0) + "</span></button>" +
                '<button class="mini-btn forum-vote' + (rVote === "begenmeme" ? " is-dislike" : "") +
                '" type="button" data-rvote="' + esc(r.id) + '" data-tip="begenmeme">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3.5v10.7l-4.6 6.3a2 2 0 0 1-3.6-1.4l.7-4H5.4a2 2 0 0 1-1.9-2.5l1.6-6.6A2.4 2.4 0 0 1 7.4 4.2z"/><path d="M17 14.2h3.4V3.5H17"/></svg>' +
                '<span>' + Number(r.begenmeme || 0) + "</span></button>" +
                (isLoggedIn()
                  ? '<button class="mini-btn" type="button" data-quote="' + esc(r.id) + '">Cevapla</button>' +
                    '<button class="mini-btn" type="button" data-reportreply="' + esc(r.id) + '">Rapor Et</button>'
                  : "") +
                (own
                  ? '<button class="mini-btn" type="button" data-editreply="' + esc(r.id) + '">Düzenle</button>' +
                    '<button class="mini-btn mini-btn--no" type="button" data-delreply="' + esc(r.id) + '">Sil</button>'
                  : "") +
                "</div>" +
                "</div>"
              );
            }).join("")
          : '<div class="forum-empty"><strong>Henüz yanıt yok</strong>İlk yanıtı sen yaz.</div>';

        var compose = row.kilitli
          ? '<div class="forum-gate"><p>Bu konu kilitli. Yeni yanıt eklenemez.</p></div>'
          : isLoggedIn()
            ? '<div class="forum-replyform">' +
              '<textarea class="input" id="replyBody" rows="4" maxlength="4000" placeholder="Yanıtını yaz…"></textarea>' +
              '<div class="forum-replyform__acts">' +
              '<button class="btn btn--primary" type="button" id="replySend">Yanıtla</button>' +
              '<p class="form-status" id="replyStatus" role="status" aria-live="polite"></p>' +
              "</div></div>"
            : '<div class="forum-gate"><p>Yanıt yazmak için giriş yapmalısın.</p>' +
              '<a class="btn btn--primary" href="giris.html">Giriş Yap</a></div>';

        host.innerHTML =
          '<article class="forum-op">' +
          '<div class="forum-op__head">' +
          '<span class="forum-topic__av">' + esc(initials(row.yazar)) + "</span>" +
          "<div><button class=\"forum-reply__who\" type=\"button\" data-author=\"" + esc(row.uye_id) + "\">" +
          esc(row.yazar || "üye") + "</button>" +
          '<div class="forum-reply__when">' + esc(when(row.olusturma)) + " · " +
          esc(catLabel(row.kategori)) + "</div></div>" +
          (row.sabit ? '<span class="forum-tag forum-tag--pin">Sabit</span>' : "") +
          (row.kilitli ? '<span class="forum-tag forum-tag--lock">Kilitli</span>' : "") +
          "</div>" +
          '<h1 class="forum-op__title">' + esc(row.baslik) + "</h1>" +
          '<div class="forum-op__body">' + safeHtml(row.icerik) + "</div>" +
          '<div class="forum-acts">' +
          '<button class="mini-btn forum-vote' + (liked ? " is-like" : "") +
          '" type="button" data-tvote="' + esc(row.id) + '" data-tip="begeni">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20.5V9.8l4.6-6.3a2 2 0 0 1 3.6 1.4l-.7 4h4.1a2 2 0 0 1 1.9 2.5l-1.6 6.6a2.4 2.4 0 0 1-2.3 1.8z"/><path d="M7 9.8H3.6v10.7H7"/></svg>' +
          '<span>' + Number(row.begeni || 0) + "</span></button>" +
          '<button class="mini-btn forum-vote' + (disliked ? " is-dislike" : "") +
          '" type="button" data-tvote="' + esc(row.id) + '" data-tip="begenmeme">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3.5v10.7l-4.6 6.3a2 2 0 0 1-3.6-1.4l.7-4H5.4a2 2 0 0 1-1.9-2.5l1.6-6.6A2.4 2.4 0 0 1 7.4 4.2z"/><path d="M17 14.2h3.4V3.5H17"/></svg>' +
          '<span>' + Number(row.begenmeme || 0) + "</span></button>" +
          '<span class="forum-acts__sep"></span>' +
          (row.uye_id && row.uye_id !== myId
            ? '<button class="mini-btn" type="button" data-follow="' + esc(row.uye_id) + '">' +
              (following.indexOf(row.uye_id) > -1 ? "Takibi Bırak" : "Takip Et") + "</button>"
            : "") +
          (isLoggedIn()
            ? '<button class="mini-btn" type="button" data-report="' + esc(row.id) + '">Rapor Et</button>'
            : "") +
          (editable
            ? '<button class="mini-btn" type="button" id="topicEdit">Düzenle</button>' +
              '<button class="mini-btn mini-btn--no" type="button" id="topicDel">Konuyu Sil</button>'
            : "") +
          "</div>" +
          (expired
            ? '<p class="forum-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 8v4.4M12 15.6v.2"/></svg>' +
              "Konular açıldıktan 3 gün sonra düzenlenemez. Düzeltme için yönetime yaz." +
              "</p>"
            : "") +
          "</article>" +
          '<div class="forum-replies">' + replyHtml + "</div>" +
          compose;

        bindTopicActions(row);
      });
    }).catch(function () {
      host.innerHTML = '<div class="forum-empty"><strong>Konu yüklenemedi</strong>Bağlantını kontrol et.</div>';
    });
  }

  function bindTopicActions(row) {
    var host = el("forumTopicView");

    /* ---------- Konu oyu: beğen / beğenmeme ----------
       Aynı kullanıcı tekrar tekrar oy veremez; oyu değiştirmek için
       önce mevcut oyu silinir, sonra yenisi yazılır. */
    Array.prototype.forEach.call(host.querySelectorAll("[data-tvote]"), function (b) {
      b.addEventListener("click", function () {
        if (!requireLogin()) return;
        var tip = b.getAttribute("data-tip") || "begeni";
        var current = myVoteOn(row.id);
        b.disabled = true;

        var chain = Promise.resolve();

        if (current) {
          var mineVote = likes.filter(function (l) { return l.konu_id === row.id; })[0];
          chain = chain.then(function () {
            return mineVote ? A.deleteRow("forum_begeniler", mineVote.id).catch(function () {}) : null;
          }).then(function () {
            likes = likes.filter(function (l) { return l.konu_id !== row.id; });
          });
        }

        if (current === tip) {
          /* Oy geri alındı */
          chain = chain.then(function () {
            return A.patchRow("forum_konular", row.id, {
              begeni: Math.max(0, Number(row.begeni || 0) - (tip === "begeni" ? 1 : 0)),
              begenmeme: Math.max(0, Number(row.begenmeme || 0) - (tip === "begenmeme" ? 1 : 0))
            });
          }).then(function () { renderTopic(row.id); });
        } else {
          chain = chain.then(function () {
            return A.createRow("forum_begeniler", {
              konu_id: row.id, uye_id: myId, tip: tip, olusturma: Date.now()
            }).then(function (created) {
              likes.push(created);
            }).catch(function () {});
          }).then(function () {
            var delOld = current && current !== tip ? 1 : 0;
            var patch = {};
            patch.begeni = Math.max(0, Number(row.begeni || 0) + (tip === "begeni" ? 1 : 0) - (current === "begeni" && delOld ? 1 : 0));
            patch.begenmeme = Math.max(0, Number(row.begenmeme || 0) + (tip === "begenmeme" ? 1 : 0) - (current === "begenmeme" && delOld ? 1 : 0));
            return A.patchRow("forum_konular", row.id, patch).then(function () { syncTopic(row.id, patch); });
          }).then(function () { renderTopic(row.id); });
        }

        chain.catch(function () { b.disabled = false; });
      });
    });

    /* ---------- Yanıt oyu ----------
       Sayaçlar forum_yorumlar satırına YAZILIR; aksi hâlde arayüzde
       her zaman 0 görünürdü. Aynı kullanıcı yalnızca tek oy taşır:
       oy değiştirilirse önce eski oy silinir. */
    Array.prototype.forEach.call(host.querySelectorAll("[data-rvote]"), function (b) {
      b.addEventListener("click", function () {
        if (!requireLogin()) return;
        var rid = b.getAttribute("data-rvote");
        var tip = b.getAttribute("data-tip") || "begeni";
        var current = myReplyVoteOn(rid);
        b.disabled = true;

        var target = currentReplies.filter(function (r) { return r.id === rid; })[0];
        var baseLike = Number((target && target.begeni) || 0);
        var baseDis = Number((target && target.begenmeme) || 0);

        /* Eski oyun etkisini geri al */
        var nextLike = baseLike - (current === "begeni" ? 1 : 0);
        var nextDis = baseDis - (current === "begenmeme" ? 1 : 0);

        var togglingOff = current === tip;
        if (!togglingOff) {
          if (tip === "begeni") nextLike += 1;
          else nextDis += 1;
        }
        nextLike = Math.max(0, nextLike);
        nextDis = Math.max(0, nextDis);

        var existing = replyVotes.filter(function (v) { return v.yanit_id === rid; })[0];

        Promise.resolve()
          .then(function () {
            if (!existing) return null;
            return A.deleteRow("forum_yanit_begeniler", existing.id).catch(function () {});
          })
          .then(function () {
            replyVotes = replyVotes.filter(function (v) { return v.yanit_id !== rid; });
          })
          .then(function () {
            if (togglingOff) return null;
            return A.createRow("forum_yanit_begeniler", {
              yanit_id: rid, uye_id: myId, tip: tip, olusturma: Date.now()
            }).then(function (created) { replyVotes.push(created); }).catch(function () {});
          })
          .then(function () {
            return A.patchRow("forum_yorumlar", rid, {
              begeni: nextLike,
              begenmeme: nextDis
            });
          })
          .then(function () { renderTopic(row.id); })
          .catch(function () { b.disabled = false; });
      });
    });

    /* ---------- Yanıta cevap (alıntı) ---------- */
    Array.prototype.forEach.call(host.querySelectorAll("[data-quote]"), function (b) {
      b.addEventListener("click", function () {
        var rid = b.getAttribute("data-quote");
        var node = host.querySelector('[data-reply="' + rid + '"]');
        var body = el("replyBody");
        if (!node || !body) return;
        var whoEl = node.querySelector(".forum-reply__who");
        var txtEl = node.querySelector(".forum-reply__body");
        var who = whoEl ? whoEl.textContent.trim() : "üye";
        var quote = txtEl ? txtEl.textContent.trim().slice(0, 300) : "";
        body.value = "> " + who + " yazdı: " + quote + "\n\n" + body.value;
        body.focus();
        body.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });

    /* ---------- Rapor et ---------- */
    Array.prototype.forEach.call(host.querySelectorAll("[data-report]"), function (b) {
      b.addEventListener("click", function () {
        if (!requireLogin()) return;
        reportItem("konu", b.getAttribute("data-report"));
      });
    });

    Array.prototype.forEach.call(host.querySelectorAll("[data-reportreply]"), function (b) {
      b.addEventListener("click", function () {
        if (!requireLogin()) return;
        reportItem("yorum", b.getAttribute("data-reportreply"));
      });
    });

    /* Takip */
    Array.prototype.forEach.call(host.querySelectorAll("[data-follow]"), function (b) {
      b.addEventListener("click", function () { toggleFollow(b.getAttribute("data-follow")); });
    });

    /* Yazar profilini aç */
    Array.prototype.forEach.call(host.querySelectorAll("[data-author]"), function (b) {
      b.addEventListener("click", function () {
        window.location.hash = "profil=" + b.getAttribute("data-author");
      });
    });

    /* Konu düzenle / sil */
    var editBtn = el("topicEdit");
    if (editBtn) {
      editBtn.addEventListener("click", function () { startEditTopic(row); });
    }
    var delBtn = el("topicDel");
    if (delBtn) {
      delBtn.addEventListener("click", function () {
        if (!window.confirm("Bu konu ve tüm yanıtları silinecek. Onaylıyor musun?")) return;
        A.listAll("forum_yorumlar", 500).then(function (all) {
          var mine = all.filter(function (r) { return r.konu_id === row.id; });
          return Promise.all(mine.map(function (r) {
            return A.deleteRow("forum_yorumlar", r.id).catch(function () {});
          }));
        }).then(function () {
          return A.patchRow("forum_konular", row.id, { gizli: true });
        }).then(function () {
          window.location.hash = "";
          loadAll();
        }).catch(function () {});
      });
    }

    /* Yanıt gönder */
    var send = el("replySend");
    if (send) {
      send.addEventListener("click", function () {
        var body = el("replyBody");
        var out = el("replyStatus");
        var text = body ? body.value.trim() : "";
        if (!text) {
          if (out) { out.textContent = "Yanıt boş olamaz."; out.className = "form-status is-error"; }
          return;
        }
        send.disabled = true;

        A.createRow("forum_yorumlar", {
          konu_id: row.id,
          uye_id: myId,
          yazar: myName || "üye",
          icerik: text.slice(0, 4000),
          gizli: false,
          olusturma: Date.now()
        }).then(function () {
          return A.patchRow("forum_konular", row.id, {
            yorum_sayisi: Number(row.yorum_sayisi || 0) + 1,
            son_hareket: Date.now()
          });
        }).then(function () {
          /* Konu sahibine bildirim */
          if (row.uye_id && row.uye_id !== myId) {
            return A.createRow("bildirimler", {
              uye_id: row.uye_id,
              anahtar: "forum:" + row.id + ":" + Date.now(),
              tip: "forum",
              metin: (myName || "Bir üye") + " konuna yanıt yazdı: " + row.baslik,
              okundu: false,
              gizli: false,
              olusturma: Date.now()
            }).catch(function () {});
          }
          return null;
        }).then(function () {
          syncTopic(row.id, {
            yorum_sayisi: Number(row.yorum_sayisi || 0) + 1,
            son_hareket: Date.now()
          });
          renderTopic(row.id);
        }).catch(function () {
          if (out) { out.textContent = "Yanıt gönderilemedi."; out.className = "form-status is-error"; }
          send.disabled = false;
        });
      });
    }

    /* Yanıt düzenle / sil */
    Array.prototype.forEach.call(host.querySelectorAll("[data-editreply]"), function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-editreply");
        var node = host.querySelector('[data-reply="' + id + '"] .forum-reply__body');
        if (!node) return;
        var next = window.prompt("Yanıtı düzenle:", node.textContent);
        if (next == null) return;
        var text = next.trim();
        if (!text) return;
        A.patchRow("forum_yorumlar", id, { icerik: text.slice(0, 4000) })
          .then(function () { renderTopic(row.id); })
          .catch(function () {});
      });
    });

    Array.prototype.forEach.call(host.querySelectorAll("[data-delreply]"), function (b) {
      b.addEventListener("click", function () {
        if (!window.confirm("Bu yanıt silinsin mi?")) return;
        var id = b.getAttribute("data-delreply");
        A.patchRow("forum_yorumlar", id, { gizli: true })
          .then(function () {
            return A.patchRow("forum_konular", row.id, {
              yorum_sayisi: Math.max(0, Number(row.yorum_sayisi || 0) - 1)
            });
          })
          .then(function () { renderTopic(row.id); })
          .catch(function () {});
      });
    });
  }

  function syncTopic(id, patch) {    topics = topics.map(function (t) {
      if (t.id !== id) return t;
      var next = {};
      Object.keys(t).forEach(function (k) { next[k] = t[k]; });
      Object.keys(patch).forEach(function (k) { next[k] = patch[k]; });
      return next;
    });
  }

  /* ---------- Konu düzenleme ---------- */
  function startEditTopic(row) {
    var baslik = window.prompt("Konu başlığı:", row.baslik);
    if (baslik == null) return;
    var icerik = window.prompt("Konu içeriği:", row.icerik);
    if (icerik == null) return;

    var b = baslik.trim();
    var c = icerik.trim();
    if (b.length < 4 || !c) {
      window.alert("Başlık en az 4 karakter olmalı ve içerik boş olamaz.");
      return;
    }

    A.patchRow("forum_konular", row.id, {
      baslik: b.slice(0, 110),
      icerik: c.slice(0, 8000)
    }).then(function () {
      syncTopic(row.id, { baslik: b.slice(0, 110) });
      renderTopic(row.id);
    }).catch(function () {});
  }

  /* ---------- Takip ---------- */
  function toggleFollow(targetId) {
    if (!requireLogin()) return;
    if (!targetId || targetId === myId) return;

    var existing = following.indexOf(targetId) > -1;
    if (existing) {
      A.listAll("forum_takip", 400).then(function (rows) {
        var link = rows.filter(function (f) {
          return f.takip_eden === myId && f.takip_edilen === targetId;
        })[0];
        if (link) return A.deleteRow("forum_takip", link.id);
        return null;
      }).then(function () {
        following = following.filter(function (x) { return x !== targetId; });
        refreshCurrent();
      }).catch(function () {});
    } else {
      A.createRow("forum_takip", {
        takip_eden: myId, takip_edilen: targetId, olusturma: Date.now()
      }).then(function () {
        following.push(targetId);
        refreshCurrent();
      }).catch(function () {});
    }
  }

  function refreshCurrent() {
    var hash = String(window.location.hash || "").replace("#", "");
    if (hash.indexOf("konu=") === 0) renderTopic(hash.slice(5));
    else if (hash.indexOf("profil=") === 0) renderProfile(hash.slice(7));
  }

  /* ---------- Profil görünümü ----------
     Gereken bilgiler: son yanıtlar, toplam konu, toplam yanıt,
     üyelik tarihi, son aktiflik. Sayaçlar `uyeler` alanlarından
     gelir; alan boşsa gerçek kayıtlardan sayılır (uydurma yok).
     Gizlilik: profili gören, üyenin kendi gizlilik tercihine uyar. */

  /* Uzun tarih: 11 Kasım 2027 */
  var AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function longDate(ms) {
    var t = Number(ms || 0);
    if (!t || isNaN(t)) return "—";
    var d = new Date(t);
    if (isNaN(d.getTime())) return "—";
    return d.getDate() + " " + AYLAR[d.getMonth()] + " " + d.getFullYear();
  }

  function renderProfile(userId) {
    var host = el("forumProfilView");
    if (!host) return;
    show("prof");
    host.innerHTML = '<div class="forum-empty"><strong>Yükleniyor…</strong></div>';

    Promise.all([
      A.getRow("uyeler", userId).catch(function () { return null; }),
      /* Kullanıcının yanıtları: son yanıtlar listesi ve gerçek sayı */
      A.listAll("forum_yorumlar", 500).catch(function () { return []; })
    ]).then(function (res) {
      var u = res[0];
      var allReplies = res[1] || [];

      if (!u) {
        host.innerHTML = '<div class="forum-empty"><strong>Üye bulunamadı</strong></div>';
        return;
      }

      var self = userId === myId;
      var isFollowing = following.indexOf(userId) > -1;

      /* --- Konular --- */
      var mine = topics.filter(function (t) { return t.uye_id === userId && !t.gizli; })
        .sort(function (a, b) { return Number(b.olusturma || 0) - Number(a.olusturma || 0); });

      /* --- Yanıtlar (gizli olanlar sayılmaz) --- */
      var myReplies = allReplies.filter(function (r) {
        return r.uye_id === userId && !r.gizli;
      }).sort(function (a, b) { return Number(b.olusturma || 0) - Number(a.olusturma || 0); });

      /* Tabloda tutulan sayaç ile gerçek kayıt sayısı: büyük olan doğrudur.
         Böylece eski kayıtlar da doğru görünür, sayaç sıfırlanmaz. */
      var konuSayisi = Math.max(Number(u.konu_sayisi || 0), mine.length);
      var yanitSayisi = Math.max(Number(u.yorum_sayisi || 0), myReplies.length);

      /* Konu başlıklarını yanıt listesinde göstermek için sözlük */
      var topicTitle = {};
      topics.forEach(function (t) { topicTitle[t.id] = t.baslik; });

      var topicHtml = mine.length
        ? mine.slice(0, 10).map(function (t) {
            return '<button class="forum-profile__topic" type="button" data-topic="' + esc(t.id) + '">' +
              esc(t.baslik) + " · " + esc(catLabel(t.kategori)) + "</button>";
          }).join("")
        : '<div class="forum-profile__empty">Bu üye henüz konu açmamış.</div>';

      var replyHtml = myReplies.length
        ? myReplies.slice(0, 10).map(function (r) {
            var parent = topicTitle[r.konu_id] || "Konu";
            /* Yanıt gövdesi HTML olabilir: etiketleri temizle, kısalt */
            var plain = String(r.icerik == null ? "" : r.icerik)
              .replace(/<[^>]*>/g, " ")
              .replace(/&nbsp;/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            if (plain.length > 140) plain = plain.slice(0, 140) + "…";
            return '<button class="forum-profile__reply" type="button" data-topic="' + esc(r.konu_id) + '">' +
              '<span class="forum-profile__reply-top">' +
              '<span class="forum-profile__reply-title">' + esc(parent) + "</span>" +
              '<span class="forum-profile__reply-when">' + esc(when(r.olusturma)) + "</span>" +
              "</span>" +
              '<span class="forum-profile__reply-text">' + esc(plain || "(boş yanıt)") + "</span>" +
              "</button>";
          }).join("")
        : '<div class="forum-profile__empty">Bu üye henüz yanıt yazmamış.</div>';

      /* --- Üyelik / son aktiflik --- */
      var uyelik = u.olusturma ? longDate(u.olusturma) : "—";
      var sonAktif = u.son_aktif ? when(u.son_aktif) : (self ? "şimdi" : "—");
      if (u.son_aktif && Number(u.son_aktif) > 0) {
        sonAktif = when(u.son_aktif) + " (" + longDate(u.son_aktif) + ")";
      }

      /* Supreme durumu: süresi bitmişse animasyon/ayrıcalık gösterilmez */
      var supreme = typeof A.isSupreme === "function" && A.isSupreme(u);
      var nameHtml = typeof A.kadiHtml === "function"
        ? A.kadiHtml(u.kullanici_adi || "üye", u)
        : esc(u.kullanici_adi || "üye");

      /* Avatar: yüklenmişse gerçek görsel, yoksa baş harfler */
      var avHtml = u.avatar_ref
        ? '<div class="forum-profile__av forum-profile__av--img">' +
          '<img src="' + esc(u.avatar_ref) + '" alt="' + esc(u.kullanici_adi || "üye") + ' avatarı" loading="lazy" /></div>'
        : '<div class="forum-profile__av">' + esc(initials(u.kullanici_adi)) + "</div>";

      host.innerHTML =
        '<div class="forum-profile">' +
        avHtml +
        '<h1 class="forum-profile__name' + (supreme ? " is-supreme" : "") + '">' + nameHtml + "</h1>" +
        '<p class="forum-profile__meta">' +
        "Üyelik: " + esc(uyelik) +
        '<span class="forum-profile__dot">·</span>' +
        "Son aktiflik: " + esc(sonAktif) +
        "</p>" +
        '<div class="forum-profile__stats">' +
        '<div class="forum-profile__stat"><b>' + konuSayisi + "</b><span>Konu</span></div>" +
        '<div class="forum-profile__stat"><b>' + yanitSayisi + "</b><span>Yanıt</span></div>" +
        '<div class="forum-profile__stat"><b>' + Number(u.rep || 0) + "</b><span>İtibar</span></div>" +
        "</div>" +
        (self
          ? ""
          : '<div class="forum-profile__acts">' +
            '<button class="mini-btn" type="button" id="profFollow">' +
            (isFollowing ? "Takibi Bırak" : "Takip Et") + "</button></div>") +
        '<div class="forum-profile__topics"><h3>Son konular</h3>' + topicHtml + "</div>" +
        '<div class="forum-profile__topics"><h3>Son yanıtlar</h3>' + replyHtml + "</div>" +
        "</div>";

      Array.prototype.forEach.call(host.querySelectorAll("[data-topic]"), function (b) {
        b.addEventListener("click", function () {
          window.location.hash = "konu=" + b.getAttribute("data-topic");
        });
      });

      var f = el("profFollow");
      if (f) {
        f.addEventListener("click", function () { toggleFollow(userId); });
      }
    }).catch(function () {
      host.innerHTML = '<div class="forum-empty"><strong>Profil yüklenemedi</strong>Bağlantını kontrol et.</div>';
    });
  }

  /* ---------- Yeni konu ---------- */
  var newForm = el("forumNewForm");
  if (newForm) {
    newForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!requireLogin()) return;

      var out = el("fStatus");
      var submit = el("fSubmit");
      var kat = el("fKategori").value;
      var baslik = el("fBaslik").value.trim();
      var icerik = el("fIcerik").value.trim();

      var ok = true;
      var e1 = el("efBaslik");
      var e2 = el("efIcerik");
      if (e1) { e1.textContent = baslik.length < 4 ? "Başlık en az 4 karakter olmalı." : ""; e1.classList.toggle("is-shown", baslik.length < 4); }
      if (e2) { e2.textContent = icerik.length < 10 ? "İçerik en az 10 karakter olmalı." : ""; e2.classList.toggle("is-shown", icerik.length < 10); }
      ok = baslik.length >= 4 && icerik.length >= 10;

      if (!ok) {
        if (out) { out.textContent = "Lütfen işaretli alanları düzeltin."; out.className = "form-status is-error"; }
        return;
      }

      if (submit) { submit.disabled = true; submit.textContent = "Açılıyor…"; }

      var now = Date.now();
      A.createRow("forum_konular", {
        uye_id: myId,
        yazar: myName || "üye",
        kategori: kat,
        baslik: baslik.slice(0, 110),
        icerik: icerik.slice(0, 8000),
        sabit: false,
        kilitli: false,
        gizli: false,
        begeni: 0,
        yorum_sayisi: 0,
        son_hareket: now,
        olusturma: now
      }).then(function (created) {
        if (out) { out.textContent = "Konu açıldı."; out.className = "form-status is-ok"; }
        el("fBaslik").value = "";
        el("fIcerik").value = "";
        window.location.hash = "konu=" + created.id;
      }).catch(function () {
        if (out) { out.textContent = "Konu açılamadı. Tekrar dene."; out.className = "form-status is-error"; }
      }).then(function () {
        if (submit) { submit.disabled = false; submit.textContent = "Konuyu Aç"; }
      });
    });
  }

  /* ---------- Adım: oturum bilgisi ---------- */
  var myName = null;

  function loadMe() {
    if (!myId) return Promise.resolve();
    return A.getRow("uyeler", myId).then(function (row) {
      if (row) myName = row.kullanici_adi;
    }).catch(function () {});
  }

  function loadLikes() {
    if (!myId) return Promise.resolve();
    return A.listAll("forum_begeniler", 600).then(function (rows) {
      likes = rows.filter(function (l) { return l.uye_id === myId; });
    }).catch(function () {});
  }

  /* Yanıt oylarım */
  function loadReplyVotes() {
    if (!myId) return Promise.resolve();
    return A.listAll("forum_yanit_begeniler", 600).then(function (rows) {
      replyVotes = rows.filter(function (v) { return v.uye_id === myId; });
    }).catch(function () {});
  }

  /* ---------- İçerik raporlama ----------
     Rapor forum_raporlar tablosuna yazılır; yönetim panelinden
     incelenir. Yöneticiye de bildirim düşer. */
  function reportItem(hedefTip, hedefId) {
    if (!hedefId) return;

    var sebep = window.prompt(
      "Rapor sebebi:\n1) Spam / reklam\n2) Hakaret / küfür\n3) Konu dışı\n4) Yasa dışı içerik\n5) Diğer",
      "1"
    );
    if (sebep == null) return;

    var SEBEPLER = {
      "1": "Spam / reklam",
      "2": "Hakaret / küfür",
      "3": "Konu dışı",
      "4": "Yasa dışı içerik",
      "5": "Diğer"
    };
    var kisa = SEBEPLER[String(sebep).trim()] || "Diğer";
    var detay = window.prompt("Kısaca açıkla (isteğe bağlı):", "");
    if (detay == null) detay = "";

    A.createRow("forum_raporlar", {
      hedef_tip: hedefTip,
      hedef_id: hedefId,
      bildiren_id: myId || "",
      bildiren: myName || "üye",
      sebep: kisa,
      detay: String(detay).slice(0, 300),
      durum: "bekliyor",
      olusturma: Date.now()
    }).then(function () {
      window.alert("Raporun yönetime iletildi. Teşekkürler.");
    }).catch(function () {
      window.alert("Rapor gönderilemedi. Lütfen tekrar dene.");
    });
  }

  function loadFollowing() {
    if (!myId) return Promise.resolve();
    return A.listAll("forum_takip", 600).then(function (rows) {
      following = rows.filter(function (f) { return f.takip_eden === myId; })
        .map(function (f) { return f.takip_edilen; });
    }).catch(function () {});
  }

  function loadTopics() {
    return A.listAll("forum_konular", 600).then(function (rows) {
      topics = rows.filter(function (t) { return !t.gizli; });
    }).catch(function () {
      topics = [];
    });
  }

  function loadAll() {
    return Promise.all([loadTopics(), loadLikes(), loadReplyVotes(), loadFollowing()])
      .then(function () {
        paintCats();
        paintTopics();
        show("list");
      });
  }

  /* ---------- Yönlendirme ---------- */
  function route() {
    var hash = String(window.location.hash || "").replace("#", "");
    if (hash.indexOf("konu=") === 0) {
      renderTopic(hash.slice(5));
    } else if (hash.indexOf("profil=") === 0) {
      renderProfile(hash.slice(7));
    } else if (hash === "yeni") {
      if (!isLoggedIn()) { window.location.href = "giris.html"; return; }
      show("newT");
    } else {
      show("list");
    }
  }

  window.addEventListener("hashchange", route);

  /* ---------- Düğmeler ---------- */
  var newBtn = el("forumNewBtn");
  if (newBtn) {
    newBtn.addEventListener("click", function () {
      if (!isLoggedIn()) { window.location.href = "giris.html"; return; }
      window.location.hash = "yeni";
    });
  }

  var backBtn = el("forumBack");
  if (backBtn) {
    backBtn.addEventListener("click", function () {
      window.location.hash = "";
      loadAll();
    });
  }

  var newBack = el("forumNewBack");
  if (newBack) {
    newBack.addEventListener("click", function () {
      window.location.hash = "";
      loadAll();
    });
  }

  var profBack = el("forumProfBack");
  if (profBack) {
    profBack.addEventListener("click", function () {
      window.location.hash = "";
      loadAll();
    });
  }

  var searchInput = el("forumSearch");
  if (searchInput) {
    var timer = null;
    searchInput.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        searchTerm = searchInput.value.trim().toLowerCase();
        paintTopics();
      }, 180);
    });
  }

  /* ---------- Başlat ---------- */
  loadMe()
    .then(loadAll)
    .then(route);
})();
