from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def text_from_node(node: ET.Element) -> str:
    pieces: list[str] = []
    for child in node.iter():
        tag = child.tag
        if tag == f"{{{NS['w']}}}t":
            pieces.append(child.text or "")
        elif tag == f"{{{NS['w']}}}tab":
            pieces.append("\t")
        elif tag in {f"{{{NS['w']}}}br", f"{{{NS['w']}}}cr"}:
            pieces.append("\n")
    return "".join(pieces)


def para_style(paragraph: ET.Element) -> str:
    style = paragraph.find("./w:pPr/w:pStyle", NS)
    if style is None:
        return ""
    return style.attrib.get(f"{{{NS['w']}}}val", "")


def normalize_line(value: str) -> str:
    return re.sub(r"[ \t]+", " ", value.replace("\xa0", " ")).strip()


def iter_block_text(document_xml: bytes):
    root = ET.fromstring(document_xml)
    body = root.find("w:body", NS)
    if body is None:
        return

    for block in body:
        if block.tag == f"{{{NS['w']}}}p":
            text = normalize_line(text_from_node(block))
            if text:
                yield {
                    "type": "paragraph",
                    "style": para_style(block),
                    "text": text,
                }
        elif block.tag == f"{{{NS['w']}}}tbl":
            for row in block.findall(".//w:tr", NS):
                cells = []
                for cell in row.findall("./w:tc", NS):
                    cell_text = normalize_line(text_from_node(cell))
                    if cell_text:
                        cells.append(cell_text)
                if cells:
                    yield {
                        "type": "table_row",
                        "style": "",
                        "text": " | ".join(cells),
                    }


def extract_docx(input_path: Path):
    with zipfile.ZipFile(input_path) as docx:
        document_xml = docx.read("word/document.xml")
    return list(iter_block_text(document_xml))


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract readable text from DOCX without editing it.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--txt", type=Path, required=True)
    parser.add_argument("--json", type=Path, required=True)
    args = parser.parse_args()

    blocks = extract_docx(args.input)
    args.txt.parent.mkdir(parents=True, exist_ok=True)
    args.json.parent.mkdir(parents=True, exist_ok=True)

    args.txt.write_text("\n".join(block["text"] for block in blocks), encoding="utf-8")
    args.json.write_text(json.dumps(blocks, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({
        "input": str(args.input),
        "blocks": len(blocks),
        "txt": str(args.txt),
        "json": str(args.json),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
