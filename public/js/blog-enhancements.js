/* ── YT SEO Architect — Blog Enhancements ───────────── */
/* Reading progress, scroll reveal, copy button, font size */
/* ────────────────────────────────────────────────────── */

(function() {
  'use strict';

  // ── Reading Progress Bar ──
  const bar = document.getElementById('reading-progress');
  if (bar) {
    window.addEventListener('scroll', function() {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = progress + '%';
    }, { passive: true });
  }

  // ── Scroll Reveal ──
  var revealObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(function(el) {
    revealObserver.observe(el);
  });

  // ── Copy Code Button ──
  document.querySelectorAll('pre').forEach(function(pre) {
    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', function() {
      var code = pre.querySelector('code');
      var text = code ? code.textContent : pre.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          btn.textContent = 'Copied!';
          setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
        });
      } else {
        // Fallback
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
      }
    });
    pre.appendChild(btn);
  });

  // ── Font Size Toggle ──
  var articleBody = document.getElementById('article-body');
  var fontBtns = document.querySelectorAll('.font-size-btn');
  if (articleBody && fontBtns.length) {
    fontBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        fontBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var size = btn.getAttribute('data-size') || 'medium';
        var sizes = { small: '0.9rem', medium: '1rem', large: '1.15rem' };
        articleBody.style.fontSize = sizes[size] || sizes.medium;
      });
    });
  }

  // ── TOC Active State on Scroll ──
  var tocLinks = document.querySelectorAll('.toc-sticky a');
  if (tocLinks.length) {
    var headings = [];
    tocLinks.forEach(function(link) {
      var href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        var el = document.getElementById(href.substring(1));
        if (el) headings.push({ el: el, link: link });
      }
    });

    if (headings.length) {
      window.addEventListener('scroll', function() {
        var scrollY = window.scrollY + 100;
        var current = null;
        headings.forEach(function(h) {
          if (h.el.offsetTop <= scrollY) current = h;
        });
        tocLinks.forEach(function(l) { l.classList.remove('active'); });
        if (current) current.link.classList.add('active');
      }, { passive: true });
    }
  }

  // ── Mobile Menu Toggle ──
  var menuBtn = document.querySelector('.mobile-menu-btn');
  var headerNav = document.querySelector('.header-nav');
  if (menuBtn && headerNav) {
    menuBtn.addEventListener('click', function() {
      headerNav.classList.toggle('open');
    });
  }

  // ── Cursor Glow (Hero Only) ──
  var hero = document.querySelector('.hero-glow');
  if (hero) {
    hero.addEventListener('mousemove', function(e) {
      var rect = hero.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      hero.style.setProperty('--glow-x', x + '%');
      hero.style.setProperty('--glow-y', y + '%');
    });
  }
})();
