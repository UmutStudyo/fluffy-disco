/* Avalanche giriş — Supabase Auth + güvenlik kodu */
(function () {
  "use strict";
  var form = document.getElementById("loginForm");
  if (!form) return;
  var URL = "https://auetxclduabnffgbcpnz.supabase.co";
  var KEY = "sb_publishable_l79n4RWY2HbD1Zl1lYtl5w_bPm78zdH";
  var captcha = "";
  var input = document.getElementById("lCaptcha");
  var image = document.getElementById("captchaImg");
  var refresh = document.getElementById("captchaNew");
  var status = document.getElementById("loginStatus");
  var submit = document.getElementById("loginSubmit");
  function el(id) { return document.getElementById(id); }
  function msg(text, kind) {
    if (!status) return;
    status.textContent = text || "";
    status.classList.remove("is-error", "is-ok");
    if (kind) status.classList.add(kind);
  }
  function err(field, target, text) {
    var f = el(field), e = el(target);
    if (f) f.classList.toggle("is-invalid", !!text);
    if (e) { e.textContent = text || ""; e.classList.toggle("is-shown", !!text); }
    return !text;
  }
  function setCaptcha() {
    captcha = (window.AvlAuth && AvlAuth.newCaptcha) ? AvlAuth.newCaptcha() : "";
    if (image) { image.textContent = captcha; image.classList.remove("is-wrong"); }
    if (input) input.value = "";
  }
  setCaptcha();
  if (refresh) refresh.addEventListener("click", function () { setCaptcha(); err("lCaptcha", "eCaptcha", ""); if (input) input.focus(); });
  if (input) input.addEventListener("input", function () { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4); });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    msg("");
    var identity = (el("lKimlik") || {}).value || "";
    var password = (el("lSifre") || {}).value || "";
    var code = input ? input.value.toUpperCase() : "";
    var ok = true;
    ok = err("lKimlik", "eKimlik", identity.trim() ? "" : "Kullanıcı adı veya e-posta girin.") && ok;
    ok = err("lSifre", "eSifre", password ? "" : "Şifrenizi girin.") && ok;
    ok = err("lCaptcha", "eCaptcha", !code ? "Güvenlik kodunu girin." : code !== captcha ? "Güvenlik kodu yanlış." : "") && ok;
    if (!ok) { msg("Lütfen işaretli alanları düzeltin.", "is-error"); return; }
    if (identity.indexOf("@") === -1) {
      err("lKimlik", "eKimlik", "Supabase girişi için e-posta adresinizi yazın.");
      msg("Girişte kayıt olduğunuz e-posta adresini kullanın.", "is-error");
      return;
    }
    if (submit) { submit.disabled = true; submit.textContent = "Giriş yapılıyor…"; }
    fetch(URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": KEY },
      body: JSON.stringify({ email: identity.trim().toLowerCase(), password: password })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var e = new Error(data.msg || data.error_description || data.message || "Giriş başarısız."); e.status = res.status; throw e; }
        return data;
      });
    }).then(function (data) {
      try { localStorage.setItem("supabase_session", JSON.stringify(data)); } catch (_) {}
      msg("Giriş başarılı. Panele yönlendiriliyorsunuz…", "is-ok");
      window.setTimeout(function () { window.location.href = "panel.html"; }, 600);
    }).catch(function (e) {
      setCaptcha();
      if (submit) { submit.disabled = false; submit.textContent = "Giriş Yap"; }
      if (e.status === 400 && /confirm|verified|email/i.test(e.message)) {
        msg("E-posta adresinizi doğruladıktan sonra tekrar giriş yapın.", "is-error");
      } else {
        msg("E-posta veya şifre hatalı. Güvenlik kodu yenilendi.", "is-error");
      }
    });
  });
})();
