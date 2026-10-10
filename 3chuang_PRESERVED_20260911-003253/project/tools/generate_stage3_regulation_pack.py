from __future__ import annotations

import json
from pathlib import Path

import fitz
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "web-dashboard" / "public" / "regulations"
RENDERED = OUTPUT / "rendered"
FONT_PATH = Path(r"C:\Windows\Fonts\simhei.ttf")


DOCUMENTS = [
    {
        "documentId": "solas-vgm-local-pack",
        "documentTitle": "SOLAS VGM 重量验证本地资料包",
        "shortTitle": "VGM 重量验证",
        "subject": "VGM",
        "pages": [
            ("资料包说明", [
                "本文件是甬柜易算根据本地结构化法规资料整理的演示用 PDF，不是线上官方网页，也不是实时官方 PDF。",
                "资料主题：载货集装箱验证总质量（Verified Gross Mass，VGM）。",
                "使用边界：用于规则定位、证据演示和内部复核；实际申报仍应以承运人、码头和主管机关的现行要求为准。",
            ]),
            ("验证总质量要求", [
                "装船前，托运人应取得并申报载货集装箱验证总质量。未取得有效 VGM 的载货集装箱不应进入船舶积载计划。",
                "VGM 应包含货物、包装、托盘、衬垫、系固材料与集装箱皮重，申报记录应能够追溯到订单、箱号、称重方式和责任人。",
                "甬柜易算规则映射：VGM 提交状态与建议申报重量分开记录，未提交时保持 WARNING，不伪造已申报状态。",
            ]),
            ("重量计算与 MAX GROSS", [
                "验证总质量不得超过集装箱安全合格牌照标示的最大总重（MAX GROSS），货物净重也不得超过柜型允许载荷。",
                "可采用整体称重，或将全部货物、包装与系固材料重量相加后再加集装箱皮重；所用方法应符合所在地主管机关认可程序。",
                "系统命中依据：真实后端方案货重加柜体皮重形成建议 VGM，并同时核对柜型载重与 MAX GROSS。",
            ]),
            ("操作与留痕清单", [
                "复核箱号、柜型、皮重、货重、建议 VGM、称重方式、称重日期、申报责任人和承运人截止时间。",
                "保存称重单、设备校准记录、申报回执与改单记录；AI 解释不能替代称重凭证或人工签字。",
                "异常处置：超重时停止装运并重新配载；未提交时保持待办状态；更换集装箱后重新计算。",
            ]),
        ],
    },
    {
        "documentId": "ctu-code-local-pack",
        "documentTitle": "CTU Code 装载与系固本地资料包",
        "shortTitle": "CTU 装载规范",
        "subject": "CTU",
        "pages": [
            ("资料包说明", [
                "本文件是甬柜易算根据 CTU Code 本地结构化条款摘要整理的演示用 PDF，不是官方文本复刻。",
                "资料主题：货物运输单元的装载计划、重量分布、堆叠、系固、作业可达性与复核。",
                "所有系统规则只提供确定性预审，现场装载、承运人要求和人工复核仍保持独立。",
            ]),
            ("重量分布与重心", [
                "装载计划应使货物重量在箱底合理分布，避免明显横向偏载和纵向端部集中；重货宜置于低位并靠近合理支承区域。",
                "系统演示阈值：横向重心偏移小于 5%，纵向重心偏移小于 10%；超过阈值时给出 WARNING 并要求重新配载。",
                "批次卸货顺序应与空间可达性一致。先卸批次靠近门端、后卸批次位于箱内深区，以减少倒箱和交叉穿插。",
            ]),
            ("堆叠、承压与系固", [
                "不可堆叠、易碎或承压能力不足的货物上方不得放置造成损伤的载荷；重货不应压在轻货或脆弱包装上。",
                "装载后应检查空隙、摩擦、防滑、阻挡、绑扎和门端安全。货物释放前必须到达算法目标坐标并完成稳定放置。",
                "系统命中依据：逐件检查三维重叠与上方承压，保留叉车/人工作业方式、目标坐标和阻断原因。",
            ]),
            ("装载完整性与作业复核", [
                "订单输入件数、已装件数和未装件数应逐件可追溯；不得用汇总文字掩盖未装货物或改变真实装箱方案。",
                "作业队列应保持真实连续顺序，筛选仅改变查看范围，不得改写 machine index、货物坐标或方案指纹。",
                "复核清单：柜型、货物标识、批次、目的港、港序、作业方式、风险属性、目标位置、重心与未装原因。",
            ]),
        ],
    },
    {
        "documentId": "ippc-ispm15-local-pack",
        "documentTitle": "IPPC / ISPM 15 木包装本地资料包",
        "shortTitle": "IPPC 木包装",
        "subject": "IPPC",
        "pages": [
            ("资料包说明", [
                "本文件是甬柜易算根据 IPPC / ISPM 15 主题资料整理的本地演示 PDF，不是官方证书或实时官方 PDF。",
                "资料主题：国际贸易中木质包装材料的处理、标识、适用范围和证据留存。",
                "系统不会把货物名称中的“木”自动当作已取得证据，必须保留可核对的处理标识或文件记录。",
            ]),
            ("处理与 IPPC 标识", [
                "适用的木质包装材料应按认可措施进行处理，并施加清晰、耐久、不可转移且可辨认的 IPPC 标识。",
                "标识复核通常包括 IPPC 符号、国家/地区代码、生产者或处理者代码及处理措施代码；污损、缺失或不可辨认应进入待补证状态。",
                "甬柜易算规则映射：木包装货物没有已确认的 IPPC / ISPM 15 证据时保持 WARNING，人工说明不得覆盖原始证据缺口。",
            ]),
            ("适用范围与现场核验", [
                "托盘、木箱、垫木、支撑木和其他原木加工的木质包装可能属于核验范围；纸制品、薄木材和经过充分加工的木制品需按实际要求判断。",
                "现场应核对标识位置、可读性、处理代码、包装完整性与货物批次，并记录照片或单证索引。",
                "若目的国、承运人或客户有更严格要求，应以其现行要求为准并追加到人工复核条件中。",
            ]),
            ("证据与异常处置清单", [
                "证据索引至少包含订单号、SKU、批次、包装类型、标识照片、处理证明、核验人、核验时间和异常说明。",
                "发现无标、错标、污损、虫害迹象或批次不一致时，应暂停放行并执行更换包装、重新处理或补充证明。",
                "AI 可解释为何命中规则，但不能生成或替代 IPPC 标识、处理证明和现场人工结论。",
            ]),
        ],
    },
]


