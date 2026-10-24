#!/usr/bin/env python3
"""Generate the reading pages and the contents page from the Standard Ebooks source.

Usage:
    git clone --depth 1 https://github.com/standardebooks/edwin-a-abbott_flatland.git /path/to/se
    python3 tools/import_text.py /path/to/se

Writes read/*.html and index.html. The generated files are committed, so the site
itself needs no build step; rerun this only when the text or the page template changes.
"""
import html
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

XHTML = "{http://www.w3.org/1999/xhtml}"
EPUB_TYPE = "{http://www.idpf.org/2007/ops}type"
ROOT = Path(__file__).resolve().parent.parent

SITE_TITLE = "Flatland Fog"
FONTS = ("https://fonts.googleapis.com/css2?family=Libre+Caslon+Display"
         "&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap")

PARTS = {
    "part-1": ("I", "This World"),
    "part-2": ("II", "Other Worlds"),
}

# Interactives embedded in a section. "after" is a figure id, or "text:<phrase>" to insert after
# the first paragraph containing that phrase, or None for the end of the section.
EMBEDS = {
    1: [
        {"after": "illustration-1", "slug": "coin-on-table", "title": "Lower your eye to the table"},
    ],
    6: [
        {"after": "text:the Merchant, what shall I see", "slug": "recognition-by-sight",
         "query": "scene=merchant", "title": "The Merchant"},
        {"after": "text:the Physician, though I shall", "slug": "recognition-by-sight",
         "query": "scene=physician", "title": "The Physician"},
        {"after": "text:contemplating one of his sides", "slug": "recognition-by-sight",
         "query": "scene=grandson", "title": "A hexagonal grandson"},
    ],
}

KEEP_ATTRS = {"id", "href", "src", "alt", "title", "lang"}


def local(tag):
    return tag.split("}", 1)[-1]


def slugify(text, max_words=8):
    words = re.sub(r"[^a-z0-9\s-]", "", text.lower()).split()
    return "-".join(words[:max_words])


def rewrite_attr(name, value):
    if name == "src":
        return value.replace("../images/", "../illustrations/")
    if name == "href" and value.startswith("endnotes.xhtml#"):
        return "#" + value.split("#", 1)[1]
    return value


def serialize(el, skip=()):
    tag = local(el.tag)
    if tag in skip:
        return ""
    attrs = ""
    for k, v in el.attrib.items():
        name = local(k)
        if k == EPUB_TYPE or name not in KEEP_ATTRS:
            continue
        attrs += f' {name}="{html.escape(rewrite_attr(name, v), quote=True)}"'
    if el.get(EPUB_TYPE, "").find("noteref") >= 0:
        attrs += ' class="noteref"'
    inner = html.escape(el.text or "", quote=False)
    for child in el:
        inner += serialize(child, skip)
        inner += html.escape(child.tail or "", quote=False)
    if tag in ("br", "img"):
        return f"<{tag}{attrs}>"
    return f"<{tag}{attrs}>{inner}</{tag}>"


def load(path):
    return ET.parse(path).getroot()


def section_of(root):
    return root.find(f".//{XHTML}section")


def read_notes(src):
    notes = {}
    root = load(src / "endnotes.xhtml")
    for li in root.iter(f"{XHTML}li"):
        for a in li.iter(f"{XHTML}a"):
            if "backlink" in a.get(EPUB_TYPE, ""):
                parent = next(p for p in li.iter() if a in list(p))
                parent.remove(a)
        notes[li.get("id")] = "".join(serialize(p) for p in li)
    return notes


def read_part(src, part_id):
    root = load(src / f"{part_id}.xhtml")
    quote = root.find(f".//{XHTML}blockquote")
    return serialize(quote) if quote is not None else ""


def read_chapter(src, name):
    section = section_of(load(src / f"{name}.xhtml"))
    if name == "preface":
        title = "".join(section.find(f".//{XHTML}h2").itertext()).strip()
        ordinal = ""
    else:
        hgroup = section.find(f"{XHTML}hgroup")
        ordinal = hgroup.find(f"{XHTML}h3").text.strip()
        title = "".join(hgroup.find(f"{XHTML}p").itertext()).strip()
    blocks = [
        {"id": child.get("id"), "html": serialize(child), "text": re.sub(r"\s+", " ", "".join(child.itertext()))}
        for child in section if local(child.tag) not in ("hgroup", "header")
    ]
    return {"name": name, "title": title, "ordinal": ordinal, "part": section.get("data-parent"), "blocks": blocks}


def page_head(title, depth):
    up = "../" * depth
    return f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="{up}shared/theme.css">
<link rel="stylesheet" href="{up}shared/reader.css">
</head>
<body>
"""


def embed_html(embed):
    src = f"../interactives/{embed['slug']}/index.html"
    if embed.get("query"):
        src += "?" + embed["query"]
    title = html.escape(embed["title"])
    return f"""<figure class="interactive">
