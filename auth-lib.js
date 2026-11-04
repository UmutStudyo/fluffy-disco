/* =========================================================
   Avalanche — auth-lib.js
   Üyelik altyapısı: kripto, doğrulama, tablo erişimi, oturum.

   GÜVENLİK MODELİ (dürüst özet — ayrıntısı README.md'de):
   • Şifre asla düz metin saklanmaz. PBKDF2-SHA256, 210.000 tur,
     kullanıcıya özel 16 baytlık tuz ile türetilir.
   • Türetilen 64 baytın ilk 32 baytı "doğrulayıcı" olarak saklanır
     (giriş kontrolü için), ikinci 32 baytı AES-GCM anahtarıdır ve
     HİÇBİR YERE yazılmaz.
   • Ad, soyad, e-posta, cinsiyet, doğum tarihi AES-GCM ile şifrelenir.
     Tablo herkese açık okunabilse bile bu alanlar şifreli metindir;
     anahtar yalnızca kullanıcının şifresinden türetilebilir.
   • E-posta ile giriş için e-postanın SHA-256 özeti (email_hash) tutulur;
     bu, adresi ifşa etmeden arama yapmayı sağlar.

   SINIR: Bu proje statik bir sitedir; platformda çalıştırılabilir bir
   sunucu yoktur. Bu yüzden oturum ve yetki kontrolü uygulama düzeyinde
   kalır, sunucu tarafından zorlanmaz. Prototip niteliğindedir.
   ========================================================= */
