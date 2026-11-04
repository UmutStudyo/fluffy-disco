/* =========================================================
   Avalanche — giris.js
   Giriş: kullanıcı adı VEYA e-posta + şifre + 4 karakter kod.

   Şifre doğrulama akışı:
   • Kullanıcı adından satırı bul, ya da e-postanın SHA-256
     özetinden satırı bul (adres ifşa edilmez).
   • Saklanan tuz ile şifreyi yeniden türet, ilk 32 baytı
     saklanan doğrulayıcıyla sabit zamanlı karşılaştır.
   • Eşleşirse ikinci 32 bayt oturum için AES anahtarıdır.
   ========================================================= */
(function () {
  "use strict";

  var A = window.AvlAuth;
  if (!A) return;

  var form = document.getElementById("loginForm");
  if (!form) return;

  var kimlikInput = document.getElementById("lKimlik");
  var sifreInput = document.getElementById("lSifre");
  var captchaInput = document.getElementById("lCaptcha");
  var captchaImg = document.getElementById("captchaImg");
  var captchaNew = document.getElementById("captchaNew");
  var statusNode = document.getElementById("loginStatus");
  var submitBtn = document.getElementById("loginSubmit");

  var captcha = "";

  function el(id) { return document.getElementById(id); }

  function showErr(fieldId, errId, message) {
    var field = el(fieldId);
    var err = el(errId);
    if (field) field.classList.toggle("is-invalid", !!message);
    if (err) {
      err.textContent = message || "";
      err.classList.toggle("is-shown", !!message);
    }
    return !message;
  }

  function status(message, kind) {
    if (!statusNode) return;
    statusNode.textContent = message || "";
    statusNode.classList.remove("is-error", "is-ok");
    if (kind) statusNode.classList.add(kind);
  }

  function setCaptcha() {
    captcha = A.newCaptcha();
    if (captchaImg) {
      captchaImg.textContent = captcha;
      captchaImg.classList.remove("is-wrong");
    }
    if (captchaInput) captchaInput.value = "";
  }

  setCaptcha();

  if (captchaNew) {
    captchaNew.addEventListener("click", function () {
      setCaptcha();
      showErr("lCaptcha", "eCaptcha", "");
      if (captchaInput) captchaInput.focus();
    });
  }

  if (captchaInput) {
    captchaInput.addEventListener("input", function () {
      captchaInput.value = captchaInput.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4);
    });
  }

  /* Zaten giriş yapılmışsa panele gönder */
  if (A.isLoggedIn()) {
    window.location.replace("panel.html");
    return;
  }

  function fail(message) {
    status(message, "is-error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Giriş Yap";
    }
  }

  /* Kullanıcı adı ya da e-posta ile satırı bul */
  function findUser(kimlik) {
    var raw = String(kimlik || "").trim();
    if (!raw) return Promise.resolve(null);

    /* E-posta biçimindeyse özet üzerinden ara */
    if (raw.indexOf("@") > -1) {
      return A.sha256Hex(raw.toLowerCase()).then(function (hash) {
        return A.byEmailHash(hash);
      });
    }

    return A.byUsername(raw);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    status("", null);

    var kimlik = kimlikInput ? kimlikInput.value.trim() : "";
    var sifre = sifreInput ? sifreInput.value : "";

    var ok = true;
    ok = showErr("lKimlik", "eKimlik", kimlik ? "" : "Kullanıcı adı veya e-posta girin.") && ok;
    ok = showErr("lSifre", "eSifre", sifre ? "" : "Şifrenizi girin.") && ok;

    var codeErr = "";
    if (!captchaInput || !captchaInput.value) codeErr = "Güvenlik kodunu girin.";
    else if (captchaInput.value.toUpperCase() !== captcha)
      codeErr = "Güvenlik kodu yanlış. Yeni kod oluşturuldu.";
    ok = showErr("lCaptcha", "eCaptcha", codeErr) && ok;

    if (!ok) {
      if (captchaInput && captchaInput.value.toUpperCase() !== captcha) {
        setCaptcha();
        if (captchaImg) captchaImg.classList.add("is-wrong");
      }
      status("Lütfen işaretli alanları düzeltin.", "is-error");
      return;
    }

    if (!window.crypto || !window.crypto.subtle) {
      fail("Tarayıcınız güvenli şifreleme (Web Crypto) desteklemiyor.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Kontrol ediliyor…";
    }

    findUser(kimlik)
      .then(function (user) {
        if (!user) {
          var e = new Error("YOK");
          e.code = "YOK";
          throw e;
        }
        if (user.durum === "engelli") {
          var e2 = new Error("ENGELLI");
          e2.code = "ENGELLI";
          throw e2;
        }

        var parts = String(user.sifre_hash || "").split(":");
        if (parts.length !== 2) {
          var e3 = new Error("BOZUK");
          e3.code = "BOZUK";
          throw e3;
        }

        var salt = A.fromB64(parts[0]);
        var verifier = parts[1];

        return A.derive(sifre, salt).then(function (bits) {
          var candidate = A.b64(bits.slice(0, 32));
          if (!A.safeEqual(candidate, verifier)) {
            var e4 = new Error("SIFRE");
            e4.code = "SIFRE";
            throw e4;
          }

          var token = A.hex(A.random(24));
          var aesKey = bits.slice(32, 64);
          return A.patchRow("uyeler", user.id, { oturum_token: token }).then(
            function () {
              A.setSession(user.id, token);
              A.setKey(user.id, aesKey);
              status("Giriş başarılı. Panele yönlendiriliyorsunuz…", "is-ok");
              window.setTimeout(function () {
                window.location.href = "panel.html";
              }, 550);
            }
          );
        });
      })
      .catch(function (err) {
        var code = err && err.code;
        setCaptcha();
        if (captchaImg) captchaImg.classList.add("is-wrong");

        if (code === "YOK") {
          showErr("lKimlik", "eKimlik", "Böyle bir hesap bulunamadı.");
          fail("Kullanıcı adı veya şifre hatalı. Yeni güvenlik kodu oluşturuldu.");
        } else if (code === "SIFRE") {
          showErr("lSifre", "eSifre", "Şifre hatalı.");
          fail("Kullanıcı adı veya şifre hatalı. Yeni güvenlik kodu oluşturuldu.");
        } else if (code === "ENGELLI") {
          fail("Bu hesap askıya alınmış. Yönetime ulaşın.");
        } else if (code === "BOZUK") {
          fail("Hesap verisi okunamadı. Yönetime ulaşın.");
        } else {
          fail(
            "Giriş yapılamadı. Bağlantınızı kontrol edip tekrar deneyin. (" +
              (err && err.message ? err.message : "bilinmeyen hata") +
              ")"
          );
        }
      });
  });
})();
