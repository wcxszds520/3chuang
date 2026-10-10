from pathlib import Path
from zipfile import ZipFile

from lxml import etree
from PyPDF2 import PdfReader


ROOT = Path(r"D:\cixing\3chuang")
DOCX = ROOT / "output" / "word" / "甬柜易算项目科技查新报告（正式稿）.docx"
PDF = ROOT / "output" / "pdf" / "甬柜易算项目科技查新报告（正式稿）.pdf"

with ZipFile(DOCX) as archive:
    print("docx_zip_test", archive.testzip())
    names = set(archive.namelist())
    print("media_files", sorted(n for n in names if n.startswith("word/media/")))
    print("comments_or_revisions", sorted(n for n in names if "comment" in n.lower()))
    rels = etree.fromstring(archive.read("word/_rels/document.xml.rels"))
    ns = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
    links = [
        node.get("Target")
        for node in rels.xpath('//r:Relationship[@TargetMode="External"]', namespaces=ns)
    ]
    print("external_links", len(links), "all_https", all(link.startswith("https://") for link in links))

reader = PdfReader(str(PDF))
dims = []
rotations = []
text_lengths = []
for page in reader.pages:
    dims.append((round(float(page.mediabox.width), 2), round(float(page.mediabox.height), 2)))
    rotations.append(page.rotation or 0)
    text_lengths.append(len((page.extract_text() or "").strip()))

print("pages", len(reader.pages))
print("unique_sizes", sorted(set(dims)))
print("rotations", sorted(set(rotations)))
print("empty_pages", sum(1 for length in text_lengths if length == 0))
print("min_text_chars", min(text_lengths))
print("text_chars_per_page", text_lengths)