def register_font() -> None:
    if not FONT_PATH.exists():
        raise FileNotFoundError(f"Chinese font not found: {FONT_PATH}")
    pdfmetrics.registerFont(TTFont("Stage3CN", str(FONT_PATH)))


def page_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Stage3CN", 8)
    canvas.setFillColor(HexColor("#65736d"))
    canvas.drawString(20 * mm, 12 * mm, "本地法规资料包 · 演示用 PDF 渲染源")
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f"第 {doc.page} 页")
    canvas.restoreState()


def build_pdf(document: dict) -> Path:
    pdf_path = OUTPUT / f"{document['documentId']}.pdf"
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "Stage3Title",
        parent=styles["Title"],
        fontName="Stage3CN",
        fontSize=22,
        leading=31,
        textColor=HexColor("#173b31"),
        alignment=TA_LEFT,
        spaceAfter=8 * mm,
    )
    subtitle = ParagraphStyle(
        "Stage3Subtitle",
        parent=styles["Heading2"],
        fontName="Stage3CN",
        fontSize=13,
        leading=20,
        textColor=HexColor("#a4552e"),
        spaceAfter=5 * mm,
    )
    body = ParagraphStyle(
        "Stage3Body",
        parent=styles["BodyText"],
        fontName="Stage3CN",
        fontSize=11,
        leading=20,
        textColor=HexColor("#273b35"),
        spaceAfter=6 * mm,
    )
    label = ParagraphStyle(
        "Stage3Label",
        parent=body,
        fontSize=9,
        leading=15,
        textColor=HexColor("#5f6f69"),
    )
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=22 * mm,
        bottomMargin=22 * mm,
        title=document["documentTitle"],
        author="甬柜易算 · 本地法规资料包",
        subject=document["subject"],
    )
    story = []
    for index, (page_title, paragraphs) in enumerate(document["pages"], start=1):
        story.append(Paragraph(document["shortTitle"], label))
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(page_title, title))
        metadata = Table(
            [["资料属性", "本地法规资料包"], ["文档编号", document["documentId"]], ["主题", document["subject"]]],
            colWidths=[28 * mm, 115 * mm],
        )
        metadata.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "Stage3CN"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 0), (0, -1), HexColor("#52655e")),
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#edf2ef")),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#b9c7c1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, HexColor("#ced8d3")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(metadata)
        story.append(Spacer(1, 9 * mm))
        story.append(Paragraph(f"{index}.1 证据摘录", subtitle))
        for paragraph_index, paragraph in enumerate(paragraphs, start=1):
            story.append(Paragraph(f"{index}.{paragraph_index}　{paragraph}", body))
        story.append(Spacer(1, 7 * mm))
        story.append(Paragraph("来源声明：本页为本地结构化法规资料的 PDF 渲染结果，不作为线上官方原文或签发证明。", label))
        if index < len(document["pages"]):
            story.append(PageBreak())
    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    return pdf_path


def render_pdf(document: dict, pdf_path: Path) -> list[str]:
    target_dir = RENDERED / document["documentId"]
    target_dir.mkdir(parents=True, exist_ok=True)
    pdf = fitz.open(pdf_path)
    pages = []
    for page_index, page in enumerate(pdf, start=1):
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.55, 1.55), alpha=False)
        output_path = target_dir / f"page-{page_index}.png"
        pixmap.save(output_path)
        pages.append(f"/regulations/rendered/{document['documentId']}/page-{page_index}.png")
    pdf.close()
    return pages


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    RENDERED.mkdir(parents=True, exist_ok=True)
    register_font()
    manifest = {"sourceType": "local-regulation-pack", "renderEngine": "PyMuPDF", "documents": []}
    for document in DOCUMENTS:
        pdf_path = build_pdf(document)
        rendered_pages = render_pdf(document, pdf_path)
        manifest["documents"].append({
            "documentId": document["documentId"],
            "documentTitle": document["documentTitle"],
            "shortTitle": document["shortTitle"],
            "subject": document["subject"],
            "sourceType": "local-regulation-pack",
            "pdfPath": f"/regulations/{document['documentId']}.pdf",
            "pageCount": len(rendered_pages),
            "renderedPages": rendered_pages,
        })
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

