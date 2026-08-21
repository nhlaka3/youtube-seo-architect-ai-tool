// Google Analytics 4 — YT SEO Architect
// ⚠️ MEASUREMENT ID PLACEHOLDER: replace G-XXXXXXXXXX with the real GA4
// property Measurement ID, then deploy (push to private repo).
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-XXXXXXXXXX');
(function (w, d, s) {
  var f = d.getElementsByTagName(s)[0],
      j = d.createElement(s);
  j.async = true;
  j.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX';
  f.parentNode.insertBefore(j, f);
})(window, document, 'script');
