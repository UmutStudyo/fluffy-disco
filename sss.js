/* =========================================================
   Avalanche — sss.js
   Sıkça Sorulan Sorular accordion davranışı.
   Tek seferde bir soru açık kalır; erişilebilir
   (aria-expanded / hidden / klavye) biçimde çalışır.
   ========================================================= */
(function () {
  "use strict";

  var items = Array.prototype.slice.call(document.querySelectorAll(".faq"));
  if (!items.length) return;

  function closeItem(item) {
    var btn = item.querySelector(".faq__q");
    var panel = item.querySelector(".faq__a");
    if (!btn || !panel) return;
    btn.setAttribute("aria-expanded", "false");
    panel.hidden = true;
    item.classList.remove("is-open");
  }

  function openItem(item) {
    var btn = item.querySelector(".faq__q");
    var panel = item.querySelector(".faq__a");
    if (!btn || !panel) return;
    btn.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    item.classList.add("is-open");
  }

  items.forEach(function (item) {
    var btn = item.querySelector(".faq__q");
    if (!btn) return;

    btn.addEventListener("click", function () {
      var wasOpen = item.classList.contains("is-open");

      /* Diğerlerini kapat (accordion) */
      items.forEach(closeItem);

      if (!wasOpen) openItem(item);
    });
  });

  /* İlk soru açık gelsin ki bölüm boş görünmesin */
  if (items[0]) openItem(items[0]);
})();
