/* =========================================================
   Avalanche — kayit.js
   İki adımlı kayıt akışı, doğrulama ve güvenli kayıt.

   Kişisel veriler AES-GCM ile şifrelenir; anahtar yalnızca
   kullanıcının şifresinden türetilir ve saklanmaz.
   ========================================================= */
(function () {
  "use strict";

  var A = window.AvlAuth;
  if (!A) return;

  var form = document.getElementById("regForm");
  if (!form) return;

  var step1 = document.getElementById("step1");
  var step2 = document.getElementById("step2");
  var ind1 = document.getElementById("stepInd1");
  var ind2 = document.getElementById("stepInd2");
  var toStep2 = document.getElementById("toStep2");
  var backStep1 = document.getElementById("backStep1");
  var s1Status = document.getElementById("s1Status");
  var s2Status = document.getElementById("s2Status");
  var submitBtn = document.getElementById("regSubmit");
  var captchaImg = document.getElementById("captchaImg");
  var captchaNew = document.getElementById("captchaNew");
  var captchaInput = document.getElementById("rCaptcha");

  var captcha = "";

  /* Kayıt sırasında türetilen AES anahtarı; oturum açılınca
     sekmeye özgü sessionStorage'a yazılır (tabloya asla yazılmaz). */
  var pendingKey = null;

  /* ---------- Yardımcılar ---------- */

  function el(id) { return document.getElementById(id); }

  function val(id) {
    var node = el(id);
    return node ? node.value.trim() : "";
  }

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

  function status(node, message, kind) {
    if (!node) return;
    node.textContent = message || "";
    node.classList.remove("is-error", "is-ok");
    if (kind) node.classList.add(kind);
  }

  function fullName() {
    return (val("rAd") + " " + val("rSoyad")).trim();
  }

  function setCaptcha() {
    captcha = A.newCaptcha();
    if (captchaImg) {
      captchaImg.textContent = captcha;
      captchaImg.classList.remove("is-wrong");
    }
    if (captchaInput) captchaInput.value = "";
  }

  /* ---------- Captcha ---------- */

  setCaptcha();

  if (captchaNew) {
    captchaNew.addEventListener("click", function () {
      setCaptcha();
      showErr("rCaptcha", "eCaptcha", "");
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

  /* ---------- 1. adım ---------- */

  function validateStep1() {
    var ok = true;

    ok = showErr("rAd", "eAd", val("rAd") ? "" : "Adınızı girin.") && ok;
    ok = showErr("rSoyad", "eSoyad", val("rSoyad") ? "" : "Soyadınızı girin.") && ok;
    ok = showErr("rCinsiyet", "eCinsiyet", val("rCinsiyet") ? "" : "Cinsiyet seçin.") && ok;
    ok = showErr("rDogum", "eDogum", A.dogumTarihiHatasi(val("rDogum"))) && ok;

    return ok;
  }

  if (toStep2) {
    toStep2.addEventListener("click", function () {
      status(s1Status, "", null);
      if (!validateStep1()) {
        status(s1Status, "Lütfen işaretli alanları düzeltin.", "is-error");
        var first = step1.querySelector(".is-invalid");
        if (first) first.focus();
        return;
      }
      step1.hidden = true;
      step2.hidden = false;
      ind1.classList.remove("is-current");
      ind1.classList.add("is-done");
      ind2.classList.add("is-current");
      var kadi = el("rKadi");
      if (kadi) kadi.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (backStep1) {
    backStep1.addEventListener("click", function () {
      step2.hidden = true;
      step1.hidden = false;
      ind2.classList.remove("is-current");
      ind1.classList.remove("is-done");
      ind1.classList.add("is-current");
      status(s2Status, "", null);
    });
  }

  /* Live: kullanıcı adı temizliği */
  var kadiInput = el("rKadi");
  if (kadiInput) {
    kadiInput.addEventListener("input", function () {
      var cleaned = kadiInput.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (cleaned !== kadiInput.value) kadiInput.value = cleaned;
    });
  }

  /* ---------- 2. adım doğrulama ---------- */

  function validateStep2() {
    var ok = true;

    var kadiErr = A.kullaniciAdiHatasi(val("rKadi"));
    ok = showErr("rKadi", "eKadi", kadiErr) && ok;

    var emailErr = A.emailHatasi(val("rEmail"));
    ok = showErr("rEmail", "eEmail", emailErr) && ok;

    var sifreErr = A.sifreHatasi(val("rSifre"));
    ok = showErr("rSifre", "eSifre", sifreErr) && ok;

    var s2 = val("rSifre2");
    var matchErr = "";
    if (!s2) matchErr = "Şifreyi tekrar girin.";
    else if (s2 !== val("rSifre")) matchErr = "Şifreler birbiriyle eşleşmiyor.";
    ok = showErr("rSifre2", "eSifre2", matchErr) && ok;

    var codeErr = "";
    if (!captchaInput || !captchaInput.value) codeErr = "Güvenlik kodunu girin.";
    else if (captchaInput.value.toUpperCase() !== captcha)
      codeErr = "Güvenlik kodu yanlış. Yeni kod oluşturuldu.";
    ok = showErr("rCaptcha", "eCaptcha", codeErr) && ok;

    var soz = el("rSozlesme");
    var sozErr = soz && soz.checked ? "" : "Sözleşmeleri kabul etmelisiniz.";
    var sozNode = el("eSozlesme");
    if (sozNode) {
      sozNode.textContent = sozErr;
      sozNode.classList.toggle("is-shown", !!sozErr);
    }
    ok = ok && !sozErr;

    return ok;
  }

  /* ---------- Kayıt ---------- */

  function pbkdfB64(salt, verifier) {
    return A.b64(salt) + ":" + A.b64(verifier);
  }

  function saveError(message) {
    status(s2Status, message, "is-error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Hesabı Oluştur";
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    status(s2Status, "", null);

    if (!validateStep2()) {
      if (captchaInput && captchaInput.value.toUpperCase() !== captcha) {
        setCaptcha();
        if (captchaImg) captchaImg.classList.add("is-wrong");
      }
      status(s2Status, "Lütfen işaretli alanları düzeltin.", "is-error");
      var firstBad = step2.querySelector(".is-invalid");
      if (firstBad) firstBad.focus();
      return;
    }

    if (!window.crypto || !window.crypto.subtle) {
      saveError(
        "Tarayıcınız güvenli şifreleme (Web Crypto) desteklemiyor. Lütfen güncel bir tarayıcı kullanın."
      );
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Oluşturuluyor…";
    }

    var kadi = val("rKadi");
    var email = val("rEmail").toLowerCase();
    var sifre = el("rSifre").value;

    var profile = {
      ad: val("rAd"),
      soyad: val("rSoyad"),
      cinsiyet: val("rCinsiyet"),
      dogum_tarihi: val("rDogum"),
      email: email
    };

    /* 1) Kullanıcı adı ve e-posta daha önce alınmış mı? */
    A.byUsername(kadi)
      .then(function (existing) {
        if (existing) {
          var e1 = new Error("BUKADI");
          e1.code = "BUKADI";
          throw e1;
        }
        return A.sha256Hex(email);
      })
      .then(function (emailHash) {
        return A.byEmailHash(emailHash).then(function (existing) {
          if (existing) {
            var e2 = new Error("BUEMAIL");
            e2.code = "BUEMAIL";
            throw e2;
          }
          return emailHash;
        });
      })
      .then(function (emailHash) {
        /* 2) Anahtar türet (salt her kullanıcıya özel) */
        var salt = A.random(16);
        return A.derive(sifre, salt).then(function (bits) {
          var verifier = bits.slice(0, 32);
          var aesKey = bits.slice(32, 64);
          pendingKey = aesKey;

          /* 3) Kişisel verileri ALAN BAZINDA şifrele
             (panel her alanı ayrı çözer) */
          return A.encryptFields(profile, aesKey).then(function (cipher) {
            var row = {
              ad: cipher.ad,
              soyad: cipher.soyad,
              cinsiyet: cipher.cinsiyet,
              dogum_tarihi: cipher.dogum_tarihi,
              email: cipher.email,
              email_hash: emailHash,
              kullanici_adi: kadi,
              sifre_hash: pbkdfB64(salt, verifier),
              kredi: 0,
              avatar_ref: "",
              avatar_turu: "",
              supreme_bitis: "",
              konu_sayisi: 0,
              yorum_sayisi: 0,
              mesaj_sayisi: 0,
              son_gunluk_kredi: "",
              durum: "aktif",
              rol: "uye",
              olusturma: Date.now()
            };
            return A.createRow("uyeler", row);
          });
        });
      })
      .then(function (created) {
        var id = created && (created.id || created._id);
        if (!id) throw new Error("KAYITYOK");

        /* Oturum belirteci */
        var token = A.hex(A.random(24));

        return A.patchRow("uyeler", id, { oturum_token: token }).then(
          function () {
            A.setSession(id, token);
            if (pendingKey) A.setKey(id, pendingKey);
            status(s2Status, "Hesabınız oluşturuldu. Panele yönlendiriliyorsunuz…", "is-ok");
            window.setTimeout(function () {
              window.location.href = "panel.html";
            }, 750);
          }
        );
      })
      .catch(function (err) {
        var code = err && err.code;
        if (code === "BUKADI") {
          showErr("rKadi", "eKadi", "Bu kullanıcı adı zaten alınmış. Başka bir ad deneyin.");
          setCaptcha();
          saveError("Kullanıcı adı kullanımda.");
        } else if (code === "BUEMAIL") {
          showErr("rEmail", "eEmail", "Bu e-posta adresiyle zaten bir hesap var.");
          setCaptcha();
          saveError("E-posta adresi kullanımda.");
        } else {
          setCaptcha();
          saveError(
            "Kayıt tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin. (" +
              (err && err.message ? err.message : "bilinmeyen hata") +
              ")"
          );
        }
      });
  });

  /* Girilen değer değişince hatayı temizle */
  ["rAd", "rSoyad", "rCinsiyet", "rDogum"].forEach(function (id) {
    var node = el(id);
    if (!node) return;
    node.addEventListener("input", function () {
      showErr(id, "e" + id.slice(1), "");
    });
    node.addEventListener("change", function () {
      showErr(id, "e" + id.slice(1), "");
    });
  });
})();