<iframe src="{html.escape(src)}" title="{title}" loading="lazy"></iframe>
<figcaption><span>Interactive · {title}</span><a href="{html.escape(src)}">Open on its own page</a></figcaption>
</figure>"""


def anchored_here(after, block):
    if not after:
        return False
    if after.startswith("text:"):
        return after[len("text:"):] in block["text"]
    return after == block["id"]


def chapter_page(ch, prev, nxt, notes, epigraph):
    number = int(ch["name"].split("-")[1]) if ch["name"].startswith("chapter-") else 0
    embeds = EMBEDS.get(number, [])
    body = []
    placed = set()
    for block in ch["blocks"]:
        body.append(block["html"])
        for i, embed in enumerate(embeds):
            if i not in placed and anchored_here(embed["after"], block):
                body.append(embed_html(embed))
                placed.add(i)
    for i, embed in enumerate(embeds):
        if i not in placed:
            if embed["after"]:
                sys.exit(f"section {number}: anchor not found: {embed['after']}")
            body.append(embed_html(embed))

    refs = re.findall(r'href="#(note-\d+)"', "".join(body))
    notes_html = ""
    if refs:
        items = "".join(
            f'<li id="{r}">{notes[r]}<a class="backlink" href="#noteref-{r.split("-")[1]}" aria-label="Back to text">↩</a></li>'
            for r in refs)
        notes_html = f'<section class="notes" aria-label="Notes"><h2>Notes</h2><ol>{items}</ol></section>'

    if ch["part"]:
        roman, part_title = PARTS[ch["part"]]
        crumb = f"Part {roman} · {part_title}"
        eyebrow = f"Section {ch['ordinal']}"
    else:
        crumb, eyebrow = "Front matter", ""

    def pager_link(target, label):
        if not target:
            return "<span></span>"
        return f'<a href="{target["file"]}"><small>{label}</small>{html.escape(target["title"])}</a>'

    epigraph_html = f'<div class="epigraph">{epigraph}</div>' if epigraph else ""
    return (page_head(f"{ch['title']} · {SITE_TITLE}", 1) + f"""<main class="wrap reader">
<nav class="crumbs"><a href="../index.html">{SITE_TITLE}</a><span>{crumb}</span></nav>
<header class="chapter-head">
{f'<p class="eyebrow">{eyebrow}</p>' if eyebrow else ''}
<h1>{html.escape(ch['title'])}</h1>
{epigraph_html}
</header>
<article class="text">
{chr(10).join(body)}
</article>
{notes_html}
<nav class="pager" aria-label="Sections">
{pager_link(prev, 'Previous')}
{pager_link(nxt, 'Next')}
</nav>
</main>
<script src="../shared/reader.js"></script>
</body>
</html>
""")


def index_page(chapters, epigraphs):
    def entry(ch):
        tag = f'<span class="num">{ch["ordinal"]}</span>' if ch["ordinal"] else '<span class="num"></span>'
        number = int(ch["name"].split("-")[1]) if ch["name"].startswith("chapter-") else 0
        badge = '<span class="badge">interactive</span>' if number in EMBEDS else ""
        return f'<li><a href="read/{ch["file"]}">{tag}<span class="t">{html.escape(ch["title"])}</span>{badge}</a></li>'

    groups = []
    front = [c for c in chapters if not c["part"]]
    groups.append(f'<section class="toc-part"><h2>Front matter</h2><ol>{"".join(entry(c) for c in front)}</ol></section>')
    for part_id, (roman, title) in PARTS.items():
        items = "".join(entry(c) for c in chapters if c["part"] == part_id)
        groups.append(f'<section class="toc-part"><h2>Part {roman} · {title}</h2>'
                      f'<div class="epigraph">{epigraphs[part_id]}</div><ol>{items}</ol></section>')

    return (page_head(SITE_TITLE, 0) + f"""<main class="wrap home">
<header class="home-head">
<p class="eyebrow">Edwin A. Abbott · 1884</p>
<h1>Flatland Fog</h1>
<p class="lede">An interactive reading of <cite>Flatland: A Romance of Many Dimensions</cite>. The full text sits alongside working models of the book's thought experiments: lower your eye to the table, read a stranger's rank from the fog, watch a Sphere pass through the plane.</p>
</header>
{"".join(groups)}
<footer class="colophon">Text and illustrations from the <a href="https://standardebooks.org/ebooks/edwin-a-abbott/flatland">Standard Ebooks</a> edition, dedicated to the public domain. Interactives and site code under the MIT License.</footer>
</main>
</body>
</html>
""")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1]) / "src" / "epub" / "text"
    notes = read_notes(src)
    epigraphs = {p: read_part(src, p) for p in PARTS}

    chapters = [read_chapter(src, "preface")] + [read_chapter(src, f"chapter-{n}") for n in range(1, 23)]
    for ch in chapters:
        if ch["name"] == "preface":
            ch["file"] = "preface.html"
        else:
            n = int(ch["name"].split("-")[1])
            ch["file"] = f"{n:02d}-{slugify(ch['title'])}.html"

    out = ROOT / "read"
    out.mkdir(exist_ok=True)
    first_of_part = {}
    for ch in chapters:
        if ch["part"] and ch["part"] not in first_of_part:
            first_of_part[ch["part"]] = ch["name"]
    for i, ch in enumerate(chapters):
        prev = chapters[i - 1] if i > 0 else None
        nxt = chapters[i + 1] if i + 1 < len(chapters) else None
        epigraph = epigraphs[ch["part"]] if ch["part"] and first_of_part[ch["part"]] == ch["name"] else ""
        (out / ch["file"]).write_text(chapter_page(ch, prev, nxt, notes, epigraph), encoding="utf-8")
    (ROOT / "index.html").write_text(index_page(chapters, epigraphs), encoding="utf-8")
    print(f"wrote {len(chapters)} reading pages and index.html")


if __name__ == "__main__":
    main()
