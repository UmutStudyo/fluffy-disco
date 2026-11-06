/* Avalanche kayıt — Supabase Auth + güvenlik kodu */
(function () {
  "use strict";
  var A = window.AvlAuth;
  var form = document.getElementById("regForm");
  if (!form || !A) return;

  var SUPABASE_URL = "https://auetxclduabnffgbcpnz.supabase.co";
  var SUPABASE_KEY = "sb_publishable_l79n4RWY2HbD1Zl1lYtl5w_bPm78zdH";
  var step1 = document.getElementById("step1");
  var step2 = document.getElementById("step2");
  var ind1 = document.getElementById("stepInd1");
  var ind2 = document.getElementById("stepInd2");
  var captchaImg = document.getElementById("captchaImg");
  var captchaNew = document.getElementById("captchaNew");
  var captchaInput = document.getElementById("rCaptcha");
  var toStep2 = document.getElementById("toStep2");
  var backStep1 = document.getElementById("backStep1");
  var submitBtn = document.getElementById("regSubmit");
  var s1Status = document.getElementById("s1Status");
  var s2Status = document.getElementById("s2Status");
  var captcha = "";

  function el(id) { return document.getElementById(id); }
  function val(id) { var n = el(id); return n ? n.value.trim() : ""; }
  function status(n, text, kind) {
    if (!n) return;
    n.textContent = text || "";
    n.classList.remove("is-error", "is-ok");
    if (kind) n.classList.add(kind);
  }
  function error(field, target, text) {
    var f = el(field), e = el(target);
    if (f) f.classList.toggle("is-invalid", !!text);
    if (e) { e.textContent = text || ""; e.classList.toggle("is-shown", !!text); }
    return !text;
  }
  function setCaptcha() {
    captcha = A.newCaptcha();
    if (captchaImg) { captchaImg.textContent = captcha; captchaImg.classList.remove("is-wrong"); }
    if (captchaInput) captchaInput.value = "";
  }
  function validate1() {
    var ok = true;
    ok = error("rAd", "eAd", val("rAd") ? "" : "Adınızı girin.") && ok;
    ok = error("rSoyad", "eSoyad", val("rSoyad") ? "" : "Soyadınızı girin.") && ok;
    ok = error("rCinsiyet", "eCinsiyet", val("rCinsiyet") ? "" : "Cinsiyet seçin.") && ok;
    ok = error("rDogum", "eDogum", A.dogumTarihiHatasi(val("rDogum"))) && ok;
    return ok;
  }
  function validate2() {
    var ok = true;
    ok = error("rKadi", "eKadi", A.kullaniciAdiHatasi(val("rKadi"))) && ok;
    ok = error("rEmail", "eEmail", A.emailHatasi(val("rEmail"))) && ok;
    ok = error("rSifre", "eSifre", A.sifreHatasi(val("rSifre"))) && ok;
    var pass2 = val("rSifre2");
    ok = error("rSifre2", "eSifre2", !pass2 ? "Şifreyi tekrar girin." : pass2 !== val("rSifre") ? "Şifreler eşleşmiyor." : "") && ok;
    var capErr = !captchaInput || !captchaInput.value ? "Güvenlik kodunu girin." : captchaInput.value.toUpperCase() !== captcha ? "Güvenlik kodu yanlış." : "";
    ok = error("rCaptcha", "eCaptcha", capErr) && ok;
    var terms = el("rSozlesme");
    var termsErr = terms && terms.checked ? "" : "Sözleşmeleri kabul etmelisiniz.";
    var termsNode = el("eSozlesme");
    if (termsNode) { termsNode.textContent = termsErr; termsNode.classList.toggle("is-shown", !!termsErr); }
    return ok && !termsErr;
  }

  setCaptcha();
  if (captchaNew) captchaNew.addEventListener("click", function () { setCaptcha(); error("rCaptcha", "eCaptcha", ""); if (captchaInput) captchaInput.focus(); });
  if (captchaInput) captchaInput.addEventListener("input", function () { captchaInput.value = captchaInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4); });
  var kadi = el("rKadi");
  if (kadi) kadi.addEventListener("input", function () { kadi.value = kadi.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""); });

  if (toStep2) toStep2.addEventListener("click", function () {
    status(s1Status, "", null);
    if (!validate1()) { status(s1Status, "Lütfen işaretli alanları düzeltin.", "is-error"); return; }
    step1.hidden = true; step2.hidden = false;
    if (ind1) { ind1.classList.remove("is-current"); ind1.classList.add("is-done"); }
    if (ind2) ind2.classList.add("is-current");
    if (kadi) kadi.focus();
    setCaptcha();
  });
  if (backStep1) backStep1.addEventListener("click", function () {
    step2.hidden = true; step1.hidden = false;
    if (ind2) ind2.classList.remove("is-current");
    if (ind1) { ind1.classList.remove("is-done"); ind1.classList.add("is-current"); }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    status(s2Status, "", null);
    if (!validate2()) { status(s2Status, "Lütfen işaretli alanları düzeltin.", "is-error"); return; }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Oluşturuluyor…"; }
    var email = val("rEmail").toLowerCase();
    var password = el("rSifre").value;
    var username = val("rKadi");
    var fullname = (val("rAd") + " " + val("rSoyad")).trim();
    fetch(SUPABASE_URL + "/auth/v1/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
      body: JSON.stringify({ email: email, password: password, data: {
        username: username, fullname: fullname, ad: val("rAd"), soyad: val("rSoyad"),
        cinsiyet: val("rCinsiyet"), dogum_tarihi: val("rDogum"), role: "user"
      }})
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var e = new Error(data.msg || data.error_description || data.message || "Kayıt başarısız."); e.status = res.status; throw e; }
        return data;
      });
    }).then(function (data) {
      setCaptcha();
      if (data.session) {
        status(s2Status, "Hesabınız oluşturuldu. Giriş yapabilirsiniz.", "is-ok");
        window.setTimeout(function () { window.location.href = "giris.html"; }, 900);
      } else {
        status(s2Status, "Hesap oluşturuldu. E-posta adresinizi doğrulayın; giriş sayfasına yönlendiriliyorsunuz…", "is-ok");
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Kayıt tamamlandı"; }
        window.setTimeout(function () { window.location.href = "giris.html?registered=1"; }, 1400);
      }
    }).catch(function (err) {
      setCaptcha();
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Hesabı Oluştur"; }
      var msg = err.status === 422 ? "Bu e-posta adresiyle zaten bir hesap olabilir." : "Kayıt tamamlanamadı. Lütfen bilgileri kontrol edip tekrar deneyin.";
      status(s2Status, msg, "is-error");
    });
  });
})();
