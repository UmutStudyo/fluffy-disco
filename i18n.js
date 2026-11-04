/* =========================================================
   Avalanche — i18n.js
   Türkçe / English dil sistemi.

   Kullanım:
     <html lang="tr">               → aktif dil
     <span data-i18n="nav.home">    → metin değiştirir
     <input data-i18n-ph="x">       → placeholder değiştirir
     <title data-i18n-title="x">    → sayfa başlığı

   Tercih localStorage["avl_lang"] içinde saklanır.
   Sayfa yüklenirken <head>'deki küçük script dili uygular (flash yok).
   ========================================================= */
(function (global) {
  "use strict";

  var KEY = "avl_lang";
  var DEFAULT = "tr";
  var current = DEFAULT;

  var DICT = {
    /* ---------------- Genel ---------------- */
    "brand.home": { tr: "Avalanche ana sayfa", en: "Avalanche home" },
    "lang.label": { tr: "Dil", en: "Language" },
    "lang.tr": { tr: "Türkçe", en: "Turkish" },
    "lang.en": { tr: "English", en: "English" },
    "social.instagram": { tr: "Instagram — @avlclancomtr", en: "Instagram — @avlclancomtr" },
    "social.telegram": { tr: "Telegram — @umutzio", en: "Telegram — @umutzio" },
    "social.ixbir": { tr: "ixbir.net — altyapı ortağı", en: "ixbir.net — infrastructure partner" },
    "skip": { tr: "İçeriğe geç", en: "Skip to content" },

    /* ---------------- Menü ---------------- */
    "nav.home": { tr: "Ana Sayfa", en: "Home" },
    "nav.prices": { tr: "Fiyatlar", en: "Pricing" },
    "nav.management": { tr: "Yönetim", en: "Management" },
    "nav.about": { tr: "Hakkımızda", en: "About" },
    "nav.contact": { tr: "İletişim", en: "Contact" },
    "nav.forum": { tr: "Forum", en: "Forum" },
    "nav.who": { tr: "Biz Kimiz?", en: "Who We Are" },
    "nav.terms": { tr: "Kullanıcı Sözleşmesi", en: "User Agreement" },
    "nav.product": { tr: "Ürün Sözleşmesi", en: "Product Agreement" },
    "nav.privacy": { tr: "Gizlilik Politikası", en: "Privacy Policy" },
    "nav.kvkk": { tr: "KVKK Aydınlatma Metni", en: "GDPR Disclosure" },
    "nav.faq": { tr: "Sıkça Sorulan Sorular", en: "Frequently Asked Questions" },
    "nav.main": { tr: "Ana menü", en: "Main menu" },
    "nav.submenu.open": { tr: "Hakkımızda alt menüsünü aç", en: "Open About submenu" },
    "nav.submenu.close": { tr: "Hakkımızda alt menüsünü kapat", en: "Close About submenu" },
    "nav.menu.open": { tr: "Menüyü aç", en: "Open menu" },
    "nav.menu.close": { tr: "Menüyü kapat", en: "Close menu" },
    "social.aria": { tr: "Sosyal medya", en: "Social media" },

    /* ---------------- Üst menü sağ ---------------- */
    "theme.toLight": { tr: "Aydınlık moda geç", en: "Switch to light mode" },
    "theme.toDark": { tr: "Karanlık moda geç", en: "Switch to dark mode" },
    "theme.light": { tr: "Aydınlık mod", en: "Light mode" },
    "theme.dark": { tr: "Karanlık mod", en: "Dark mode" },
    "account.signup": { tr: "Hesap Aç", en: "Sign Up" },
    "account.profile": { tr: "Profilim", en: "My Profile" },
    "admin.panel": { tr: "Yönetici paneli", en: "Admin panel" },

    /* ---------------- Durum ---------------- */
    "status.label": { tr: "Yönetici durumu", en: "Admin status" },
    "status.title": { tr: "Yönetici Durumu", en: "Admin Status" },
    "status.loading": { tr: "Yükleniyor…", en: "Loading…" },
    "status.available": { tr: "Müsait", en: "Available" },
    "status.busy": { tr: "Yoğun", en: "Busy" },
    "status.occupied": { tr: "Meşgul", en: "Unavailable" },
    "status.foot": { tr: "Türkiye saati · GMT+3", en: "Türkiye time · GMT+3" },

    /* ---------------- Alt bilgi ---------------- */
    "footer.pages": { tr: "Sayfalar", en: "Pages" },
    "footer.server": { tr: "Sunucu", en: "Server" },
    "footer.community": { tr: "Topluluk", en: "Community" },
    "footer.permissions": { tr: "Yetki Paketleri", en: "Permission Packages" },
    "footer.rights": { tr: "© 2027 Avalanche. Tüm hakları saklıdır.", en: "© 2027 Avalanche. All rights reserved." },
    "footer.tag": { tr: "CS 1.6 Klanı", en: "CS 1.6 Clan" },
    "footer.about": {
      tr: "Avalanche, CS 1.6 oyuncularını bir araya getiren bir oyun klanıdır. Oyun sunucusu ve TeamSpeak3 topluluğu ile aktif bir ortam sunar.",
      en: "Avalanche is a gaming clan that brings CS 1.6 players together, with an active community around its game server and TeamSpeak3."
    },

    /* ---------------- Kayıt / Giriş ---------------- */
    "auth.signup.title": { tr: "Hesap Aç", en: "Create Account" },
    "auth.signup.sub": {
      tr: "Avalanche topluluğuna katıl. İki adımda tamamlanır.",
      en: "Join the Avalanche community. Completed in two steps."
    },
    "auth.step1": { tr: "Kişisel", en: "Personal" },
    "auth.step2": { tr: "Hesap", en: "Account" },
    "auth.first": { tr: "Ad", en: "First name" },
    "auth.last": { tr: "Soyad", en: "Last name" },
    "auth.gender": { tr: "Cinsiyet", en: "Gender" },
    "auth.birth": { tr: "Doğum Tarihi", en: "Date of Birth" },
    "auth.select": { tr: "Seçiniz", en: "Select" },
    "auth.male": { tr: "Erkek", en: "Male" },
    "auth.female": { tr: "Kadın", en: "Female" },
    "auth.nosay": { tr: "Belirtmek istemiyorum", en: "Prefer not to say" },
    "auth.birthHint": { tr: "En az 10 yaşında olmalısınız.", en: "You must be at least 10 years old." },
    "auth.continue": { tr: "Devam Et", en: "Continue" },
    "auth.username": { tr: "Kullanıcı Adı", en: "Username" },
    "auth.usernameHint": {
      tr: "4–14 karakter · yalnızca küçük harf, rakam, _ ve -",
      en: "4–14 characters · lowercase letters, digits, _ and - only"
    },
    "auth.email": { tr: "E-posta Adresi", en: "Email Address" },
    "auth.password": { tr: "Şifre", en: "Password" },
    "auth.password2": { tr: "Tekrar Şifre", en: "Confirm Password" },
    "auth.passwordHint": {
      tr: "6–16 karakter, en az bir harf içermeli.",
      en: "6–16 characters, must contain at least one letter."
    },
    "auth.captcha": { tr: "Güvenlik Doğrulaması", en: "Security Verification" },
    "auth.captchaPh": { tr: "Kodu yazın", en: "Enter the code" },
    "auth.captchaNew": { tr: "Yeni kod oluştur", en: "Generate new code" },
    "auth.accept1": { tr: "okudum, kabul ediyorum.", en: "read and accept." },
    "auth.acceptPre": { tr: "", en: "I have " },
    "auth.acceptAnd": { tr: " ve ", en: " and " },
    "auth.back": { tr: "Geri", en: "Back" },
    "auth.create": { tr: "Hesabı Oluştur", en: "Create Account" },
    "auth.creating": { tr: "Oluşturuluyor…", en: "Creating…" },
    "auth.haveAccount": { tr: "Zaten hesabın var mı?", en: "Already have an account?" },
    "auth.login": { tr: "Giriş Yap", en: "Sign In" },
    "auth.loginTitle": { tr: "Giriş Yap", en: "Sign In" },
    "auth.loginSub": { tr: "Avalanche hesabınla panele eriş.", en: "Access your panel with your Avalanche account." },
    "auth.identity": { tr: "Kullanıcı Adı veya E-posta", en: "Username or Email" },
    "auth.checking": { tr: "Kontrol ediliyor…", en: "Checking…" },
    "auth.noAccount": { tr: "Hesabın yok mu?", en: "Don't have an account?" },
    "auth.signupLink": { tr: "Hesap Aç", en: "Sign Up" },

    /* ---------------- Panel ---------------- */
    "panel.hesabim": { tr: "Hesabım", en: "My Account" },
    "panel.bildirimler": { tr: "Bildirimler", en: "Notifications" },
    "panel.mesajlar": { tr: "Mesajlar", en: "Messages" },
    "panel.magaza": { tr: "Mağaza", en: "Store" },
    "panel.krediler": { tr: "Krediler", en: "Credits" },
    "panel.supreme": { tr: "Supreme", en: "Supreme" },
    "panel.destek": { tr: "Destek", en: "Support" },
    "panel.logout": { tr: "Çıkış Yap", en: "Sign Out" },
    "panel.sections": { tr: "Panel bölümleri", en: "Panel sections" },
    "panel.menu": { tr: "Panel menüsü", en: "Panel menu" },
    "panel.menuOpen": { tr: "Panel menüsünü aç", en: "Open panel menu" },

    "acct.welcome": { tr: "Hoş geldin", en: "Welcome" },
    "acct.sub": { tr: "Hesap özetin ve profil ayarların.", en: "Your account summary and profile settings." },
    "acct.topics": { tr: "Konu", en: "Topics" },
    "acct.comments": { tr: "Yorum", en: "Comments" },
    "acct.messages": { tr: "Mesaj", en: "Messages" },
    "acct.memberInfo": { tr: "Üyelik Bilgileri", en: "Membership Details" },
    "acct.recent": { tr: "Son 5 Hesap Hareketi", en: "Last 5 Account Activities" },
    "acct.recentEmpty": { tr: "Hareket yok", en: "No activity" },
    "acct.recentEmptySub": {
      tr: "Kredi kazandığında burada görünür.",
      en: "It will appear here once you earn credits."
    },
    "acct.avatar": { tr: "Profil Fotoğrafı", en: "Profile Photo" },
    "acct.avatarPick": { tr: "Görsel Seç", en: "Choose Image" },
    "acct.join": { tr: "Sunucuya Katıl", en: "Join the Server" },
    "acct.joinNote": {
      tr: "Adres panoya kopyalanır; oyun içi konsola yapıştırabilirsin.",
      en: "The address is copied to your clipboard; paste it in the in-game console."
    },
    "acct.copyDone": { tr: "Kopyalandı", en: "Copied" },

    "profile.title": { tr: "Profil Bilgileri", en: "Profile Details" },
    "profile.sub": {
      tr: "Ad, soyad, kullanıcı adı, cinsiyet ve doğum tarihini güncelle.",
      en: "Update your name, username, gender and date of birth."
    },
    "profile.emailLocked": {
      tr: "E-posta adresi değiştirilemez.",
      en: "Email address cannot be changed."
    },
    "profile.save": { tr: "Değişiklikleri Kaydet", en: "Save Changes" },
    "profile.saving": { tr: "Kaydediliyor…", en: "Saving…" },
    "profile.saved": { tr: "Profil bilgilerin güncellendi.", en: "Your profile has been updated." },
    "profile.cooldown": {
      tr: "Kullanıcı adı 72 saatte yalnızca bir kez değiştirilebilir.",
      en: "Username can only be changed once every 72 hours."
    },
    "profile.nextChange": { tr: "Sonraki değişiklik", en: "Next change" },

    "notif.sub": {
      tr: "Arkadaşlık istekleri, mesajlar, destek yanıtları ve sistem bildirimleri.",
      en: "Friend requests, messages, support replies and system notifications."
    },
    "notif.markAll": { tr: "Tümünü okundu işaretle", en: "Mark all as read" },
    "notif.markRead": { tr: "Okundu", en: "Mark read" },
    "notif.delete": { tr: "Sil", en: "Delete" },
    "notif.empty": { tr: "Bildirim yok", en: "No notifications" },
    "notif.emptySub": {
      tr: "Yeni bir hareket olduğunda burada görünecek.",
      en: "New activity will appear here."
    },
    "notif.retention": {
      tr: "7 günden eski bildirimler otomatik silinir.",
      en: "Notifications older than 7 days are removed automatically."
    },
    "notif.friend": { tr: "sana arkadaşlık isteği gönderdi.", en: "sent you a friend request." },
    "notif.msg": { tr: "sana mesaj gönderdi:", en: "sent you a message:" },
    "notif.ticket": { tr: "Destek talebin yanıtlandı:", en: "Your support ticket was answered:" },
    "notif.welcome": {
      tr: "Avalanche hesabın oluşturuldu. Hoş geldin!",
      en: "Your Avalanche account was created. Welcome!"
    },
    "notif.accept": { tr: "Kabul Et", en: "Accept" },
    "notif.reject": { tr: "Reddet", en: "Decline" },
    "notif.openChat": { tr: "Sohbeti Aç", en: "Open Chat" },
    "notif.viewTicket": { tr: "Talebi Gör", en: "View Ticket" },

    "msg.sub": {
      tr: "Arkadaş bul, istek gönder, özel sohbet et.",
      en: "Find friends, send requests, chat privately."
    },
    "msg.search": { tr: "Kullanıcı adıyla ara…", en: "Search by username…" },
    "msg.tabChats": { tr: "Sohbetler", en: "Chats" },
    "msg.tabFriends": { tr: "Arkadaşlar", en: "Friends" },
    "msg.tabRequests": { tr: "İstekler", en: "Requests" },
    "msg.pick": { tr: "Sohbet seç", en: "Select a chat" },
    "msg.unfriend": { tr: "Arkadaşlıktan çıkar", en: "Remove friend" },
    "msg.block": { tr: "Engelle", en: "Block" },
    "msg.placeholder": { tr: "Mesaj yaz…", en: "Write a message…" },
    "msg.send": { tr: "Gönder", en: "Send" },
    "msg.emptyThread": { tr: "Henüz sohbet yok", en: "No chat yet" },
    "msg.emptyThreadSub": {
      tr: "Soldan bir arkadaş seç veya yeni biri ara.",
      en: "Pick a friend on the left or search for someone new."
    },
    "msg.startChat": { tr: "İlk mesajı sen gönder.", en: "Send the first message." },
    "msg.noFriends": { tr: "Henüz arkadaş yok", en: "No friends yet" },
    "msg.noFriendsSub": { tr: "Yukarıdan kullanıcı adıyla ara.", en: "Search by username above." },
    "msg.noRequests": { tr: "İstek yok", en: "No requests" },
    "msg.noRequestsSub": {
      tr: "Gelen arkadaşlık isteği bulunmuyor.",
      en: "You have no incoming friend requests."
    },
    "msg.retention": {
      tr: "3 günden eski mesajlar otomatik silinir.",
      en: "Messages older than 3 days are removed automatically."
    },

    "shop.sub": {
      tr: "Supreme üyelik paketleri. Kredi ile satın alınır.",
      en: "Supreme membership packages. Purchased with credits."
    },
    "shop.credit": { tr: "Kullanılabilir kredi", en: "Available credits" },
    "shop.earn": { tr: "Kredi Kazan", en: "Earn Credits" },
    "shop.buy": { tr: "Satın Al", en: "Buy" },
    "shop.notEnough": { tr: "Yetersiz", en: "Not enough" },
    "shop.failed": { tr: "Mağaza yüklenemedi", en: "Store could not be loaded" },
    "shop.check": { tr: "Bağlantını kontrol et.", en: "Check your connection." },
    "shop.boughtA": { tr: "satın alındı.", en: "purchased." },
    "shop.boughtB": { tr: "kredin kaldı.", en: "credits remaining." },
    "shop.empty": { tr: "Ürün yok", en: "No products" },
    "shop.emptySub": {
      tr: "Mağaza ürünleri henüz eklenmedi.",
      en: "No store products have been added yet."
    },

    "cr.sub": { tr: "Günlük kredi al, geçmişini görüntüle.", en: "Claim daily credits, review your history." },
    "cr.total": { tr: "Toplam kredi", en: "Total credits" },
    "cr.daily": { tr: "Günlük 10 Kredi Al", en: "Claim 10 Daily Credits" },
    "cr.claimed": { tr: "Bugün Alındı", en: "Claimed Today" },
    "cr.note": { tr: "Günde bir kez alınabilir.", en: "Can be claimed once per day." },
    "cr.noteClaimed": {
      tr: "Günlük kredini bugün aldın. Yarın Türkiye saati 00:00'da yenilenir.",
      en: "You already claimed today. It renews at 00:00 Türkiye time tomorrow."
    },
    "cr.noteReady": {
      tr: "Günde bir kez alınabilir. Türkiye saati 00:00'da yenilenir.",
      en: "Can be claimed once per day. It renews at 00:00 Türkiye time."
    },
    "cr.dailyEarn": { tr: "Günlük giriş kredisi", en: "Daily login credit" },
    "cr.once": { tr: "Günde 1", en: "Once a day" },
    "cr.topicEarn": { tr: "Konu açma başına", en: "Per topic opened" },
    "cr.commentEarn": { tr: "Yorum başına", en: "Per comment" },
    "cr.forumSoon": { tr: "Forum hazır değil", en: "Forum not ready" },
    "cr.history": { tr: "Kredi Geçmişi", en: "Credit History" },
    "cr.historyEmpty": { tr: "Geçmiş boş", en: "History is empty" },
    "cr.historyEmptySub": {
      tr: "İlk kredini aldığında burada görünecek.",
      en: "It will appear here once you claim your first credits."
    },

    "sup.sub": { tr: "Ayrıcalıklı üyelik.", en: "Premium membership." },
    "sup.active": { tr: "Aktif", en: "Active" },
    "sup.inactive": { tr: "Aktif Değil", en: "Inactive" },
    "sup.perMonth": { tr: "/ ay", en: "/ month" },
    "sup.perk1": { tr: "kullanabilme", en: "support" },
    "sup.perk2a": { tr: "Maksimum", en: "Up to" },
    "sup.perk2b": { tr: "avatar yükleme", en: "avatar upload" },
    "sup.perk3": { tr: "Kullanıcı adının renkli görünmesi", en: "Colored username display" },
    "sup.gif": { tr: "GIF avatar", en: "GIF avatar" },
    "sup.payOff": { tr: "Ödeme Sistemi Aktif Değil", en: "Payment System Not Active" },
    "sup.payNote": {
      tr: "Ödeme altyapısı henüz kurulmadı. Bu ekran bilgilendirme amaçlıdır; satın alma işlemi yapılmaz.",
      en: "Payment infrastructure is not set up yet. This screen is informational only; no purchase is made."
    },
    "sup.until": { tr: "Bitiş tarihi", en: "Valid until" },

    "tk.sub": { tr: "Talep oluştur ve yanıtları takip et.", en: "Open a ticket and follow replies." },
    "tk.new": { tr: "Yeni Destek Talebi", en: "New Support Ticket" },
    "tk.subject": { tr: "Konu", en: "Subject" },
    "tk.title": { tr: "Başlık", en: "Title" },
    "tk.category": { tr: "Kategori", en: "Category" },
    "tk.desc": { tr: "Açıklama", en: "Description" },
    "tk.subjectPh": { tr: "Kısa bir başlık", en: "A short subject" },
    "tk.titlePh": { tr: "Talebinin başlığı", en: "Your ticket title" },
    "tk.descPh": {
      tr: "Durumu ayrıntılı anlat…",
      en: "Describe the situation in detail…"
    },
    "tk.send": { tr: "Talebi Gönder", en: "Submit Ticket" },
    "tk.mine": { tr: "Taleplerim", en: "My Tickets" },
    "tk.empty": { tr: "Talep yok", en: "No tickets" },
    "tk.emptySub": {
      tr: "Yukarıdaki formdan ilk destek talebini oluştur.",
      en: "Create your first support ticket using the form above."
    },
    "tk.reply": { tr: "Destek yanıtı", en: "Support reply" },
    "tk.missing": {
      tr: "Konu, başlık, kategori ve açıklama alanlarını doldurun.",
      en: "Fill in subject, title, category and description."
    },
    "tk.created": {
      tr: "Destek talebin oluşturuldu. Durum: Bekleniyor.",
      en: "Your ticket was created. Status: Pending."
    },
    "tk.failed": { tr: "Talep oluşturulamadı. Tekrar deneyin.", en: "Ticket could not be created. Try again." },
    "tk.catPlaceholder": { tr: "Seçiniz", en: "Select" },
    "tk.catAccount": { tr: "Hesap", en: "Account" },
    "tk.catCredit": { tr: "Kredi", en: "Credits" },
    "tk.catStore": { tr: "Mağaza", en: "Store" },
    "tk.catServer": { tr: "Sunucu", en: "Server" },
    "tk.catTech": { tr: "Teknik", en: "Technical" },
    "tk.catOther": { tr: "Diğer", en: "Other" },

    "st.yanitlandi": { tr: "Yanıtlandı", en: "Answered" },
    "st.bekliyor": { tr: "Bekleniyor", en: "Pending" },
    "st.kapatildi": { tr: "Kapatıldı", en: "Closed" },

    "logout.title": {
      tr: "Çıkış yapmak istediğine emin misin?",
      en: "Are you sure you want to sign out?"
    },
    "logout.sub": {
      tr: "Oturumun kapatılacak ve tekrar giriş yapman gerekecek.",
      en: "Your session will be closed and you will need to sign in again."
    },
    "logout.cancel": { tr: "Vazgeç", en: "Cancel" },
    "logout.confirm": { tr: "Çıkış Yap", en: "Sign Out" },

    "common.system": { tr: "Sistem", en: "System" },
    "common.standard": { tr: "Standart üye", en: "Standard member" },
    "common.supremeMember": { tr: "Supreme üye", en: "Supreme member" },
    "common.member": { tr: "Üye", en: "Member" },
    "common.admin": { tr: "Yönetici", en: "Admin" },
    "common.active": { tr: "Aktif", en: "Active" },
    "common.suspended": { tr: "Askıda", en: "Suspended" },
    "common.credits": { tr: "kredi", en: "credits" },
    "common.friend": { tr: "Arkadaş", en: "Friend" },
    "common.loadErr": { tr: "Veriler yüklenemedi", en: "Data could not be loaded" },

    /* ---------------- Yönetici ---------------- */
    "adm.title": { tr: "Yönetici paneline giriş", en: "Sign in to admin panel" },
    "adm.sub": {
      tr: "Bu alan yalnızca yetkili yönetim içindir.",
      en: "This area is for authorized management only."
    },
    "adm.noAccess": { tr: "Yönetici yetkisi gerekli", en: "Admin access required" },
    "adm.noAccessSub": {
      tr: "Bu sayfaya erişmek için yönetici yetkili bir hesapla giriş yapmalısın.",
      en: "Sign in with an admin account to access this page."
    },
    "adm.members": { tr: "Üyeler", en: "Members" },
    "adm.tickets": { tr: "Destek Talepleri", en: "Support Tickets" },
    "adm.store": { tr: "Mağaza", en: "Store" },
    "adm.membersSub": {
      tr: "Kayıtlı hesaplar. Kişisel alanlar şifreli olduğu için yalnızca kullanıcı adı ve durum görünür.",
      en: "Registered accounts. Personal fields are encrypted, so only username and status are shown."
    },
    "adm.ticketsSub": { tr: "Bekleyen talepleri yanıtla, durumu güncelle.", en: "Reply to pending tickets and update status." },
    "adm.storeSub": { tr: "Ürünlerin stok ve kredi fiyatlarını gör.", en: "See product stock and credit prices." },
    "adm.search": { tr: "Kullanıcı adı ara…", en: "Search username…" },
    "adm.reply": { tr: "Yanıt yaz…", en: "Write a reply…" },
    "adm.answer": { tr: "Yanıtla", en: "Reply" },
    "adm.close": { tr: "Kapat", en: "Close" },
    "adm.answer": { tr: "Yanıtla", en: "Reply" },
    "adm.login": { tr: "Giriş Yap", en: "Sign In" },
    "adm.wrong": {
      tr: "Kullanıcı adı veya şifre hatalı.",
      en: "Incorrect username or password."
    },
    "adm.panelName": { tr: "Yönetim", en: "Management" },
    "adm.menu": { tr: "Yönetici menüsü", en: "Admin menu" },
    "adm.sections": { tr: "Yönetici bölümleri", en: "Admin sections" },
    "adm.memberLogin": { tr: "Üye girişine dön", en: "Back to member sign in" },
    "adm.retry": { tr: "Yeniden Giriş Yap", en: "Sign In Again" },
    "adm.logoutSub": { tr: "Yönetici oturumun kapatılacak.", en: "Your admin session will be closed." },
    "adm.needIdentity": { tr: "Kullanıcı adı veya e-posta girin.", en: "Enter your username or email." },
    "adm.needPassword": { tr: "Şifrenizi girin.", en: "Enter your password." },
    "adm.fillAll": { tr: "Lütfen işaretli alanları doldurun.", en: "Please fill in the marked fields." },
    "adm.needCode": { tr: "Güvenlik kodunu girin.", en: "Enter the security code." },
    "adm.wrongCode": { tr: "Güvenlik kodu yanlış.", en: "Incorrect security code." },
    "adm.noCrypto": {
      tr: "Bu tarayıcı güvenli şifreleme desteklemiyor.",
      en: "This browser does not support secure encryption."
    },
    "adm.welcome": { tr: "Giriş başarılı. Panel açılıyor…", en: "Signed in. Opening the panel…" },
    "adm.failed": {
      tr: "Giriş yapılamadı. Bağlantını kontrol edip tekrar dene.",
      en: "Sign-in failed. Check your connection and try again."
    },
    "adm.stock": { tr: "stok", en: "stock" },
    "adm.days": { tr: "gün", en: "days" },
    "adm.noUsers": { tr: "Üye yok", en: "No members" },
    "adm.noUsersSub": { tr: "Henüz kayıt yapılmamış.", en: "No registrations yet." },
    "adm.noTickets": { tr: "Talep yok", en: "No tickets" },
    "adm.noTicketsSub": { tr: "Henüz destek talebi oluşturulmamış.", en: "No support tickets yet." },
    "adm.usersFailed": { tr: "Üyeler yüklenemedi", en: "Members could not be loaded" },
    "adm.ticketsFailed": { tr: "Talepler yüklenemedi", en: "Tickets could not be loaded" },
    "common.loading": { tr: "Yükleniyor…", en: "Loading…" }
  };

  function normalise(lang) {
    return lang === "en" ? "en" : "tr";
  }

  function get() {
    try {
      return normalise(global.localStorage.getItem(KEY) || DEFAULT);
    } catch (e) {
      return DEFAULT;
    }
  }

  function t(key, fallback) {
    var entry = DICT[key];
    if (!entry) return fallback != null ? fallback : key;
    return entry[current] || entry.tr || (fallback != null ? fallback : key);
  }

  /* Bir metni bağlama göre çevir (tablo etiketleri için) */
  function tt(obj) {
    if (!obj) return "";
    return obj[current] || obj.tr || "";
  }

  /* Dili uygula ve DOM'u güncelle */
  function apply(lang) {
    current = normalise(lang);
    var html = document.documentElement;
    html.setAttribute("lang", current);
    html.setAttribute("data-lang", current);

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-i18n]"),
      function (node) {
        var key = node.getAttribute("data-i18n");
        /* Anahtar sözlükte yoksa metne DOKUNMA: ham anahtar
           ("adm.panelName" gibi) ekrana yazılmasın. */
        if (!DICT[key]) return;
        var val = t(key, null);
        if (val != null) node.textContent = val;
      }
    );

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-i18n-ph]"),
      function (node) {
        var key = node.getAttribute("data-i18n-ph");
        if (DICT[key]) node.setAttribute("placeholder", t(key, ""));
      }
    );

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-i18n-aria]"),
      function (node) {
        var key = node.getAttribute("data-i18n-aria");
        if (DICT[key]) node.setAttribute("aria-label", t(key, ""));
      }
    );

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-i18n-title]"),
      function (node) {
        var key = node.getAttribute("data-i18n-title");
        if (DICT[key]) node.setAttribute("title", t(key, ""));
      }
    );

    /* Dil düğmeleri */
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-lang-btn]"),
      function (btn) {
        var on = btn.getAttribute("data-lang-btn") === current;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      }
    );

    /* Sayfa başlığı: <body data-title-tr data-title-en> */
    var body = document.body;
    if (body) {
      var titled = body.getAttribute("data-title-" + current);
      if (titled) document.title = titled;
    }

    /* Dinleyicilere haber ver (panel kendi metinlerini yeniler) */
    try {
      global.dispatchEvent(
        new CustomEvent("avl:lang", { detail: { lang: current } })
      );
    } catch (e) {
      /* CustomEvent desteği yoksa yoksay */
    }
  }

  function set(lang, persist) {
    var next = normalise(lang);
    if (persist !== false) {
      try {
        global.localStorage.setItem(KEY, next);
      } catch (e) { /* depolama kapalı */ }
    }
    apply(next);
  }

  function toggle() {
    set(current === "tr" ? "en" : "tr", true);
  }

  global.AvlI18n = {
    KEY: KEY,
    t: t,
    tt: tt,
    get: get,
    set: set,
    apply: apply,
    toggle: toggle,
    lang: function () { return current; },
    dict: DICT
  };

  /* Hazır olduğunda dili uygula */
  current = get();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      apply(current);
    });
  } else {
    apply(current);
  }
})(window);