(function (global) {
  "use strict";

  var ITER = 210000;
  var SESSION_KEY = "avl_oturum";
  var enc = new TextEncoder();

  function toBytes(x) { return x instanceof Uint8Array ? x : new Uint8Array(x); }

  function subtle() {
    return global.crypto && global.crypto.subtle ? global.crypto.subtle : null;
  }

  /* ---------- Kodlama yardımcıları ---------- */

  function b64(bytes) {
    var b = toBytes(bytes), s = "", i;
    for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }

  function fromB64(str) {
    var bin = atob(str), out = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function hex(bytes) {
    var b = toBytes(bytes), s = "", i;
    for (i = 0; i < b.length; i++) s += ("0" + b[i].toString(16)).slice(-2);
    return s;
  }

  function random(n) {
    return global.crypto.getRandomValues(new Uint8Array(n));
  }

  /* ---------- Kripto ---------- */

  /* Şifre + tuz -> 64 bayt (32 doğrulayıcı | 32 AES anahtarı) */
  function derive(password, saltBytes) {
    return subtle()
      .importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
      .then(function (base) {
        return subtle().deriveBits(
          { name: "PBKDF2", salt: saltBytes, iterations: ITER, hash: "SHA-256" },
          base,
          512
        );
      })
      .then(toBytes);
  }

  function aesKey(raw) {
    return subtle().importKey("raw", raw, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt"
    ]);
  }

  function encryptJSON(obj, keyBytes) {
    var iv = random(12);
    return aesKey(keyBytes)
      .then(function (k) {
        return subtle().encrypt(
          { name: "AES-GCM", iv: iv },
          k,
          enc.encode(JSON.stringify(obj))
        );
      })
      .then(function (ct) {
        return b64(iv) + "." + b64(new Uint8Array(ct));
      });
  }

  function decryptJSON(payload, keyBytes) {
    var parts = String(payload || "").split(".");
    if (parts.length !== 2) return Promise.reject(new Error("bozuk veri"));
    return aesKey(keyBytes)
      .then(function (k) {
        return subtle().decrypt(
          { name: "AES-GCM", iv: fromB64(parts[0]) },
          k,
          fromB64(parts[1])
        );
      })
      .then(function (buf) {
        return JSON.parse(new TextDecoder().decode(buf));
      });
  }

  function sha256Hex(text) {
    return subtle()
      .digest("SHA-256", enc.encode(text))
      .then(function (d) { return hex(toBytes(d)); });
  }

  /* Sabit zamanlı karşılaştırma (zamanlama sızıntısını azaltır) */
  function safeEqual(a, b) {
    var x = String(a || ""), y = String(b || "");
    if (x.length !== y.length) return false;
    var diff = 0, i;
    for (i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return diff === 0;
  }

  /* ---------- Doğrulama ---------- */

  var KULLANICI_RE = /^[a-z0-9_-]{4,14}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

  function kullaniciAdiHatasi(v) {
    if (!v) return "Kullanıcı adı gerekli.";
    if (/[A-ZÇĞİÖŞÜ]/.test(v)) return "Kullanıcı adı büyük harf içeremez.";
    if (/\s/.test(v)) return "Kullanıcı adı boşluk içeremez.";
    if (/[^a-z0-9_-]/.test(v))
      return "Yalnızca küçük harf, rakam, _ ve - kullanılabilir.";
    if (v.length < 4) return "Kullanıcı adı en az 4 karakter olmalı.";
    if (v.length > 14) return "Kullanıcı adı en fazla 14 karakter olabilir.";
    if (!KULLANICI_RE.test(v)) return "Kullanıcı adı geçersiz.";
    return "";
  }

  function sifreHatasi(v) {
    if (!v) return "Şifre gerekli.";
    if (v.length < 6) return "Şifre en az 6 karakter olmalı.";
    if (v.length > 16) return "Şifre en fazla 16 karakter olabilir.";
    if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(v)) return "Şifre en az bir harf içermeli.";
    return "";
  }

  function emailHatasi(v) {
    if (!v) return "E-posta adresi gerekli.";
    if (!EMAIL_RE.test(v)) return "Geçerli bir e-posta adresi girin.";
    return "";
  }

  /* Yaş kontrolü: en az 10 yaşında olmalı */
  function dogumTarihiHatasi(v) {
    if (!v) return "Doğum tarihi gerekli.";
    var d = new Date(v + "T00:00:00");
    if (isNaN(d.getTime())) return "Geçerli bir tarih girin.";
    var now = new Date();
    if (d > now) return "Doğum tarihi gelecekte olamaz.";
    var yas = (now - d) / (365.25 * 24 * 3600 * 1000);
    if (yas < 10) return "En az 10 yaşında olmalısınız.";
    if (yas > 120) return "Lütfen geçerli bir tarih girin.";
    return "";
  }

  /* ---------- Tarih ---------- */

  /* Türkiye saatine göre YYYY-AA-GG */
  function todayKey() {
    try {
      var f = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      return f.format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  /* ---------- Tablo API ---------- */

  function api(path, options) {
    var opts = options || {};
    var headers = opts.headers || {};
    if (opts.body && typeof opts.body !== "string") {
      opts.body = JSON.stringify(opts.body);
      headers["Content-Type"] = "application/json";
    }
    opts.headers = headers;

    return fetch("tables/" + path, opts).then(function (res) {
      if (!res.ok) {
        return res
          .text()
          .catch(function () { return ""; })
          .then(function (t) {
            var err = new Error("İstek başarısız (" + res.status + ")");
            err.status = res.status;
            err.detail = t;
            throw err;
          });
      }
      if (res.status === 204) return null;
      return res.json();
    });
  }

  /* Tabloyu sayfa sayfa oku (en fazla `cap` kayıt) */
  function listAll(table, cap) {
    var limit = 100;
    var max = cap || 500;
    var out = [];

    function page(n) {
      return api(table + "?limit=" + limit + "&page=" + n).then(function (res) {
        var rows = (res && res.data) || [];
        out = out.concat(rows);
        if (rows.length < limit || out.length >= max) return out.slice(0, max);
        return page(n + 1);
      });
    }

    return page(1);
  }

  function getRow(table, id) {
    return api(table + "/" + encodeURIComponent(id)).catch(function (err) {
      if (err.status === 404) return null;
      throw err;
    });
  }

  function createRow(table, data) {
    return api(table, { method: "POST", body: data });
  }

  function patchRow(table, id, data) {
    return api(table + "/" + encodeURIComponent(id), {
      method: "PATCH",
      body: data
    });
  }

  function deleteRow(table, id) {
    return api(table + "/" + encodeURIComponent(id), { method: "DELETE" });
  }

  /* ---------- Alan bazlı şifreleme ----------
     Her alan kendi IV'si ile ayrı ayrı şifrelenir. Böylece
     tablo satırı tek tek dökülse bile alanlar bağımsız korunur. */
  function encryptFields(obj, keyBytes) {
    var keys = Object.keys(obj);
    return Promise.all(
      keys.map(function (k) {
        return encryptJSON({ v: obj[k] }, keyBytes).then(function (c) {
          return { k: k, c: c };
        });
      })
    ).then(function (pairs) {
      var out = {};
      pairs.forEach(function (p) { out[p.k] = p.c; });
      return out;
    });
  }

  function decryptFields(row, fields, keyBytes) {
    return Promise.all(
      fields.map(function (f) {
        var raw = row[f];
        if (!raw || String(raw).indexOf(".") === -1) {
          return { f: f, v: "" };
        }
        return decryptJSON(raw, keyBytes)
          .then(function (o) { return { f: f, v: o && "v" in o ? o.v : "" }; })
          .catch(function () { return { f: f, v: "" }; });
      })
    ).then(function (pairs) {
      var out = {};
      pairs.forEach(function (p) { out[p.f] = p.v; });
      return out;
    });
  }

  /* ---------- Oturum anahtarı ----------
     AES anahtarı yalnızca sekmeye özgü sessionStorage'da tutulur;
     sekme kapanınca silinir, sunucuya/tabloya yazılmaz. */
  var KEY_NAME = "avl_anahtar";

  function setKey(userId, keyBytes) {
    try {
      global.sessionStorage.setItem(
        KEY_NAME,
        JSON.stringify({ id: userId, k: b64(keyBytes) })
      );
    } catch (e) { /* yoksay */ }
  }

  function getKey(userId) {
    try {
      var raw = global.sessionStorage.getItem(KEY_NAME);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || o.id !== userId || !o.k) return null;
      return fromB64(o.k);
    } catch (e) {
      return null;
    }
  }

  function clearKey() {
    try {
      global.sessionStorage.removeItem(KEY_NAME);
    } catch (e) { /* yoksay */ }
  }

  /* ---------- Kullanıcı arama ---------- */

  function byUsername(name) {
    var target = String(name || "").toLowerCase().trim();
    if (!target) return Promise.resolve(null);

    /* Sunucu tarafı arama: tüm tablo indirilmez */
    return api("uyeler?search=" + encodeURIComponent(target) + "&limit=50")
      .then(function (res) {
        var rows = (res && res.data) || [];
        return (
          rows.filter(function (r) {
            return String(r.kullanici_adi || "").toLowerCase() === target;
          })[0] || null
        );
      })
      .catch(function () { return null; });
  }

  /* E-posta özetiyle arama (özet benzersizdir) */
  function byEmailHash(hash) {
    if (!hash) return Promise.resolve(null);
    return api("uyeler?search=" + encodeURIComponent(hash) + "&limit=50")
      .then(function (res) {
        var rows = (res && res.data) || [];
        return rows.filter(function (r) { return r.email_hash === hash; })[0] || null;
      })
      .catch(function () { return null; });
  }

  /* ---------- Sınırlı üye sorguları ----------
     Tüm üye tablosunu tarayıcıya indirmek mahremiyet ihlalidir.
     Bu yardımcılar yalnızca gereken kayıtları getirir. */

  /* Kullanıcı adıyla arama (sunucu tarafı search + kesin eşleşme) */
  function searchUsers(q, limit) {
    var term = String(q || "").trim().toLowerCase();
    if (!term) return Promise.resolve([]);

    return api("uyeler?search=" + encodeURIComponent(term) + "&limit=" + (limit || 12))
      .then(function (res) {
        var rows = (res && res.data) || [];
        return rows.filter(function (r) {
          return String(r.kullanici_adi || "").toLowerCase().indexOf(term) > -1;
        });
      })
      .catch(function () { return []; });
  }

  /* Verilen id'ler için kayıt çöz (önbelleğe yazar) */
  function resolveUsers(ids, cache) {
    var store = cache || {};
    var unique = [];
    ids.forEach(function (id) {
      if (!id || store[id] || unique.indexOf(id) > -1) return;
      unique.push(id);
    });

    return Promise.all(
      unique.slice(0, 60).map(function (id) {
        return getRow("uyeler", id)
          .then(function (row) {
            if (row && row.id) store[row.id] = row;
            else store[id] = { id: id, kullanici_adi: "bilinmeyen" };
          })
          .catch(function () {
            store[id] = { id: id, kullanici_adi: "bilinmeyen" };
          });
      })
    ).then(function () { return store; });
  }

  /* ---------- Oturum ---------- */

  function getSession() {
    try {
      var raw = global.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return s && s.id && s.token ? s : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(id, token) {
    try {
      global.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ id: id, token: token })
      );
    } catch (e) { /* depolama kapalı */ }
  }

  function clearSession() {
    try {
      global.localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* yoksay */ }
  }

  function isLoggedIn() {
    return !!getSession();
  }

  /* ---------- Captcha (4 karakter, harf + rakam) ---------- */

  var CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function newCaptcha() {
    var bytes = random(4), out = "", i;
    for (i = 0; i < 4; i++) out += CAPTCHA_CHARS[bytes[i] % CAPTCHA_CHARS.length];
    return out;
  }

  /* ---------- Kullanıcı adı görünümü ----------
     Renk/gradyan seçimi `uyeler.kadi_stil` alanında tutulur (c1–c8, g1–g8).
     Supreme üyeliği aktifse animasyonlu gradyan sınıfı eklenir; süre
     bittiğinde yalnızca seçili renk kalır, animasyon kalkar. */
  var KADI_STIL_RE = /^[cg][1-8]$/;

  function isSupreme(u) {
    var v = u && u.supreme_bitis;
    if (!v) return false;
    if (String(v) === "sinirsiz") return true;
    var d = new Date(String(v) + "T23:59:59");
    return !isNaN(d.getTime()) && d.getTime() > Date.now();
  }

  function kadiClass(u) {
    var out = [];
    var st = String((u && u.kadi_stil) || "");
    if (KADI_STIL_RE.test(st)) out.push("kadi-" + st);
    if (isSupreme(u)) out.push("supreme-name");
    return out.join(" ");
  }

  /* Adı renkli sarmalayıcı ile döndürür (HTML kaçışlı) */
  function kadiHtml(name, u) {
    var safe = String(name == null ? "" : name)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    var cls = kadiClass(u);
    return cls ? '<span class="' + cls + '">' + safe + "</span>" : safe;
  }

  /* ---------- Dışa aktarım ---------- */

  global.AvlAuth = {
    ITER: ITER,
    derive: derive,
    encryptJSON: encryptJSON,
    decryptJSON: decryptJSON,
    encryptFields: encryptFields,
    decryptFields: decryptFields,
    setKey: setKey,
    getKey: getKey,
    clearKey: clearKey,
    sha256Hex: sha256Hex,
    safeEqual: safeEqual,
    b64: b64,
    fromB64: fromB64,
    hex: hex,
    random: random,
    todayKey: todayKey,
    kullaniciAdiHatasi: kullaniciAdiHatasi,
    sifreHatasi: sifreHatasi,
    emailHatasi: emailHatasi,
    dogumTarihiHatasi: dogumTarihiHatasi,
    api: api,
    listAll: listAll,
    getRow: getRow,
    createRow: createRow,
    patchRow: patchRow,
    deleteRow: deleteRow,
    byUsername: byUsername,
    byEmailHash: byEmailHash,
    searchUsers: searchUsers,
    resolveUsers: resolveUsers,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn,
    newCaptcha: newCaptcha,
    isSupreme: isSupreme,
    kadiClass: kadiClass,
    kadiHtml: kadiHtml
  };
})(window);
