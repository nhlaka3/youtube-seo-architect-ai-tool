#!/usr/bin/env python3
"""Extract clean article text from blog posts (local HTML or live URL).

Usage: python3 extract_blog_text.py <slug> [--source local|live]
Outputs plain text to stdout.
"""
import re
import sys
import urllib.request
from bs4 import BeautifulSoup

ROOT = "/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/public/blog"
BASE = "https://yt-seo-architect.vercel.app/blog"


def strip_article(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    # Remove non-content blocks first
    for tag in soup(["script", "style", "nav", "header", "footer", "aside",
                     "form", "button", "noscript", "iframe", "svg", "figure"]):
        tag.decompose()
    article = soup.find("article") or soup.find("main") or soup.body or soup
    # Remove remaining boilerplate inside article
    boiler = ("author-box", "breadcrumb", "share", "social", "related",
              "faq-schema", "schema", "comments", "newsletter", "cta",
              "table-of-contents", "toc")
    for el in article.find_all(True, class_=True):
        attrs = getattr(el, "attrs", None) or {}
        cls_list = attrs.get("class") or []
        if any(b in " ".join(cls_list) for b in boiler):
            el.decompose()
    # Keep headings and paragraphs, drop everything else
    text_parts = []
    for el in article.find_all(["h1", "h2", "h3", "h4", "p", "li", "blockquote", "td", "th"]):
        t = el.get_text(" ", strip=True)
        if t:
            text_parts.append(t)
    return "\n".join(text_parts)


def main():
    slug = sys.argv[1]
    source = sys.argv[2] if len(sys.argv) > 2 else "local"
    if source == "local":
        with open(f"{ROOT}/{slug}.html", encoding="utf-8") as f:
            html = f.read()
    else:
        url = f"{BASE}/{slug}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=45) as r:
            html = r.read().decode("utf-8", "replace")
    text = strip_article(html)
    words = len(text.split())
    sys.stderr.write(f"[{slug}] source={source} words={words}\n")
    print(text)


if __name__ == "__main__":
    main()
