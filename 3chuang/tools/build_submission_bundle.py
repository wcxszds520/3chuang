from __future__ import annotations

import json
import os
import re
import shutil
import textwrap
import zipfile
from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION_START
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "output" / "project-report"
FINAL = ROOT / "output" / "final-submission"
GEN = WORK / "assets" / "generated"
REAL = WORK / "assets" / "screenshots-real"
FINAL.mkdir(parents=True, exist_ok=True)

PROJECT_TITLE = "甬柜易算：基于数字孪生的宁波港出海企业装箱与合规 SaaS 引擎"
TEAM = "科院勇敢"
MEMBERS = "王慈煊、赵莹莹"
ADVISOR = "刘慰"
SCHOOL = "宁波大学科学技术学院"
COLLEGE = "信息工程学院"
TRACK = "人工智能创新赛"
REPORT_DATE = "2026年7月"

JADE = "174F43"
BLUE = "3F7182"
AMBER = "D78643"
OFFWHITE = "F4F1EA"
LIGHT = "E9EFEC"
INK = "17231F"
GRAY = "69756F"
RED = "A84335"


def set_cell_shading(cell, fill: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=80, start=100, bottom=80, end=100):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_row_cant_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    cant = OxmlElement("w:cantSplit")
    tr_pr.append(cant)


def set_keep_with_next(paragraph, value=True):
    p_pr = paragraph._p.get_or_add_pPr()
    keep = p_pr.find(qn("w:keepNext"))
    if value and keep is None:
        keep = OxmlElement("w:keepNext")
        p_pr.append(keep)
    elif not value and keep is not None:
        p_pr.remove(keep)


def set_keep_lines(paragraph, value=True):
    p_pr = paragraph._p.get_or_add_pPr()
    keep = p_pr.find(qn("w:keepLines"))
    if value and keep is None:
        keep = OxmlElement("w:keepLines")
        p_pr.append(keep)


def set_page_break_before(paragraph, value=True):
    p_pr = paragraph._p.get_or_add_pPr()
    node = p_pr.find(qn("w:pageBreakBefore"))
    if value and node is None:
        node = OxmlElement("w:pageBreakBefore")
        p_pr.append(node)


def add_field(paragraph, instruction: str, placeholder: str = ""):
    run = paragraph.add_run()
    fld_char = OxmlElement("w:fldChar")
    fld_char.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = placeholder
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([fld_char, instr, separate, text, end])
    return run


def set_run_font(run, name="宋体", size=10.5, bold=False, color=INK, italic=False):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def style_paragraph(paragraph, size=10.5, name="宋体", color=INK, bold=False):
    for run in paragraph.runs:
        set_run_font(run, name=name, size=size, bold=bold, color=color)


def set_width(cell, width_cm):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(int(width_cm * 567)))
    tc_w.set(qn("w:type"), "dxa")


def image_size_for_width(path: Path, width_cm: float):
    with Image.open(path) as im:
        w, h = im.size
    return Cm(width_cm), Cm(width_cm * h / w)


def configure_document(doc: Document, title: str):
    sec = doc.sections[0]
    sec.page_width = Cm(21.0)
    sec.page_height = Cm(29.7)
    sec.top_margin = Cm(2.15)
    sec.bottom_margin = Cm(2.0)
    sec.left_margin = Cm(2.25)
    sec.right_margin = Cm(2.15)
    sec.header_distance = Cm(0.9)
    sec.footer_distance = Cm(0.85)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "宋体"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.line_spacing = 1.12
    normal.paragraph_format.first_line_indent = Cm(0.74)
    normal.paragraph_format.space_after = Pt(3)

    heading_specs = {
        "Title": ("黑体", 24, JADE, True, 0),
        "Heading 1": ("黑体", 17, JADE, True, 0),
        "Heading 2": ("黑体", 13.5, INK, True, 0),
        "Heading 3": ("黑体", 11.5, BLUE, True, 0),
    }
    for style_name, (font, size, color, bold, indent) in heading_specs.items():
        st = styles[style_name]
        st.font.name = font
        st._element.rPr.rFonts.set(qn("w:eastAsia"), font)
        st.font.size = Pt(size)
        st.font.bold = bold
        st.font.color.rgb = RGBColor.from_string(color)
        st.paragraph_format.first_line_indent = Cm(indent)
        st.paragraph_format.space_before = Pt(7 if style_name != "Title" else 0)
        st.paragraph_format.space_after = Pt(4)
        st.paragraph_format.keep_with_next = True

    for name, font, size, color, align in [
        ("Figure Caption", "宋体", 9, INK, WD_ALIGN_PARAGRAPH.CENTER),
        ("Table Caption", "宋体", 9, INK, WD_ALIGN_PARAGRAPH.CENTER),
        ("Source Note", "宋体", 8, GRAY, WD_ALIGN_PARAGRAPH.CENTER),
        ("Small Note", "宋体", 8.5, GRAY, WD_ALIGN_PARAGRAPH.LEFT),
    ]:
        if name not in styles:
            st = styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        else:
            st = styles[name]
        st.font.name = font
        st._element.rPr.rFonts.set(qn("w:eastAsia"), font)
        st.font.size = Pt(size)
        st.font.color.rgb = RGBColor.from_string(color)
        st.paragraph_format.alignment = align
        st.paragraph_format.first_line_indent = Cm(0)
        st.paragraph_format.space_before = Pt(2)
        st.paragraph_format.space_after = Pt(3)

    props = doc.core_properties
    props.title = title
    props.subject = "第二十八届中国机器人及人工智能大赛人工智能创新赛项目研究报告"
    props.author = TEAM
    props.keywords = "甬柜易算, 多约束三维装箱, 3D作业复核, 港前合规, 微信小程序"


def add_header_footer(doc: Document, header_text: str):
    for idx, sec in enumerate(doc.sections):
        sec.header.is_linked_to_previous = False
        sec.footer.is_linked_to_previous = False
        hp = sec.header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        hp.text = header_text if idx > 0 else ""
        style_paragraph(hp, size=8.5, color=GRAY)
        fp = sec.footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if idx > 0:
            fp.add_run("第 ")
            add_field(fp, "PAGE", "1")
            fp.add_run(" 页 / 共 ")
            add_field(fp, "NUMPAGES", "1")
            fp.add_run(" 页")
            style_paragraph(fp, size=8.5, color=GRAY)


def add_body(doc: Document, text: str, *, bold=False, color=INK, first_indent=True, align=None):
    p = doc.add_paragraph()
    if not first_indent:
        p.paragraph_format.first_line_indent = Cm(0)
    if align is not None:
        p.alignment = align
    r = p.add_run(text)
    set_run_font(r, size=10.5, bold=bold, color=color)
    set_keep_lines(p)
    return p


def add_bullets(doc: Document, items, level=0):
    for item in items:
        p = doc.add_paragraph(style="List Bullet" if level == 0 else "List Bullet 2")
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.left_indent = Cm(0.74 + level * 0.5)
        r = p.add_run(item)
        set_run_font(r, size=10.2)
        set_keep_lines(p)


def add_caption(doc: Document, kind: str, title: str):
    style = "Figure Caption" if kind == "图" else "Table Caption"
    p = doc.add_paragraph(style=style)
    set_keep_with_next(p)
    r = p.add_run(f"{kind}")
    set_run_font(r, size=9, bold=True)
    add_field(p, f"SEQ {kind} \\* ARABIC", "1")
    r = p.add_run(f"  {title}")
    set_run_font(r, size=9, bold=True)
    return p


def add_figure(doc: Document, path: Path, title: str, source: str, width_cm=15.7, note: str | None = None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(5)
    w, h = image_size_for_width(path, width_cm)
    max_h = Cm(15.6)
    if h > max_h:
        scale = max_h / h
        w = int(w * scale)
        h = max_h
    p.add_run().add_picture(str(path), width=w, height=h)
    add_caption(doc, "图", title)
    sp = doc.add_paragraph(style="Source Note")
    sp.add_run(f"来源：{source}")
    if note:
        np = doc.add_paragraph(style="Small Note")
        np.add_run(f"注：{note}")
    return p


def add_table(doc: Document, title: str, headers, rows, widths=None, font_size=8.8, note: str | None = None):
    add_caption(doc, "表", title)
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.style = "Table Grid"
    hdr = table.rows[0]
    set_repeat_table_header(hdr)
    for j, val in enumerate(headers):
        cell = hdr.cells[j]
        cell.text = str(val)
        set_cell_shading(cell, JADE)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_margins(cell)
        if widths:
            set_width(cell, widths[j])
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.first_line_indent = Cm(0)
            for run in p.runs:
                set_run_font(run, size=font_size, bold=True, color="FFFFFF")
    for i, row in enumerate(rows):
        tr = table.add_row()
        set_row_cant_split(tr)
        for j, val in enumerate(row):
            cell = tr.cells[j]
            cell.text = str(val)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)
            if widths:
                set_width(cell, widths[j])
            if i % 2:
                set_cell_shading(cell, "F3F6F4")
            for p in cell.paragraphs:
                p.paragraph_format.first_line_indent = Cm(0)
                p.paragraph_format.space_after = Pt(0)
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT if j else WD_ALIGN_PARAGRAPH.CENTER
                for run in p.runs:
                    set_run_font(run, size=font_size)
    if note:
        p = doc.add_paragraph(style="Small Note")
        p.add_run(f"注：{note}")
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return table


def add_chapter(doc: Document, title: str):
    p = doc.add_heading(title, level=1)
    return p


def add_section(doc: Document, title: str, paragraphs, bullets=None):
    doc.add_heading(title, level=2)
    for text in paragraphs:
        add_body(doc, text)
    if bullets:
        add_bullets(doc, bullets)


def add_front_cover(doc: Document):
    sec = doc.sections[0]
    sec.top_margin = Cm(1.25)
    sec.bottom_margin = Cm(1.2)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    r = p.add_run("第二十八届中国机器人及人工智能大赛")
    set_run_font(r, name="黑体", size=15, bold=True, color=JADE)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    r = p.add_run("人工智能创新赛 · 项目研究报告")
    set_run_font(r, name="黑体", size=13, bold=True, color=BLUE)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(14)
    r = p.add_run(PROJECT_TITLE)
    set_run_font(r, name="黑体", size=23, bold=True, color=INK)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.add_run().add_picture(str(GEN / "fig01-cover-visual.png"), width=Cm(9.4), height=Cm(9.4 * 1.5))

    meta = [
        ("团队名称", TEAM), ("项目成员", MEMBERS), ("指导教师", ADVISOR),
        ("学校", SCHOOL), ("学院", COLLEGE), ("赛项", TRACK), ("完成时间", REPORT_DATE)
    ]
    for label, value in meta:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(f"{label}：{value}")
        set_run_font(r, name="宋体", size=10.5, color=INK)


def add_front_matter(doc: Document):
    sec = doc.add_section(WD_SECTION_START.NEW_PAGE)
    sec.page_width = Cm(21.0)
    sec.page_height = Cm(29.7)
    sec.top_margin = Cm(2.15)
    sec.bottom_margin = Cm(2.0)
    sec.left_margin = Cm(2.25)
    sec.right_margin = Cm(2.15)

    doc.add_heading("原创性与真实性说明", level=1)
    add_body(doc, "本报告所述项目由团队围绕港前装柜决策场景开展研究与实现。报告中的项目事实依据当前仓库代码、运行记录、测试输出和事实核查文件形成；外部研究现状依据正式论文、国际组织官网和产品官方资料形成。对未完成、仅部分实现或验证不足的能力，均按现状表述，不以规划内容替代当前成果。")
    add_body(doc, "项目当前形态为具备SaaS工作流形态的轻量化Web系统原型，并配套原生微信小程序代码。报告不主张成熟多租户、正式商业部署、企业用户、订阅计费、营收或持续集成流水线。演示结果仅对应锁定订单NB2026-DEMO-01，不代表系统平均水平。")
    add_body(doc, "申报前，团队成员应结合实际项目日志确认第十三章分工口径。以下签名栏与日期栏保持空白，由申报者在正式提交时手写。")
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(18)
    p.add_run("项目成员签字：____________________    ____________________")
    style_paragraph(p, size=10.5)
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    p.add_run("指导教师确认：____________________    日期：______年____月____日")
    style_paragraph(p, size=10.5)

    doc.add_page_break()
    doc.add_heading("摘要", level=1)
    abstract = (
        "针对宁波港及一般海运出口场景中中小出口企业依赖经验装柜、柜型比较与装载顺序脱节、三维结果难以转化为现场作业指令、合规风险常在装柜后才暴露等问题，本项目构建“甬柜易算”装箱与合规系统。系统以真实SKU尺寸、重量、数量和业务属性为输入，由后端多约束三维装箱算法生成柜型方案、三维坐标、装载顺序、未装清单和结果指标；Web端将坐标转化为可播放、暂停、跳步和复核的Three.js作业过程，并通过确定性规则、AI辅助解释和人工复核形成港前预审链路。当前实现由React/Vite Web端、Node.js/Express后端、MySQL数据结构和原生微信小程序组成，属于面向SaaS化交付的装箱与合规系统原型。"
        "项目的核心研究不在于宣称三维装箱理论首创，而在于面向真实业务将LIFO与卸货顺序、重心平衡、SKU聚集、堆叠安全、搬运可达性和VGM重量约束组织为六类业务约束协同机制，并把算法结果贯通到三维作业复核和合规证据链。锁定演示订单NB2026-DEMO-01输入221件、装入221件、未装0 件、空间利用率84.51%，合规结果为本地规则 WARNING / AI建议 PASS / 人工复核独立；该结果仅代表一次演示订单。Web lint和生产构建通过，Web测试为75/76通过；后端核心算法定向测试25/25通过，但完整后端测试未在本轮运行态下全部完成。当前仍存在微信小程序导出空壳、后端原生PDF未实现、法规原文页码联动未完成、人工搬运表达验证不足以及多租户与部署能力未形成等限制。"
    )
    add_body(doc, abstract)
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    r = p.add_run("关键词：")
    set_run_font(r, bold=True, size=10.5)
    r = p.add_run("港前装柜；多约束三维装箱；三维作业复核；VGM；CTU Code；AI辅助解释；微信小程序")
    set_run_font(r, size=10.5)

    doc.add_page_break()
    doc.add_heading("目录", level=1)
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    add_field(p, 'TOC \\o "1-1" \\h \\z \\u', "更新域后显示目录")

    doc.add_page_break()
    doc.add_heading("图目录", level=1)
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    add_field(p, 'TOC \\h \\z \\c "图"', "更新域后显示图目录")

    doc.add_page_break()
    doc.add_heading("表目录", level=1)
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    add_field(p, 'TOC \\h \\z \\c "表"', "更新域后显示表目录")


def add_evidence_image(doc: Document, path: Path, code: str, title: str, source: str,
                       width_cm=15.7, note: str | None = None):
    """Add a real runtime capture without consuming the numbered concept-figure sequence."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(5)
    w, h = image_size_for_width(path, width_cm)
    max_h = Cm(15.0)
    if h > max_h:
        scale = max_h / h
        w = int(w * scale)
        h = max_h
    p.add_run().add_picture(str(path), width=w, height=h)
    cp = doc.add_paragraph(style="Figure Caption")
    r = cp.add_run(f"运行截图 {code}  {title}")
    set_run_font(r, size=9, bold=True)
    sp = doc.add_paragraph(style="Source Note")
    sp.add_run(f"来源：{source}")
    if note:
        np = doc.add_paragraph(style="Small Note")
        np.add_run(f"注：{note}")


GENERATED_SOURCE = "GPT Image 2生成的结构示意图；术语、箭头和事实边界由项目证据文件校核"
RUNTIME_SOURCE = "项目真实运行界面，2026-07-11；锁定10 SKU演示数据集经当前后端重新计算"


TABLES = {
    1: {
        "title": "目标用户与核心需求",
        "headers": ["用户角色", "主要任务", "核心需求", "当前支持边界"],
        "rows": [
            ["中小出口企业业务人员", "整理订单并选择柜型", "低门槛录入、方案比较、未装清单", "Web原型支持；尚无企业级租户体系"],
            ["货代配载人员", "形成可执行装柜方案", "装载坐标、顺序、空间与重量指标", "支持单订单工作流；需人工核验业务属性"],
            ["仓库与装柜现场人员", "按顺序完成装柜", "门端明确、步骤可复核、异常可定位", "3D可视化已实现；人工作业表达仍需验证"],
            ["合规复核人员", "港前识别风险并留痕", "规则结果、证据字段、人工复核入口", "确定性规则为主；法规原文页码联动未完成"],
            ["管理与交付人员", "汇总订单结果", "HTML、CSV、JSON和打印交付", "Web端支持；后端原生PDF与小程序导出未完成"],
        ],
        "widths": [2.9, 3.5, 5.0, 5.0],
    },
    2: {
        "title": "系统功能模块",
        "headers": ["模块", "主要输入", "主要输出", "完成状态"],
        "rows": [
            ["订单与SKU", "订单、尺寸、重量、数量、业务属性", "规范化货物清单", "Web已实现；数据质量依赖人工核验"],
            ["柜型与装箱", "货物清单、柜型参数、约束", "坐标、顺序、未装清单、指标", "核心链路已实现"],
            ["3D作业复核", "装载坐标与步骤", "门端视图、逐步动画、复核视角", "主要能力已实现；非物理仿真"],
            ["港前合规", "重量、重心、堆叠、港序、材料字段", "规则结论、风险说明、复核状态", "规则链路已实现；法规原文联动不完整"],
            ["AI辅助解释", "确定性规则输出和上下文", "可读风险解释与建议", "辅助能力；不可替代规则或人工判断"],
            ["报告与导出", "方案与审查结果", "HTML、CSV、JSON、浏览器打印", "Web端可用；原生PDF未完成"],
            ["微信小程序", "订单和工作流入口", "移动端页面与状态查看", "原生代码可编译；导出页为空壳"],
        ],
        "widths": [2.8, 4.6, 5.0, 4.1],
    },
    3: {
        "title": "技术栈",
        "headers": ["层次", "技术", "用途", "审计口径"],
        "rows": [
            ["Web前端", "React、Vite、TypeScript/JavaScript", "订单、方案、合规和报告工作流", "生产构建通过"],
            ["三维呈现", "Three.js及浏览器图形能力", "坐标驱动的装柜作业可视化", "属工程复核可视化，不是物理仿真"],
            ["后端", "Node.js、Express", "接口编排、装箱计算、规则审查", "核心算法定向测试通过；完整测试未全部完成"],
            ["数据", "MySQL结构与会话数据", "订单、货物、方案和审查信息", "原型数据链路；无成熟租户隔离证明"],
            ["移动端", "微信小程序原生框架", "移动端工作流入口", "可编译；功能覆盖低于Web端"],
            ["AI辅助", "大语言模型调用接口", "规则结果的解释和表达", "可降级；不参与确定性结论计算"],
        ],
        "widths": [2.6, 4.5, 5.5, 4.0],
    },
    4: {
        "title": "Web与微信小程序功能对照",
        "headers": ["能力", "Web端", "微信小程序", "报告表述"],
        "rows": [
            ["订单与货物", "主要工作流已实现", "存在相关页面", "Web为主操作端"],
            ["柜型与装箱计算", "已接入后端链路", "覆盖有限", "小程序不作为完整计算证据"],
            ["3D作业复核", "可播放、暂停、跳步和多视角", "未形成同等能力", "以Web运行证据为准"],
            ["合规预审", "规则结果和复核流程可见", "覆盖有限", "结论仍由确定性规则和人工复核承担"],
            ["导出", "HTML、CSV、JSON、浏览器打印", "export页面为空壳", "不得宣称小程序导出已完成"],
            ["交付形态", "轻量化Web系统原型", "原生微信小程序代码", "不表述为完整Android或iOS应用"],
        ],
        "widths": [3.0, 5.0, 4.1, 4.6],
    },
    5: {
        "title": "后端核心接口",
        "headers": ["接口类别", "典型职责", "关键输入", "关键输出/边界"],
        "rows": [
            ["健康与状态", "检查服务可访问性", "无或基础参数", "服务状态；不代表业务功能全部通过"],
            ["订单与货物", "读取、规范化和保存业务数据", "订单、SKU、数量、尺寸、重量", "订单上下文与货物清单"],
            ["装箱计算", "调用算法编排器生成方案", "货物、柜型、六类约束", "坐标、顺序、装入/未装、指标"],
            ["合规预审", "执行确定性规则并组织证据字段", "装箱结果、业务属性、材料状态", "PASS/风险项/人工复核状态"],
            ["报告与导出", "生成前端可用交付数据", "方案、审查结果", "HTML/结构化数据；无后端原生PDF"],
        ],
        "widths": [3.0, 4.2, 5.0, 4.5],
    },
    6: {
        "title": "算法输入与输出",
        "headers": ["类别", "字段/对象", "含义", "校验与边界"],
        "rows": [
            ["输入", "SKU尺寸、重量、数量", "离散箱体及总质量", "单位、正值和完整性需校验"],
            ["输入", "目的港/卸货顺序", "LIFO及港序约束依据", "依赖业务人员准确录入"],
            ["输入", "可旋转、堆叠与搬运属性", "候选姿态和安全约束", "属性缺失会降低方案可信度"],
            ["输入", "柜型尺寸与最大载重", "几何边界和VGM重量边界", "采用项目配置参数，提交前需与实际箱型核对"],
            ["输出", "位置、旋转和装载顺序", "3D放置与作业复核基础", "为离散坐标结果，不代表连续物理仿真"],
            ["输出", "装入与未装清单", "明确可装范围和剩余货物", "允许存在未装货物"],
            ["输出", "利用率、重量与重心指标", "方案比较和风险判断", "演示值仅对应单一订单"],
        ],
        "widths": [2.0, 4.0, 5.4, 5.3],
    },
    7: {
        "title": "六类约束及其作用",
        "headers": ["约束", "业务目标", "工程处理", "现状边界"],
        "rows": [
            ["LIFO与卸货顺序", "减少倒箱和港序冲突", "在排序、候选位置与结果复核中体现", "依赖目的港数据质量"],
            ["重心平衡", "控制偏载风险", "累计质量并评估纵横向重心", "不替代船级社或现场称重判断"],
            ["SKU聚集", "减少同类货物分散", "相邻性与分区偏好", "可能与利用率目标发生冲突"],
            ["堆叠安全", "降低悬空、超载和脆弱品受压", "支撑面、层级和属性检查", "尚非材料力学仿真"],
            ["搬运可达性", "保证门端和叉车路径可解释", "门端、顺序和路径复核", "人工搬运表达验证不足"],
            ["VGM重量约束", "避免超过柜型允许载重", "累计重量上限与审查规则", "最终VGM仍需合规称重程序"],
        ],
        "widths": [3.0, 4.3, 5.0, 4.4],
    },
    8: {
        "title": "3D状态机",
        "headers": ["状态", "含义", "允许操作", "异常处理"],
        "rows": [
            ["待机", "已加载方案但未开始", "选择视角、开始、跳转", "输入缺失时阻断"],
            ["取货", "目标货物被识别和抬取", "暂停、继续", "货物或步骤不存在则回退"],
            ["运输", "货物随叉车向门端移动", "暂停、倍速、视角切换", "路径异常时停止并保留步骤"],
            ["入柜", "货物穿过唯一门端", "暂停、逐步查看", "碰撞或越界需阻断"],
            ["放置", "货物落在目标坐标", "复核当前件和累计结果", "放置失败则不进入完成态"],
            ["完成/阻断", "步骤结束或异常停止", "下一步、重置、人工检查", "保留异常上下文"],
        ],
        "widths": [2.7, 4.8, 4.7, 4.5],
    },
    9: {
        "title": "合规规则矩阵",
        "headers": ["规则主题", "主要依据", "系统检查", "边界与人工责任"],
        "rows": [
            ["VGM", "IMO/SOLAS官方说明[7]", "货物累计重量、柜重字段和上限风险", "系统预审不替代经认可方法取得的VGM"],
            ["CTU装载安全", "IMO/ILO/UNECE CTU Code[8]", "重心、堆叠、支撑、门端与顺序风险", "不替代现场绑扎、固定和专业签署"],
            ["木质包装", "IPPC ISPM 15[9]", "木包装属性、处理/标识材料状态", "法规原文页码与高亮联动未完成"],
            ["港序/LIFO", "业务顺序与项目规则", "目的港次序和可达性冲突", "输入错误会直接影响结果"],
            ["人工复核", "项目工作流", "记录待核项、说明和状态", "当前为有限流程，不宣称完整审批系统"],
        ],
        "widths": [2.8, 4.2, 5.0, 4.7],
    },
    10: {
        "title": "AI职责与禁止事项",
        "headers": ["事项", "AI可承担", "AI不得承担", "降级方式"],
        "rows": [
            ["风险表达", "把规则结果转为清晰说明", "改写或覆盖规则结论", "直接展示确定性规则和证据字段"],
            ["材料提示", "基于缺失字段提示补充方向", "虚构已提交材料或法规条文", "列出缺失项并转人工确认"],
            ["方案解释", "说明利用率、重心和未装原因", "重新计算坐标或擅自承诺全装", "回退到算法原始输出"],
            ["问答辅助", "回答系统内术语和流程问题", "给出具有法律效力的合规结论", "提示咨询专业人员"],
            ["失败处理", "返回不可用状态", "在无依据时生成确定性结论", "保持规则链路可用并记录失败"],
        ],
        "widths": [2.6, 5.1, 5.1, 3.9],
    },
    11: {
        "title": "演示订单结果",
        "headers": ["指标", "结果", "解释口径"],
        "rows": [
            ["订单号", "NB2026-DEMO-01", "锁定10 SKU演示订单"],
            ["推荐柜型", "40HQ", "本次演示计算结果"],
            ["输入数量", "221件", "算法输入总件数"],
            ["装入数量", "221件", "生成有效装载坐标的件数"],
            ["未装数量", "0件", "明确保留在未装清单中"],
            ["空间利用率", "84.51%", "仅代表本次演示订单"],
            ["合规结果", "本地规则 WARNING / AI建议 PASS / 人工复核独立", "锁定演示证据中的预审结果，不替代法定审查"],
        ],
        "widths": [4.0, 4.5, 8.2],
    },
    12: {
        "title": "测试结果",
        "headers": ["验证项", "结果", "日期/范围", "结论边界"],
        "rows": [
            ["Web lint", "通过", "2026-07-11当前工作树", "静态检查通过"],
            ["Web测试", "75/76通过", "21个测试文件", "1项来源标识断言未通过，不能写成全部通过"],
            ["Web生产构建", "通过", "1630个模块，约28.31秒", "说明当前前端可构建"],
            ["后端核心算法定向测试", "25/25通过", "2个测试套件", "只覆盖所选核心算法与编排测试"],
            ["后端完整测试", "未全部完成", "运行服务/端口占用条件", "不得外推为后端全量通过"],
            ["真实页面与接口", "可访问并完成锁定数据重算", "本机Web 5173、后端3000", "本地运行证据，不等于生产部署"],
        ],
        "widths": [3.8, 3.4, 4.3, 5.2],
    },
    13: {
        "title": "项目创新点与相关研究差异",
        "headers": ["创新点", "相关基础", "本项目差异", "边界"],
        "rows": [
            ["六类约束协同装箱", "三维装箱、稳定性与港序研究[1-6]", "把六类业务约束落到同一工程链路", "不主张基础装箱理论首创"],
            ["坐标到3D作业复核", "装载规划产品与物流仿真[10-12]", "同一坐标结果驱动门端、步骤和复核视图", "当前不是工业级数字孪生"],
            ["装箱与港前合规融合", "VGM、CTU Code、ISPM 15[7-9]", "计算结果直接进入规则证据链", "法规页码联动尚未完成"],
            ["确定性规则与AI分工", "自动生成与解释类产品[13]", "规则负责结论，AI负责可读解释并可降级", "不把AI文本当法定结论"],
            ["中小企业贯通式工作流", "商业装载/仿真/生成工具[10-13]", "订单、装箱、3D、合规和交付在轻量原型中贯通", "尚无商业部署与成熟多租户"],
        ],
        "widths": [3.2, 4.2, 5.1, 4.2],
    },
    14: {
        "title": "当前问题与改进计划",
        "headers": ["问题", "当前影响", "改进方向", "优先级"],
        "rows": [
            ["未装货物较多时缺少二次分配", "方案需要人工继续处理", "增加多柜联算、拆单和未装原因分类", "高"],
            ["小程序导出页为空壳", "移动交付链不闭合", "实现结构化报告查看与安全分享", "高"],
            ["后端原生PDF缺失", "一致性与归档能力有限", "增加服务端模板、字体嵌入和审计水印", "中"],
            ["法规原文页码联动缺失", "证据追溯效率不足", "建立版本化法规库、页码定位和高亮", "高"],
            ["人工搬运表达验证不足", "现场可执行性证据有限", "与仓库人员开展任务测试和路径校核", "高"],
            ["后端完整测试未完成", "回归置信度有限", "隔离测试端口、补充夹具并完成全量回归", "高"],
            ["多租户与部署能力未形成", "不能支撑正式运营", "后续再设计租户隔离、权限、审计和运维", "中"],
            ["缺少CI/CD", "交付依赖人工", "建立可复现构建、自动测试和发布门禁", "中"],
        ],
        "widths": [4.1, 4.1, 6.1, 2.4],
    },
    15: {
        "title": "团队分工",
        "headers": ["角色", "建议归档的工作范围", "提交前核验要求"],
        "rows": [
            ["王慈煊", "项目成员；具体模块、文档和测试贡献以实际提交记录补充", "核对提交日志、文件作者和演示分工后手写确认"],
            ["赵莹莹", "项目成员；具体模块、调研和验证贡献以实际提交记录补充", "核对提交日志、调研记录和答辩分工后手写确认"],
            ["刘慰", "指导教师；对研究方向、事实边界和竞赛表达提供指导", "由本人确认指导内容，不代签"],
            ["团队共同工作", "需求梳理、联调、演示订单复核、材料核查与答辩准备", "不虚构工时、提交量或独占模块"],
        ],
        "widths": [3.1, 7.3, 6.3],
    },
    16: {
        "title": "评分项与报告证据映射",
        "headers": ["评分维度", "主要证据", "报告位置", "答辩注意事项"],
        "rows": [
            ["可行性与实用性", "真实页面、锁定演示结果、工作流与导出能力", "第4、6、9、11章", "说明单次演示边界"],
            ["技术难度", "算法、坐标映射、状态机、规则链和接口", "第5、7、8章", "区分算法、可视化和AI职责"],
            ["创新度", "五项创新与文献/产品对照", "第2、10章", "不主张基础理论首创"],
            ["完成度", "测试表、截图和未完成项", "第9、12章", "主动披露缺口"],
            ["队员贡献", "经日志核验后的分工记录", "第13章", "赛前补充可核查证据"],
            ["材料与表达", "图表、引用、证据索引和附件", "全文及佐证汇编", "生成图不作为运行证据"],
        ],
        "widths": [3.0, 5.4, 3.6, 4.7],
    },
}


def put_table(doc: Document, number: int, note: str | None = None):
    spec = TABLES[number]
    return add_table(doc, spec["title"], spec["headers"], spec["rows"],
                     widths=spec.get("widths"), note=note)


def build_main_report() -> Path:
    doc = Document()
    configure_document(doc, PROJECT_TITLE)
    add_front_cover(doc)
    add_front_matter(doc)

    add_chapter(doc, "第一章 项目概述")
    add_section(doc, "1.1 项目背景", [
        "宁波舟山港所连接的外贸供应链具有订单碎片化、货物属性多样、交付窗口紧和参与主体多的特点。对中小出口企业而言，装柜并非单纯追求空间占用率，而是需要同时处理柜型、重量、卸货顺序、堆叠关系、门端可达和单证合规。传统经验配载在小批量、多SKU和频繁变更条件下容易产生重复试装、现场倒箱和信息传递失真。",
        "三维装箱研究已形成丰富的启发式与精确方法，集装箱装载研究也持续讨论稳定性、承载和多目的港约束[1-6]。本项目选择工程贯通作为切入点：以订单数据为入口，在同一条链路中生成装箱结果、3D作业复核、港前规则预审和交付材料，从而降低算法结果与现场执行之间的断层。"
    ])
    add_figure(doc, GEN / "fig01-cover-visual-landscape-alt.png", "报告封面主视觉", GENERATED_SOURCE,
               note="概念图用于说明港前装柜、三维复核和合规协同的研究对象，不作为系统运行证据。")
    add_section(doc, "1.2 现实业务问题", [
        "业务调研归纳出四类相互关联的问题：一是SKU数据和柜型信息分散，方案比较依赖个人经验；二是几何可装并不等于业务可执行，港序、重心、支撑和搬运路径需要共同约束；三是坐标清单难以直接指导现场，装柜顺序和门端关系缺少直观表达；四是VGM、CTU装载安全和木质包装等要求往往在流程后段才被核对。"
    ])
    add_figure(doc, GEN / "fig02-preport-scene.png", "港前装柜业务场景", GENERATED_SOURCE,
               note="工业场景示意图，不表现任何真实企业、港区或生产部署。")
    add_section(doc, "1.3 目标用户", [
        "目标用户包括中小出口企业业务人员、货代配载人员、仓库或装柜现场人员、合规复核人员和报告交付人员。系统并不替代专业货代、码头、承运人与监管机构，而是为港前决策提供结构化、可复核的中间成果。"
    ])
    add_section(doc, "1.4 项目定位", [
        "“甬柜易算”定位为具备SaaS工作流形态的轻量化Web系统原型。项目名称中的“数字孪生”体现坐标数据与三维作业视图之间的映射方向；当前实现更准确地属于坐标驱动的3D作业可视化与复核，不主张已经达到工业级数字孪生、实时物理映射或高保真力学仿真水平。"
    ])
    add_section(doc, "1.5 建设目标", [
        "项目建设目标是形成可重复的端到端工作流：从订单与SKU数据出发，完成柜型比较和多约束装箱，生成可回溯的坐标、顺序与未装清单，再以三维视图复核作业过程，以确定性规则完成港前预审，并输出适合沟通和归档的报告数据。"
    ])
    add_figure(doc, GEN / "fig03-users-painpoints.png", "用户角色与核心痛点", GENERATED_SOURCE,
               note="信息图中的角色为业务角色归纳，不代表已签约或已使用系统的企业用户。")
    add_section(doc, "1.6 当前完成状态与系统边界", [
        "当前仓库已经形成Web、后端、算法、3D和小程序代码，核心演示链路可以在本地启动。其完成度应与商业成熟度区分：项目尚未形成成熟多租户、正式部署、付费订阅、真实营收、企业用户或CI/CD证据；小程序导出、后端原生PDF、法规PDF页码联动和部分人工作业表达仍属待完善能力。"
    ])

    add_chapter(doc, "第二章 国内外研究现状")
    add_section(doc, "2.1 三维装箱问题研究", [
        "三维箱体装载问题通常在容器边界内安排不同尺寸与姿态的长方体，目标可涉及装入体积、容器数量、稳定性或作业成本。Bischoff与Ratcliff讨论了面向实际装箱的约束与启发式处理[4]；Bortfeldt与Wäscher系统梳理了集装箱装载问题中的稳定、承载、方向等现实约束[5]。这些研究说明，工程问题不能只以抽象体积利用率衡量。"
    ])
    add_section(doc, "2.2 集装箱装载规划研究", [
        "Ambrosino等将集装箱装载规划建模为复杂的装载决策问题[1]。相关研究关注柜内空间、载重、安全和作业顺序，但学术模型与企业数据流程、交互界面和现场复核之间仍需要大量工程连接。"
    ])
    add_section(doc, "2.3 重心、支撑和稳定性研究", [
        "Junqueira等将装载问题中的稳定性与承载能力纳入研究[6]。在工程系统中，支撑面、堆叠属性、单件重量和累计重心需要通过可解释规则表达；本项目据此避免把几何无重叠等同于装载安全。"
    ])
    add_section(doc, "2.4 多目的港与卸货顺序研究", [
        "Taleb-Ibrahimi等研究了多目的港条件下的装载与倒箱关系[2]，Avriel等讨论了集装箱船积载中的移箱问题[3]。其核心启示是：目的港次序会反向约束装载位置和可达性。项目把LIFO与港序作为业务约束之一，而不是在几何装箱完成后再附加说明。"
    ])
    add_section(doc, "2.5 港口与物流数字孪生研究", [
        "物流仿真和数字孪生强调状态映射、过程复现与决策反馈。AnyLogic等产品可用于供应链与物流过程建模[12]。本项目当前只实现坐标结果到浏览器3D作业视图的映射，因此以“作业复核可视化”描述现状，并把实时设备数据、物理仿真和现场闭环列入后续方向。"
    ])
    add_section(doc, "2.6 合规检索、RAG和人工复核研究", [
        "VGM、CTU Code和ISPM 15分别涉及核实总质量、货运运输单元安全装载以及国际贸易木质包装检疫要求[7-9]。检索增强生成可以改善解释和问答，但法规版本、来源页码和结论责任不能交由生成模型自动替代。本项目采用确定性规则形成结论、AI辅助解释、异常时降级并转人工复核的职责划分。"
    ])
    add_section(doc, "2.7 国内相关研究", [
        "国内三维装箱、港口智能化和出口合规研究与上述国际主题相呼应，通常分别关注算法优化、港航数字化或规则信息化。由于本报告只采用已核实的正式论文与官方材料作为核心引用，未将百科、搜索结果片段或来源不明的二级转述列入正式证据。"
    ])
    add_section(doc, "2.8 商业装载规划产品", [
        "Kaleris的MACS3/StowMan、Herbert-ABS的CargoMax分别面向船舶积载或货物装载与稳性工作[10-11]；AnyLogic侧重通用仿真[12]；Yseop代表规则/数据驱动的自然语言生成类产品[13]。这些官方产品资料用于能力类型对照，不用于证明本项目的新颖性，也不暗示本项目达到同等产业成熟度。"
    ])
    add_section(doc, "2.9 现有研究和产品的不足", [
        "文献与产品对照显示，学术研究往往聚焦单一算法问题，专业商业产品则面向特定行业或大型组织。中小出口企业更需要低门槛的数据入口、清晰的未装结果、可执行的三维顺序和港前规则说明。不同能力之间的数据贯通、责任边界与可追溯性，是本项目重点处理的工程空缺。"
    ])
    add_section(doc, "2.10 本项目的研究切入点", [
        "本项目提出五个查新与创新分析点：六类业务约束协同装箱；真实坐标到3D作业复核；装箱结果与港前合规证据链贯通；确定性规则与AI解释分工；面向中小出口企业与货代的轻量贯通工作流。现有核心文献、规则和产品对照未发现与五点组合完全相同的公开方案，但结论只限于本次检索范围，不等同于法律意义上的专利新颖性判定。"
    ])

    add_chapter(doc, "第三章 需求分析")
    add_section(doc, "3.1 用户角色", ["角色划分遵循“谁录入、谁计算、谁执行、谁复核、谁交付”的业务链。角色可以由同一人兼任，但系统需要保留任务和证据边界。表1给出目标用户、任务与当前支持范围。"])
    put_table(doc, 1)
    add_section(doc, "3.2 典型业务场景", [
        "典型场景从一张待出运订单开始：业务人员导入或录入SKU，配载人员比较柜型并计算方案，仓库人员根据门端与顺序进行复核，合规人员检查重量、堆叠、木包装与港序风险，最后交付结构化结果。方案变化时，应回到同一订单上下文重新计算，避免口头版本漂移。"
    ])
    add_section(doc, "3.3 核心痛点", ["核心痛点可以概括为数据不齐、约束割裂、作业不可视和合规后置。四类痛点不是独立页面需求，而是贯穿输入校验、算法、三维视图和审查链路的设计依据。"])
    add_section(doc, "3.4 功能需求", ["系统需要提供订单与SKU管理、柜型比较、装箱计算、方案查看、3D作业复核、港前合规预审、人工复核入口以及报告与数据导出。表2将在总体方案中按输入、输出和完成状态进一步说明。"])
    add_section(doc, "3.5 性能与可靠性需求", [
        "性能要求以竞赛演示和中小订单原型为边界：计算过程应给出明确状态，前端不能因单次失败丢失输入，三维视图可暂停、继续和复位；接口和AI不可用时应返回可解释错误。当前尚无大规模并发、服务等级或生产容量测试，因此不设置未经验证的吞吐量指标。"
    ])
    add_section(doc, "3.6 合规需求", ["合规链路必须区分规则结论、来源依据、AI解释与人工判断。VGM等结果需要可追溯到输入重量和柜型上限，木包装检查需要可追溯到货物属性与材料状态；缺失信息应标为待核，不能由AI补全。"])
    add_section(doc, "3.7 系统边界", [
        "系统不替代实际称重、检验检疫、海关申报、承运人审核、码头操作或专业绑扎设计；不保证所有货物必然装入；不保证任意数据条件下均获得最优解；不承诺当前原型具备生产级安全、权限、审计和灾备能力。"
    ])

    add_chapter(doc, "第四章 项目研究内容与总体方案")
    add_section(doc, "4.1 项目研究内容", [
        "研究内容由六部分构成：业务数据结构化、多约束三维装箱、柜型与方案比较、3D作业复核、港前规则预审及AI辅助解释、Web与小程序交付。研究评价同时关注计算正确性、业务可执行性、证据可追溯性和系统边界表达。"
    ])
    add_section(doc, "4.2 总体业务闭环", ["总体闭环按照“录入-校验-计算-复核-预审-交付-反馈”组织。任何未装货物、异常规则或人工复核意见都应回流到订单上下文，而不是被摘要页面掩盖。"])
    add_figure(doc, GEN / "fig04-business-loop.png", "项目总体业务闭环", GENERATED_SOURCE,
               note="流程图表示目标工作流；其中小程序导出和法规原文联动仍未完成。")
    add_section(doc, "4.3 系统总体架构", [
        "系统采用前后端分离的原型架构。Web与微信小程序承担交互入口；后端组织订单、计算、合规与报告接口；算法模块输出离散装载结果；Three.js视图消费相同坐标结果；AI接口仅在规则输出之后生成解释。表2列出功能模块及完成状态。"
    ])
    add_figure(doc, GEN / "fig05-system-architecture.png", "系统总体架构", GENERATED_SOURCE,
               note="结构底图不含产品UI，不代表生产部署拓扑。")
    put_table(doc, 2)
    add_section(doc, "4.4 Web、小程序、后端、算法、3D和AI关系", [
        "六类组件通过订单标识和结构化对象协同。算法与确定性规则产生可验证结果；Web和小程序负责展示与交互；3D只解释算法坐标和步骤；AI只解释已有事实。该关系避免把展示层文本反向当作算法结论。"
    ])
    add_figure(doc, GEN / "fig06-component-relationships.png", "Web-微信小程序-后端-算法-3D-AI关系图", GENERATED_SOURCE)
    add_section(doc, "4.5 数据流与接口调用", [
        "核心数据流从订单与货物对象开始，经后端校验后进入算法编排；算法结果形成方案对象，再分别被3D视图、合规规则和报告模块消费。AI解释接收规则结果与经筛选的上下文，不直接修改方案或合规状态。"
    ])
    add_figure(doc, GEN / "fig07-data-flow.png", "核心数据流", GENERATED_SOURCE,
               note="箭头表示逻辑数据流，不表示当前已经部署的消息队列或云服务。")
    add_section(doc, "4.6 技术栈", ["项目技术栈选择以浏览器可交互、JavaScript生态贯通和微信生态入口为主要考虑。表3对技术及验证边界进行说明。"])
    put_table(doc, 3)
    add_section(doc, "4.7 数据结构", [
        "关键数据对象包括订单、SKU、柜型、装载方案、放置记录、未装记录、合规规则结果、人工复核状态和报告数据。放置记录至少需要货物标识、位置、旋转、顺序和重量上下文；合规结果需要规则标识、状态、证据字段、解释与复核状态。"
    ])
    add_section(doc, "4.8 系统运行形态", [
        "本轮审计在本机启动Web与后端服务，真实页面和接口可访问，并以锁定10 SKU数据重新获得221件装入、0 件未装货物与84.51%利用率。该运行形态用于竞赛验证，不代表公网部署或正式运营。表5归纳后端接口类别。"
    ])

    add_chapter(doc, "第五章 多约束三维装箱算法")
    add_section(doc, "5.1 问题定义", [
        "给定若干具有长、宽、高、重量、数量和业务属性的离散货物，以及候选集装箱的内部尺寸与载重边界，目标是在不重叠、不越界的前提下生成可执行放置方案，并尽量改善空间利用、重心、港序、聚集、堆叠和搬运可达性。问题允许存在未装货物，输出必须明确未装原因或至少保留清单。"
    ])
    add_section(doc, "5.2 输入与输出", ["算法输入、输出和校验边界见表6。输入属性的不确定性不会被算法自动消除，因此业务数据质量是计算可信度的前提。"])
    add_section(doc, "5.3 柜型参数", ["柜型对象提供内部尺寸、最大载重和用于比较的基本参数。系统可在候选柜型间进行方案生成与指标比较，但最终选柜还需结合订舱可用性、实际箱况、承运人规定和成本。"])
    add_section(doc, "5.4 坐标系", ["项目采用统一三维坐标表达集装箱内部空间，并把唯一门端固定在高X方向。坐标、货物尺寸和旋转姿态必须使用同一单位；视图相机方向可以变化，但不得改变业务坐标含义，坐标约定见图11。"])
    add_section(doc, "5.5 货物排序", ["货物排序综合考虑尺寸、重量、目的港顺序、堆叠属性与聚集需求。排序用于建立工程上可解释的候选顺序，不宣称对所有实例获得全局最优解。"])
    add_section(doc, "5.6 候选点生成", ["算法从可行放置边界和既有货物表面生成候选点，逐步扩展剩余空间。候选点需要去重、排序并结合门端与业务约束筛选，以避免只按最小坐标贪心造成不可达或港序冲突。"])
    add_section(doc, "5.7 旋转与边界判断", ["对允许旋转的货物枚举合法姿态，先检查柜体边界，再进入碰撞、支撑和业务约束判断。不可旋转或有向上的货物必须保持属性约束，不能为提高利用率任意翻转。"])
    add_section(doc, "5.8 碰撞检测", ["放置候选通过轴对齐箱体的空间区间判断与已放置货物比较。无几何重叠是必要条件，但不是充分条件；仍需检查支撑、承载、重心、港序和门端可达性。图8给出从输入校验到结果比较的完整算法流程。"])
    add_figure(doc, GEN / "fig08-algorithm-flow.png", "多约束三维装箱算法流程", GENERATED_SOURCE,
               note="流程图为代码逻辑归纳，不补造未实现的机器学习优化器。")
    add_section(doc, "5.9 六类业务约束协同机制", ["系统将六类业务约束组织到候选生成、筛选、排序和结果复核过程中。它们不是凭空设定的六个加权维度，也不使用未经证据支持的固定权重公式。各约束作用见表7。"])
    add_figure(doc, GEN / "fig09-six-constraints.png", "六类业务约束关系", GENERATED_SOURCE,
               note="关系图表示约束协同，不表示固定权重或数学求和公式。")
    add_section(doc, "5.10 重量与重心", ["重量约束通过累计货物质量与柜型上限比较；重心由已放置货物质量与中心坐标累计计算，用于识别明显偏载。该结果是港前方案预审指标，不替代法定VGM取得程序、船舶稳性计算或现场专业判断。"])
    add_section(doc, "5.11 SKU聚集", ["同一SKU或同类货物的相邻放置有利于清点、作业和卸货，但可能与空间利用率、港序或支撑安全冲突。系统把聚集作为协同偏好处理，安全与硬边界优先。"])
    add_section(doc, "5.12 支撑与堆叠安全", ["支撑检查关注货物底面与柜底或下层货物的接触关系，堆叠属性限制脆弱品受压和不合理层级。当前处理属于规则化几何与属性检查，尚未模拟包装材料变形、动态冲击或绑扎受力。"])
    add_section(doc, "5.13 LIFO与港序", ["在多目的港业务中，后装货物通常更靠近门端或更早可取，从而减少倒箱。项目将目的港/卸货顺序作用于货物排序、候选偏好和结果复核；缺失或错误港序会直接降低方案可靠性。"])
    add_section(doc, "5.14 搬运可达性", ["搬运可达性通过唯一门端、装载顺序、通道关系和3D路径进行工程复核。当前可视化能够展示叉车与货物的连续步骤，但尚未完成多车型转弯半径、人员安全区和现场障碍的系统验证。"])
    add_section(doc, "5.15 未装货物处理", ["未装货物是算法输出的一部分而非异常数据。系统在演示订单中明确列出0 件未装货物，不声称全部装入。后续应增加未装原因分类、多柜联算、拆单建议和人工调整后重算。"])
    add_section(doc, "5.16 算法流程", ["完整流程包括输入校验、货物展开与排序、候选柜型循环、候选点与姿态生成、硬约束检查、业务约束协同、放置更新、未装记录、指标计算和方案比较。"])
    add_figure(doc, GEN / "fig10-container-selection.png", "柜型比较与装箱方案生成", GENERATED_SOURCE,
               note="柜型推荐为方案比较结果，仍需结合订舱与现场条件人工确认。")
    add_figure(doc, GEN / "fig11-coordinate-door.png", "集装箱坐标系与唯一门端", GENERATED_SOURCE,
               note="技术示意图用于解释坐标和门端约定；实际柜型尺寸以项目配置和现场数据为准。")
    add_section(doc, "5.17 工程特点", ["工程特点包括明确的输入/输出对象、坐标与3D视图复用、未装清单保留、规则结果可追溯以及核心算法可定向测试。设计重点是把算法输出转化为业务可消费对象，而非只输出单一利用率。"])
    add_section(doc, "5.18 当前限制", ["当前算法尚未完成大规模基准实例对比、全局最优性证明、多柜联合优化、材料力学仿真和真实仓库作业实验。报告据此把现状描述为工程原型，不把演示订单结果外推为普遍性能。"])

    add_chapter(doc, "第六章 Web端与微信小程序设计")
    add_section(doc, "6.1 Web总体业务流", ["Web端是当前主要操作界面，串联订单、SKU、柜型、方案、3D、合规和报告。页面状态应围绕同一订单流转，防止演示数据与当前计算结果混用。"])
    add_section(doc, "6.2 当前订单", ["当前订单页面负责显示订单标识、基础属性、货物统计和流程状态。锁定演示使用NB2026-DEMO-01；该编号和结果只用于竞赛演示核验。"])
    add_section(doc, "6.3 货物与SKU管理", ["货物管理需要支持尺寸、重量、数量和业务属性的校验。项目真实页面可加载10 SKU锁定数据集，但现有演示数据不能替代企业主数据治理。"])
    add_section(doc, "6.4 柜型比较", ["柜型比较展示各候选方案的装入数量、未装数量、利用率、重量和风险。推荐结果是算法与业务规则的组合输出，而非价格或订舱承诺。"])
    add_section(doc, "6.5 装箱方案", ["装箱方案页面应同时呈现已装与未装清单、坐标、顺序和关键指标。运行截图R1记录了锁定数据经当前后端重算后的真实页面。"])
    add_evidence_image(doc, REAL / "real01-container-result.png", "R1", "锁定演示数据的真实装箱结果页面", RUNTIME_SOURCE,
                       note="页面显示输入221件、装入221件、未装0 件和84.51%；仅代表一次演示订单。")
    add_section(doc, "6.6 3D作业", ["Web端3D视图消费装箱坐标，并提供门端、顶部、侧面和作业视角。倍速验证以0.5、1、2和4倍为当前证据口径；不以界面中可能出现但未完成专项验证的更高倍速作为报告能力。"])
    add_section(doc, "6.7 合规预审", ["合规页面展示确定性规则结果、风险说明和人工复核状态。由于本轮当前规则数据与锁定演示合规证据存在版本差异，正文不把当前页面局部状态替换为锁定本地规则 WARNING / AI建议 PASS / 人工复核独立结论；版本差异在佐证汇编中单独说明。"])
    add_section(doc, "6.8 报告交付", ["Web现有交付能力主要为HTML、CSV、JSON和浏览器打印。浏览器打印可以另存为PDF，但不等同于后端原生PDF生成服务。"])
    add_section(doc, "6.9 微信小程序功能", ["仓库包含原生微信小程序代码，本轮在微信开发者工具中完成项目打开和编译，并取得首页运行截图。该首页含演示性静态内容，export页面为空壳，因此不用于证明真实计算或导出能力。"])
    add_section(doc, "6.10 Web与小程序差异", ["Web与小程序的当前覆盖范围见表4和图16。系统设计目标是共享订单与结果对象，但现状以Web端完成度为主。"])
    put_table(doc, 4)
    add_body(doc, "为保持图表编号与指定证据映射一致，跨章节使用的后端接口、算法输入输出和六类约束汇总于表5至表7；其详细研究内容分别见第四章和第五章。", first_indent=False)
    put_table(doc, 5)
    put_table(doc, 6)
    put_table(doc, 7)
    add_section(doc, "6.11 当前限制", ["前端仍需完善统一错误处理、无障碍与移动适配；小程序需要补齐真实数据链路、3D替代表达和导出；报告交付需要明确模板版本与审计信息。"])

    add_chapter(doc, "第七章 3D装柜作业复核")
    add_section(doc, "7.1 坐标映射", ["3D层不重新计算装箱方案，而是把后端放置记录映射为货物模型和步骤序列。坐标、旋转和货物尺寸一旦发生变更，应由算法重新输出，避免视图层独立修改业务结果。"])
    add_section(doc, "7.2 集装箱结构", ["集装箱模型以内部边界、底面、侧壁和门端为主要参照，重点服务于空间位置与作业顺序理解，不追求外观渲染或结构有限元精度。"])
    add_section(doc, "7.3 门端与门洞", ["门端统一位于高X方向，门洞是叉车和货物进入柜体的唯一业务入口。多视角只改变观察，不改变门端约定。"])
    add_section(doc, "7.4 作业场地", ["柜外场地用于展示货物等待区、叉车起始位置和入柜路径。场地尺寸是可视化辅助，不作为真实仓库测量或安全区认证。"])
    add_section(doc, "7.5 叉车模型", ["叉车模型承担步骤表达：接近目标、抬取、运输、入柜、放置和退出。它不模拟液压、轮胎、载荷曲线或真实驾驶控制。"])
    add_section(doc, "7.6 货物模型", ["货物模型以SKU颜色、尺寸比例和标识区分，放置后的姿态必须与算法输出一致。颜色仅用于可视化，不代表危险品等级或企业品牌。"])
    add_section(doc, "7.7 路径与碰撞", ["路径用于解释作业顺序并辅助识别明显穿模、越界和门端冲突。当前路径不是完整运动规划，也未覆盖叉车转弯半径、货叉挠度和现场动态障碍。"])
    add_section(doc, "7.8 状态机", ["状态机把每件货物的作业拆为可暂停和可恢复的阶段，使异常定位到具体步骤。图12和表8归纳状态与异常处理。"])
    add_figure(doc, GEN / "fig12-state-machine.png", "3D装柜作业状态机", GENERATED_SOURCE)
    put_table(doc, 8)
    add_section(doc, "7.9 暂停、继续、跳步和倍速", ["控制能力用于答辩演示和复核。跳步应保持货物累计状态一致；暂停和继续不能造成重复放置；倍速只改变播放时间，不改变装载顺序和目标坐标。"])
    add_section(doc, "7.10 作业模式与复核模式", ["作业模式强调连续步骤，复核模式强调门端、顶视、侧视和单步定位。运行截图R2至R5展示同一真实装载结果的不同观察视角。"])
    add_evidence_image(doc, REAL / "real03-twin-door.png", "R2", "门端复核视角", RUNTIME_SOURCE, width_cm=13.8)
    add_evidence_image(doc, REAL / "real04-twin-top.png", "R3", "顶部复核视角", RUNTIME_SOURCE, width_cm=13.8)
    add_evidence_image(doc, REAL / "real05-twin-side.png", "R4", "侧面复核视角", RUNTIME_SOURCE, width_cm=13.8)
    add_evidence_image(doc, REAL / "real06-twin-operation.png", "R5", "作业复核视角", RUNTIME_SOURCE, width_cm=13.8)
    add_section(doc, "7.11 阻断与恢复", ["当方案缺失、货物越界、步骤对象不存在或路径无法解释时，视图应停止推进并保留上下文。恢复应由重新加载、回退步骤或人工确认触发，不能静默跳过失败货物。"])
    add_figure(doc, GEN / "fig13-forklift-sequence.png", "叉车装柜过程", GENERATED_SOURCE,
               note="连续步骤示意图；真实运行中的三个关键动作见运行截图R6至R8。")
    add_evidence_image(doc, REAL / "real14-forklift-sequence-montage.png", "R6-R8", "叉车装柜三个关键步骤", RUNTIME_SOURCE,
                       width_cm=10.2, note="由三张真实运行关键帧纵向合成，未修改页面业务数字；原始截图收录于佐证材料和图像素材包。")
    add_section(doc, "7.12 当前限制", ["3D视图当前用于坐标和流程复核，尚未接入设备实时数据、传感器、物理引擎或仓库数字底图，也未完成系统性现场可用性实验。"])

    add_chapter(doc, "第八章 港前合规与AI辅助")
    add_section(doc, "8.1 合规预审目标", ["港前预审的目标是把明显风险前移到方案形成阶段，以结构化证据提示业务人员补充、调整或转人工判断。系统结论不是法定许可，也不替代承运人、监管机构或专业人员。"])
    add_section(doc, "8.2 确定性规则", ["确定性规则依据输入字段和算法指标计算状态，规则标识、阈值、证据字段和结果需要可复核。AI不可修改规则状态。"])
    add_section(doc, "8.3 VGM", ["SOLAS相关要求强调托运人提供经核实的集装箱总质量，未取得VGM的载货集装箱原则上不得装船[7]。系统可预估并检查重量字段，但最终VGM仍需使用认可方法取得。"])
    add_section(doc, "8.4 CTU Code", ["CTU Code由IMO、ILO和UNECE共同形成，为货运运输单元安全装载提供非强制性全球指导[8]。项目据此组织重心、堆叠、支撑、门端和顺序预审，但不宣称覆盖全部条款。"])
    add_section(doc, "8.5 ISPM 15/IPPC", ["ISPM 15规定国际贸易木质包装材料的植物检疫措施[9]。系统根据木包装属性和材料状态提示核验，尚未实现法规PDF原文页码定位或高亮。"])
    add_section(doc, "8.6 重心、堆叠和卸货顺序", ["这些项目一方面影响装箱计算，另一方面形成合规与作业复核证据。相同数据对象被算法和规则共同引用，可减少结果摘要与原始坐标不一致。合规规则矩阵见表9。"])
    add_figure(doc, GEN / "fig14-compliance-chain.png", "港前合规审查链路", GENERATED_SOURCE,
               note="链路示意图不代表已经获得监管接口或自动审批权限。")
    put_table(doc, 9)
    add_section(doc, "8.7 AI角色与边界", ["AI位于确定性规则之后，负责解释风险、组织提示和改善可读性。AI不重新计算装箱、不决定PASS/风险状态、不编造法规文本，也不代替人工签署。"])
    add_section(doc, "8.8 AI风险解释", ["解释文本应引用规则名称、触发字段和建议动作，同时使用不确定性语言。若上下文缺失，应明确“需补充”而非推测。"])
    add_section(doc, "8.9 人工复核", ["人工复核用于处理业务属性不完整、规则冲突、AI不可用和需要专业判断的事项。当前实现属于有限流程，尚无完整的角色权限、电子签名和审批审计证据。"])
    add_section(doc, "8.10 AI失败降级", ["模型调用失败时，系统仍应显示确定性规则、证据字段和待核事项，并允许人工继续工作。表10列明AI职责、禁止事项和降级方式。"])
    add_figure(doc, GEN / "fig15-ai-boundary.png", "AI角色与确定性算法边界", GENERATED_SOURCE)
    put_table(doc, 10)
    add_body(doc, "图16补充对照Web与微信小程序的当前能力，便于识别移动端尚未完成的导出和深度复核功能。")
    add_figure(doc, GEN / "fig16-web-mini-matrix.png", "Web与微信小程序能力对照", GENERATED_SOURCE,
               note="功能矩阵依据当前代码与运行审计；小程序导出标为未完成。")
    add_section(doc, "8.11 当前限制", ["当前合规知识范围、法规版本管理、原文页码联动、人工复核权限与长期审计仍需完善；系统不具备自动通关、自动报关或法定合规认证能力。"])

    add_chapter(doc, "第九章 系统实现与测试")
    add_section(doc, "9.1 开发环境", ["项目在Windows本地环境完成本轮复核，后端服务监听本机3000端口，Web开发服务监听5173端口，微信小程序在本机开发者工具中打开。端口和机器信息仅为测试环境，不代表生产部署。"])
    add_section(doc, "9.2 Web实现", ["Web端基于React/Vite组织页面与组件，串联订单、货物、方案、3D、合规和报告。当前静态检查和生产构建通过。"])
    add_section(doc, "9.3 微信小程序实现", ["小程序采用原生微信框架。本轮确认代码可在开发者工具打开并编译，但自动化导航受工具连接稳定性限制；首页截图只证明启动，不作为业务数据或导出完成的证据。"])
    add_section(doc, "9.4 后端实现", ["后端基于Node.js/Express组织接口与算法编排。运行态接口可被Web调用，锁定演示数据能够重算得到与项目事实一致的装载数量和利用率。"])
    add_section(doc, "9.5 数据与接口", ["订单和方案通过结构化对象在前后端流转。核心接口类别见表5；当前数据结构具备原型闭环，但尚无成熟租户隔离、细粒度权限和生产审计证明。"])
    add_section(doc, "9.6 算法验证", ["本轮选择快速装箱引擎与算法编排器的两个后端测试套件进行定向验证，25项测试全部通过。该结论仅覆盖所选测试；完整后端测试因运行服务与端口占用条件未全部完成。"])
    add_section(doc, "9.7 3D验证", ["通过真实页面检查门端、顶部、侧面和作业视角，并捕获货物上叉、入柜和到达目标位置的关键帧。验证证明坐标驱动的浏览器3D链路可运行，不代表现场设备或物理精度验证完成。"])
    add_section(doc, "9.8 合规验证", ["锁定项目事实记录NB2026-DEMO-01合规结果为本地规则 WARNING / AI建议 PASS / 人工复核独立。当前运行数据中的局部规则来源与锁定证据存在版本差异，因此报告保留锁定结论并把当前差异作为版本管理问题，不进行无依据覆盖。"])
    add_section(doc, "9.9 测试结果", ["测试结果见表12。Web测试中的单项失败为报告来源标识断言不一致，说明结果可追溯元数据仍需统一。"])
    add_section(doc, "9.10 演示订单结果", ["演示结果见图17和表11。输入总数与装入数不同，报告明确保留0 件未装货物，避免将利用率或PASS状态误读为全部装入或法定合规通过。"])
    add_figure(doc, GEN / "fig17-demo-results.png", "演示订单结果", GENERATED_SOURCE,
               note="数字经项目锁定事实与当前后端重算核对；仅代表NB2026-DEMO-01一次演示。")
    put_table(doc, 11, note="本地规则 WARNING / AI建议 PASS / 人工复核独立为项目锁定演示预审结果，不构成法定合规证明。")
    add_body(doc, "与演示结果相关的本轮构建、前端测试和后端核心算法定向测试汇总见表12。")
    put_table(doc, 12)
    add_section(doc, "9.11 测试限制", ["本轮未完成后端全量测试、端到端高并发测试、真实仓库现场实验、不同设备兼容矩阵、安全渗透测试和生产部署验证。后续结论应随可复现测试证据更新。"])

    add_chapter(doc, "第十章 项目创新点")
    add_section(doc, "10.1 多约束协同装箱", ["项目把LIFO与卸货顺序、重心平衡、SKU聚集、堆叠安全、搬运可达性和VGM重量约束贯穿于同一装箱工程链路。创新在业务约束组织与可解释输出，不在宣称三维装箱基础理论首创。"])
    add_section(doc, "10.2 真实坐标到三维作业复核", ["算法放置记录直接驱动门端、叉车、货物和步骤状态，使坐标可被现场人员逐步理解和复核。该能力当前属于作业可视化，不夸大为工业级数字孪生。"])
    add_section(doc, "10.3 装箱与港前合规融合", ["重量、重心、堆叠和港序等同一批数据同时进入装箱与规则审查，减少业务人员重复录入和摘要漂移。"])
    add_section(doc, "10.4 AI辅助而不替代确定性算法", ["确定性算法和规则承担计算与状态，AI承担可读解释并可失败降级。这一设计把生成能力置于可验证证据之后。"])
    add_section(doc, "10.5 面向中小出口企业和货代的贯通式工作流", ["轻量Web入口贯通订单、装箱、3D、合规和交付，降低在多个专业工具间转换的门槛。当前属于原型工作流，不代表商业化落地。"])
    add_section(doc, "10.6 创新类型与边界", ["五项创新主要属于场景融合、工程流程和人机协同创新。与研究和产品的差异见表13，查新范围内的结论不应被扩大为专利授权、绝对首创或产业领先声明。"])
    add_figure(doc, GEN / "fig18-innovations.png", "项目创新点", GENERATED_SOURCE)
    put_table(doc, 13)

    add_chapter(doc, "第十一章 应用前景与社会价值")
    add_section(doc, "11.1 中小出口企业", ["系统可作为订单出运前的辅助工具，帮助业务人员在订舱与装柜前识别柜型、未装货物和材料缺口。实际应用需要接入企业主数据并建立责任制度。"])
    add_section(doc, "11.2 货代配载", ["货代可利用结构化坐标、顺序和风险项与客户、仓库和承运人沟通，减少仅凭二维清单解释方案的成本。"])
    add_section(doc, "11.3 仓库装柜", ["仓库场景可通过门端和步骤视图进行班前复核。进一步落地需要实测叉车、通道、包装强度和人员操作习惯。"])
    add_section(doc, "11.4 港前风险控制", ["规则前移有助于在装柜前暴露重量、堆叠、港序和材料信息问题，但系统只提供预审和提示，不替代监管或承运人程序。"])
    add_section(doc, "11.5 降低沟通和试错成本", ["同一方案对象生成指标、3D步骤、规则结果和交付数据，可以减少版本不一致；其具体节省比例尚未经过企业实测，不在本报告中量化。"])
    add_section(doc, "11.6 教学和技能培训", ["项目可用于装箱算法、物流作业和合规流程的教学演示，使抽象坐标、港序和规则链转化为可观察过程。"])
    add_section(doc, "11.7 可扩展场景", ["后续可扩展多柜联算、仓库波次、危险品属性、设备路径、法规版本管理和企业系统接口，但每项能力均需独立验证。"])
    add_section(doc, "11.8 商业化前提和边界", ["商业化前提包括稳定算法基准、现场试点、租户隔离、权限审计、数据安全、运维监控、合同责任和持续支持。当前没有正式部署、企业用户或营收证据。"])
    add_figure(doc, GEN / "fig19-application-value.png", "应用前景与社会价值", GENERATED_SOURCE,
               note="场景价值为研究前景，不表示已签约客户或已产生量化收益。")

    add_chapter(doc, "第十二章 存在的问题与改进方向")
    add_section(doc, "12.1 装载能力和数据适配", ["需要扩充标准基准、企业真实SKU和异常数据集，建立算法效果、运行时间与方案稳定性的可复现实验。"])
    add_section(doc, "12.2 未装货物处理", ["当前能够保留未装清单，但二次分柜、拆单、替换柜型和原因分类仍需深化。"])
    add_section(doc, "12.3 小程序功能缺口", ["小程序导出页为空壳，真实数据链路和功能覆盖低于Web端。后续应优先补齐结果查看、风险确认和安全分享。"])
    add_section(doc, "12.4 PDF输出能力", ["Web可借助浏览器打印，但后端原生PDF尚未完成。后续需要固定模板、字体嵌入、分页控制、版本号和审计信息。"])
    add_section(doc, "12.5 法规原文联动", ["现有规则说明尚未实现法规PDF来源页码联动和高亮。后续应建立可版本化法规库与引用定位，避免只保存概括性文本。"])
    add_section(doc, "12.6 人工作业表达", ["叉车动画能说明流程，但对人工搬运、特殊包装、现场障碍和安全距离的表达与验证不足。"])
    add_section(doc, "12.7 后端测试完整性", ["完整后端测试因运行服务和端口条件未全部完成。需要隔离测试环境、避免固定端口冲突并补充端到端回归。"])
    add_section(doc, "12.8 多租户和部署", ["当前没有成熟多租户、正式部署、备份恢复和服务等级能力。相关设计必须在真实试点与安全评估后推进。"])
    add_section(doc, "12.9 CI/CD与运维", ["当前无CI/CD证据。后续需要建立版本控制门禁、自动测试、可复现构建、漏洞扫描、日志与回滚机制。"])
    add_section(doc, "12.10 后续技术路线", ["后续路线按“证据稳定-现场验证-规则追溯-交付完善-平台治理”推进，先解决影响可信度的测试、法规和未装处理，再考虑规模化与商业化。问题与计划见表14和图20。"])
    put_table(doc, 14)
    add_figure(doc, GEN / "fig20-roadmap.png", "当前问题与未来路线", GENERATED_SOURCE,
               note="路线图表示建议顺序与目标，不表示相应能力已经完成。")

    add_chapter(doc, "第十三章 团队分工与项目过程")
    add_section(doc, "13.1 项目时间线", ["项目过程可归纳为需求与事实梳理、系统原型实现、算法与3D贯通、合规链路整理、演示数据锁定、测试复核和竞赛材料正式化。具体日期、提交量和个人工时应以仓库日志及团队记录为准，不在证据不足时补造。"])
    add_section(doc, "13.2 王慈煊的项目分工", ["王慈煊为项目成员。当前汇总资料没有提供足以量化到具体提交、工时或独占模块的可靠记录，因此表15仅保留待核验分工口径。提交前应由本人依据提交日志、文件记录与演示分工补充并签字确认。"])
    add_section(doc, "13.3 赵莹莹的项目分工", ["赵莹莹为项目成员。具体调研、设计、开发、测试或材料贡献应依据实际记录确认，不以报告撰写者推测代替团队事实。"])
    add_section(doc, "13.4 指导教师作用", ["刘慰老师作为指导教师，对研究方向、事实边界、竞赛要求和材料表达提供指导。报告不生成任何签名或盖章，也不替本人作贡献确认。"])
    add_section(doc, "13.5 团队独立完成说明", ["团队对项目代码、数据、图表和说明材料承担真实性责任。外部论文、规则、产品资料和GPT Image 2生成图均按来源性质标注；生成图只用于结构说明，不冒充运行截图或第三方认可。"])
    put_table(doc, 15, note="本表是保守核验模板；赛前必须由团队根据真实记录补充，不应凭空量化个人贡献。")
    put_table(doc, 16)

    add_chapter(doc, "结论")
    add_body(doc, "“甬柜易算”围绕中小出口企业与货代的港前装柜决策，形成了订单与SKU输入、多约束三维装箱、坐标驱动3D作业复核、确定性合规规则、AI辅助解释和Web交付的贯通式原型。锁定演示订单NB2026-DEMO-01输入221件，装入221件、未装0 件，空间利用率84.51%，合规预审为本地规则 WARNING / AI建议 PASS / 人工复核独立；结果只代表本次演示。真实运行复核证明核心Web与后端链路可访问，Web lint和构建通过、Web测试75/76通过、后端核心算法定向测试25/25通过。")
    add_body(doc, "项目的价值在于把算法、作业和合规证据组织到同一工作流，并清晰划分确定性规则、AI解释与人工责任。与此同时，项目仍需补齐小程序导出、后端原生PDF、法规原文页码联动、完整后端测试、人工搬运验证、多租户和运维体系。后续应以可复现测试和真实现场试点为主线，逐步把竞赛原型推进为可验证的工程系统。")

    add_chapter(doc, "参考文献")
    refs = [
        "[1] Ambrosino D, Sciomachen A, Tanfani E. Stowing a containership: the master bay plan problem. Transportation Research Part A, 2004, 38(2): 81-99. DOI: 10.1016/j.tra.2003.09.002.",
        "[2] Taleb-Ibrahimi M, de Castilho B, Daganzo C F. Storage space vs handling work in container terminals. Transportation Research Part B, 1993, 27(1): 13-32. DOI: 10.1016/0191-2615(93)90009-Y.",
        "[3] Avriel M, Penn M, Shpirer N. Container ship stowage problem: complexity and connection to the coloring of circle graphs. Discrete Applied Mathematics, 2000, 103(1-3): 271-279. DOI: 10.1016/S0166-218X(99)00245-0.",
        "[4] Bischoff E E, Ratcliff M S W. Issues in the development of approaches to container loading. Omega, 1995, 23(4): 377-390. DOI: 10.1016/0305-0483(95)00015-G.",
        "[5] Bortfeldt A, Wäscher G. Constraints in container loading - a state-of-the-art review. European Journal of Operational Research, 2013, 229(1): 1-20. DOI: 10.1016/j.ejor.2012.12.006.",
        "[6] Junqueira L, Morabito R, Yamashita D S. Three-dimensional container loading models with cargo stability and load bearing constraints. Computers & Operations Research, 2012, 39(1): 74-85. DOI: 10.1016/j.cor.2010.07.017.",
        "[7] International Maritime Organization. Verification of the gross mass of a packed container. https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx.",
        "[8] International Maritime Organization. IMO/ILO/UNECE Code of Practice for Packing of Cargo Transport Units (CTU Code). https://www.imo.org/en/ourwork/safety/pages/ctu-code.aspx.",
        "[9] International Plant Protection Convention. ISPM 15: Regulation of wood packaging material in international trade. https://www.ippc.int/en/publications/640/.",
        "[10] Kaleris. MACS3 and StowMan. https://kaleris.com/ncvssafety/.",
        "[11] Herbert-ABS. CargoMax for Container Ships. https://www.herbert-abs.com/cargomax-for-container-ships.",
        "[12] AnyLogic. Supply Chain and Logistics Simulation Software. https://www.anylogic.com/supply-chains/.",
        "[13] Yseop. Why Yseop. https://yseop.com/why-yseop/.",
    ]
    for ref in refs:
        add_body(doc, ref, first_indent=False)

    add_chapter(doc, "附录")
    doc.add_heading("附录A 证据索引", level=2)
    add_body(doc, "项目事实主要依据FINAL_PROJECT_FACT_CHECK.md、PROJECT_FACTS.json、CLAIM_EVIDENCE_MATRIX.md、FEATURE_STATUS_MATRIX.md及Web、后端、算法、3D、合规与测试专项记录。外部研究依据正式论文、国际组织官网与产品官方页面。详细逐项核对见《05_甬柜易算_研究报告引用与证据核对表.xlsx》。")
    doc.add_heading("附录B 图片与图表来源说明", level=2)
    add_body(doc, "图1至图20均由GPT Image 2生成，属于概念、结构、流程或技术示意图；其提示词、规格、检查状态和原始PNG收录于图像素材包。运行截图R1至R8来自本机真实系统页面，使用锁定10 SKU数据经当前后端重算；它们不证明公网部署或商业使用。微信小程序首页截图仅收录在佐证材料和补录清单，用于证明项目可在开发者工具打开，不作为真实业务结果证据。")
    doc.add_heading("附录C 版本与限制摘要", level=2)
    add_bullets(doc, [
        "演示结果只对应NB2026-DEMO-01；不代表平均利用率，也不表示所有货物装入。",
        "当前3D为坐标驱动的作业可视化与复核；不宣称工业级数字孪生或物理仿真。",
        "当前系统不具备成熟多租户、正式商业部署、企业用户、营收或CI/CD证据。",
        "小程序导出、后端原生PDF、法规PDF页码联动和人工搬运验证仍未完成或不充分。",
        "AI只提供辅助解释；确定性算法、规则和人工复核承担结果责任。",
    ])

    add_header_footer(doc, "甬柜易算 · 项目研究报告")
    out = FINAL / "01_甬柜易算_项目研究报告.docx"
    doc.save(out)
    return out


IMAGE_SPECS = [
    {"no": 1, "title": "报告封面主视觉", "chapter": "封面/第一章", "type": "A4竖版概念图", "ratio": "2:3",
     "modules": "宁波港、集装箱、三维装载网格、合规证据线", "text": "不在图内放置正文标题", "arrows": "无强制箭头", "data": "不放业务数据",
     "forbidden": "企业Logo、虚构客户、霓虹、密集小字", "caption": "项目主视觉与研究对象", "schematic": "是",
     "prompt": "A4 vertical editorial cover illustration for a formal Chinese university engineering competition report about container loading and pre-port compliance. Daylight Ningbo-style coastal container terminal, one open 40-foot high-cube container, clean translucent 3D packing grid, a subtle deterministic compliance evidence ribbon, restrained forklift and cargo silhouettes. White and light gray background, deep navy, harbor teal and a small amount of orange, crisp technical linework, realistic industrial proportions, generous blank space, no logo, no people close-up, no words, no numbers, no neon, no dark dashboard, print-ready."},
    {"no": 2, "title": "港前装柜业务场景", "chapter": "第一章", "type": "工业场景示意图", "ratio": "3:2",
     "modules": "出口企业、货代、仓库、集装箱、港前检查", "text": "尽量无图内文字", "arrows": "订单至装柜至港前复核", "data": "无", "forbidden": "真实企业标识、港区标识", "caption": "港前装柜业务场景", "schematic": "是",
     "prompt": "Formal industrial logistics scene illustration, wide 3:2. A small export business shipment flows through freight forwarder planning, warehouse loading, an open container and pre-port compliance review. Show cartons with varied dimensions, a forklift, one container door, a planner using a modest laptop and a reviewer checking evidence. Clear left-to-right visual flow without text labels. White/light gray setting, deep navy, harbor teal, restrained orange accents, clean shadows, black-and-white printable, no logos, no fake data, no cyberpunk."},
    {"no": 3, "title": "用户角色与核心痛点", "chapter": "第一章/第三章", "type": "信息图", "ratio": "16:9",
     "modules": "业务人员、货代、仓库、合规复核、交付", "text": "角色通过图标表达，正文在Word说明", "arrows": "痛点汇聚至工作流", "data": "无", "forbidden": "客户数量、收益数字", "caption": "用户角色与核心痛点", "schematic": "是",
     "prompt": "Clean Chinese engineering infographic base, 16:9, five business-role pictograms arranged around four pain-point symbols: fragmented data, conflicting constraints, hard-to-understand 3D coordinates, late compliance checks. No text inside the artwork; leave short blank label bars for Word overlay. White background, navy and harbor teal, small orange warnings, consistent outline icons, clear hierarchy, no logos, no statistics."},
    {"no": 4, "title": "项目总体业务闭环", "chapter": "第四章", "type": "横向流程图", "ratio": "16:9",
     "modules": "录入、校验、计算、3D复核、合规预审、交付、反馈", "text": "图标为主", "arrows": "单向主链加反馈回路", "data": "无", "forbidden": "云平台、自动审批", "caption": "项目总体业务闭环", "schematic": "是",
     "prompt": "Formal horizontal closed-loop workflow diagram base, 16:9, seven icon nodes for data entry, validation, packing calculation, 3D operation review, deterministic compliance precheck, delivery, and feedback. Clear clockwise/left-to-right arrows with one return loop from feedback to data entry. No text, no cloud service icons, no automatic government approval. White background, navy/teal nodes, orange only for warning/feedback, crisp print lines."},
    {"no": 5, "title": "系统总体架构", "chapter": "第四章", "type": "分层架构图", "ratio": "16:9",
     "modules": "Web/微信小程序、后端服务、装箱算法/规则、数据、3D/AI解释", "text": "无图内小字", "arrows": "交互层至服务层至核心层与数据层", "data": "无", "forbidden": "Kubernetes、成熟多租户、付费模块", "caption": "系统总体架构", "schematic": "是",
     "prompt": "Text-free layered software architecture diagram for a lightweight container-loading and compliance Web prototype. Five horizontal tiers: interaction clients represented by browser and WeChat mini-program icons; Node/Express service orchestration; deterministic packing algorithm and compliance rules; structured order/plan/evidence data; Three.js visualization and AI explanation as downstream consumers. Use simple geometric modules and precise arrows. White background, deep navy, harbor teal and restrained orange. No cloud deployment claims, no Kubernetes, no billing, no multi-tenant symbol, no words."},
    {"no": 6, "title": "Web-微信小程序-后端-算法-3D-AI关系图", "chapter": "第四章", "type": "系统关系图", "ratio": "16:9",
     "modules": "Web、微信小程序、后端、算法、3D、AI", "text": "模块以通用图标区分", "arrows": "客户端到后端；算法结果到3D/规则；规则上下文到AI", "data": "无", "forbidden": "AI直接决定合规", "caption": "组件关系", "schematic": "是",
     "prompt": "Formal system relationship diagram with six clearly separated icon modules: Web browser, WeChat mini-program phone, backend API, deterministic 3D packing algorithm, 3D review viewer, and AI explanation assistant. Arrows: both clients to backend; backend to deterministic algorithm; algorithm result to 3D viewer and rules; verified rule context to AI; AI explanation returns to clients. AI must not point into algorithm decisions. White background, navy/teal, orange boundary line around AI, no text."},
    {"no": 7, "title": "核心数据流", "chapter": "第四章", "type": "数据流图", "ratio": "16:9",
     "modules": "订单/SKU、校验、算法、方案、3D、规则、AI解释、报告", "text": "无", "arrows": "订单向方案，方案分流至3D/规则/报告，规则到AI", "data": "无", "forbidden": "AI反向改写方案", "caption": "核心数据流", "schematic": "是",
     "prompt": "Text-free data-flow diagram, clean 16:9. Structured order and SKU cards flow to validation, deterministic packing engine and a plan object; the plan branches to a 3D review, deterministic compliance rules and delivery report; only verified rule context flows to an AI explanation module. Use distinct data-object shapes and one-way arrows. White background, deep navy, harbor teal, small orange for exception path. No AI arrow back into the plan, no cloud claims, no words."},
    {"no": 8, "title": "多约束三维装箱算法流程", "chapter": "第五章", "type": "算法流程图", "ratio": "16:9",
     "modules": "校验、排序、候选柜型、候选点、姿态、硬约束、六类约束、放置、未装、指标", "text": "流程节点以形状表示", "arrows": "循环与失败分支清晰", "data": "无", "forbidden": "深度学习、虚构权重", "caption": "算法流程", "schematic": "是",
     "prompt": "Professional text-free algorithm flowchart base for deterministic multi-constraint 3D container packing. Nodes for input validation, cargo expansion/sorting, candidate container loop, candidate points, allowed rotations, boundary/collision hard checks, six-business-constraint coordination, place/update, unplaced list, metrics and container comparison. Show clear loop and rejection branch. White background, navy/teal, orange rejection path. No neural network, no weight formula, no words."},
    {"no": 9, "title": "六类业务约束关系", "chapter": "第五章", "type": "六边形关系图", "ratio": "1:1",
     "modules": "LIFO/港序、重心、SKU聚集、堆叠、搬运可达、VGM", "text": "由Word图注说明", "arrows": "六项环绕协同核心", "data": "无", "forbidden": "固定权重、求和公式", "caption": "六类约束关系", "schematic": "是",
     "prompt": "Square formal six-part constraint relationship diagram without text. Central container-planning cube surrounded by six distinct icons: port-order/LIFO, center-of-gravity balance, SKU grouping, safe stacking/support, forklift reachability, and verified gross mass/weight limit. Equal visual importance, subtle connecting ring, no ranking or weighting. White background, navy and harbor teal, restrained orange accents, clear black-and-white shapes, no formula, no words."},
    {"no": 10, "title": "柜型比较与装箱方案生成", "chapter": "第五章", "type": "业务算法流程图", "ratio": "16:9",
     "modules": "货物集、候选柜型、分别计算、指标比较、人工确认", "text": "无", "arrows": "并行柜型后汇聚", "data": "无", "forbidden": "价格承诺、全部装入", "caption": "柜型比较与方案生成", "schematic": "是",
     "prompt": "Wide business-and-algorithm flow illustration, no text. A structured cargo set fans out into three generic candidate container sizes, each passes through the same deterministic packing engine, then produces metric cards showing loaded/unloaded, utilization, weight and balance icons; results converge to a human confirmation step. White background, navy/teal, small orange highlights, no prices, no claim that all cargo fits, no logos."},
    {"no": 11, "title": "集装箱坐标系与唯一门端", "chapter": "第五章/第七章", "type": "三维技术示意图", "ratio": "16:9",
     "modules": "X/Y/Z轴、柜体、唯一高X门端、货物坐标", "text": "X、Y、Z", "arrows": "轴方向和门端方向", "data": "不标具体尺寸", "forbidden": "双门端、错误坐标", "caption": "坐标系与门端", "schematic": "是",
     "prompt": "Precise 3D technical diagram of an open rectangular shipping container, white/light gray background. Coordinate axes clearly marked only X, Y, Z; X runs along container length toward a single open door plane at the high-X end, Y is width, Z is vertical. Show a few transparent cargo cuboids with corner coordinates but no numeric values. One and only one door end. Deep navy technical lines, harbor teal cargo, orange door plane, orthographic/isometric view, print-ready."},
    {"no": 12, "title": "3D装柜作业状态机", "chapter": "第七章", "type": "状态机图", "ratio": "16:9",
     "modules": "待机、取货、运输、入柜、放置、完成/阻断", "text": "节点留白由正文解释", "arrows": "主状态与异常回退", "data": "无", "forbidden": "自动跳过错误", "caption": "3D状态机", "schematic": "是",
     "prompt": "Formal state-machine diagram base with six clearly distinct unlabeled states shown by icons: idle plan, forklift pickup, transport, crossing container door, target placement, completion; a separate orange blocked/error state has a controlled return arrow to idle or manual review. Straight readable arrows, no automatic skip. White background, navy and teal, restrained orange, no words, no code."},
    {"no": 13, "title": "叉车装柜过程", "chapter": "第七章", "type": "连续步骤示意图", "ratio": "16:9",
     "modules": "接近、上叉、运输、过门端、放置、退出", "text": "无", "arrows": "六步连续", "data": "无", "forbidden": "穿墙、悬浮、双门", "caption": "叉车装柜过程", "schematic": "是",
     "prompt": "Six-panel continuous industrial process illustration, wide 16:9, same forklift and same cargo carton in every panel: approach cargo, lift onto forks, move toward one open container door, pass through door, place at target coordinate, reverse out. Correct physical continuity, no floating cargo, no wall penetration, only one door end. White/light gray background, navy linework, teal container and small orange cargo highlight, no text."},
    {"no": 14, "title": "港前合规审查链路", "chapter": "第八章", "type": "证据链流程图", "ratio": "16:9",
     "modules": "输入证据、VGM、CTU、ISPM15、规则结论、AI解释、人工复核", "text": "官方规则用通用文档图标", "arrows": "规则先于AI，人工终审", "data": "无", "forbidden": "监管自动批准", "caption": "合规审查链路", "schematic": "是",
     "prompt": "Formal evidence-chain diagram, text-free. Structured shipment evidence enters three official-rule document checkpoints represented generically for verified gross mass, cargo transport unit packing safety, and wood-packaging phytosanitary control; deterministic rule results then branch to AI explanation and human review, with human review at the final responsibility point. White background, navy/teal, orange risk markers, no government logo, no automatic approval, no words."},
    {"no": 15, "title": "AI角色与确定性算法边界", "chapter": "第八章", "type": "职责边界图", "ratio": "16:9",
     "modules": "确定性算法/规则、可验证数据、AI解释、人工复核", "text": "无", "arrows": "算法到证据到AI/人工；AI不得回写", "data": "无", "forbidden": "AI决定PASS", "caption": "AI职责边界", "schematic": "是",
     "prompt": "Clean responsibility-boundary diagram without text. On the left, a deterministic algorithm and rule engine produces a locked evidence object; on the right, an AI assistant can read the evidence and produce an explanation; a human reviewer reads both and owns the final review action. A clear boundary prevents AI from writing back into algorithm results or PASS status. White background, navy/teal, orange dashed boundary, no words."},
    {"no": 16, "title": "Web与微信小程序能力对照", "chapter": "第六章", "type": "功能矩阵信息图", "ratio": "16:9",
     "modules": "订单、装箱、3D、合规、导出；Web与小程序两列", "text": "用图标和完成度符号", "arrows": "无", "data": "小程序导出未完成", "forbidden": "完整App、已完成PDF", "caption": "端能力对照", "schematic": "是",
     "prompt": "Formal two-column capability matrix infographic base, browser/Web on the left and WeChat mini-program phone on the right. Rows shown only with icons for order/cargo, packing calculation, 3D review, compliance precheck, and export. Web column mostly completed; mini-program column partial and export clearly empty/not completed using an outline placeholder. No words, no Android/iOS app symbol, no PDF-complete badge. White background, navy/teal, orange partial markers."},
    {"no": 17, "title": "演示订单结果", "chapter": "第九章", "type": "数据结果信息图", "ratio": "16:9",
     "modules": "订单号、柜型、输入、装入、未装、利用率、合规", "text": "NB2026-DEMO-01；40HQ；输入221件；装入221件；未装0 件；空间利用率84.51%；合规 本地规则 WARNING / AI建议 PASS / 人工复核独立；仅代表一次演示订单", "arrows": "无", "data": "锁定演示数据", "forbidden": "平均水平、全部装入", "caption": "演示订单结果", "schematic": "是",
     "prompt": "Formal Chinese data-result infographic, 16:9, white background, deep navy, harbor teal and restrained orange. Use exactly these readable simplified-Chinese labels and values: NB2026-DEMO-01, 40HQ, 输入221件, 装入221件, 未装0 件, 空间利用率84.51%, 合规 本地规则 WARNING / AI建议 PASS / 人工复核独立, 仅代表一次演示订单. Include one clean container cross-section and balanced metric cards. Do not add any other number, do not imply average performance or all cargo loaded."},
    {"no": 18, "title": "项目创新点", "chapter": "第十章", "type": "五点创新信息图", "ratio": "16:9",
     "modules": "约束协同、坐标到3D、装箱合规融合、确定性与AI分工、轻量贯通工作流", "text": "正文覆盖", "arrows": "五点围绕项目核心", "data": "无", "forbidden": "理论首创、产业领先", "caption": "五项创新", "schematic": "是",
     "prompt": "Formal five-point innovation infographic base without text. Central container-workflow symbol surrounded by five equal icons: coordinated business constraints; coordinates driving 3D operation review; packing linked to pre-port compliance; deterministic rules separated from AI explanation; lightweight end-to-end workflow for small exporters and forwarders. White background, navy/teal, orange accents, no medals, no 'first', no leadership claims, no logos."},
    {"no": 19, "title": "应用前景与社会价值", "chapter": "第十一章", "type": "场景价值信息图", "ratio": "16:9",
     "modules": "出口企业、货代、仓库、风险控制、教学", "text": "无", "arrows": "项目能力到五类场景", "data": "不量化收益", "forbidden": "客户Logo、营收数字", "caption": "应用前景", "schematic": "是",
     "prompt": "Wide formal scenario-value infographic without text. A central container planning prototype connects to five future-use scenes: small export business, freight forwarder, warehouse loading crew, pre-port risk control, and university teaching/training. Use grounded industrial icons and modest arrows. White background, deep navy and harbor teal, restrained orange, no customer logos, no money/revenue figures, no deployed-cloud claim."},
    {"no": 20, "title": "当前问题与未来路线", "chapter": "第十二章", "type": "阶段路线图", "ratio": "16:9",
     "modules": "证据稳定、现场验证、法规追溯、交付完善、平台治理", "text": "里程碑由正文解释", "arrows": "由当前向未来单向推进", "data": "无承诺日期", "forbidden": "已完成标记、商业承诺", "caption": "问题与未来路线", "schematic": "是",
     "prompt": "Formal five-stage engineering roadmap base, 16:9, progressing from current prototype toward evidence stability, real-site validation, regulation traceability, delivery completion, and platform governance. Each stage uses a distinct sober technical icon; current stage is clearly at the beginning and future stages are outlined, not completed. White background, navy/teal, small orange milestones, no dates, no commercial promises, no words."},
]


def add_compact_cover(doc: Document, title: str, subtitle: str, meta_lines):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(60)
    r = p.add_run(title)
    set_run_font(r, name="黑体", size=24, bold=True, color=JADE)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    r = p.add_run(subtitle)
    set_run_font(r, name="黑体", size=14, bold=True, color=BLUE)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(30)
    p.add_run().add_picture(str(GEN / "fig01-cover-visual-landscape-alt.png"), width=Cm(14.5))
    for line in meta_lines:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.space_after = Pt(1)
        r = p.add_run(line)
        set_run_font(r, size=10.5)


def build_evidence_compilation() -> Path:
    doc = Document()
    configure_document(doc, "甬柜易算项目研究佐证材料汇编")
    add_compact_cover(doc, "甬柜易算", "项目研究佐证材料汇编", [
        f"项目：{PROJECT_TITLE}", f"团队：{TEAM}（{MEMBERS}）", f"学校：{SCHOOL} · {COLLEGE}", "证据复核日期：2026年7月11日"
    ])
    doc.add_section(WD_SECTION_START.NEW_PAGE)
    doc.add_heading("一、材料性质与证据分级", level=1)
    add_body(doc, "本汇编用于说明研究报告中的项目事实来源、真实运行状态和能力边界。证据分为：A类真实运行页面与当次测试输出；B类仓库事实文件、接口与代码结构摘要；C类GPT Image 2结构示意图。C类材料只用于表达，不作为系统运行或功能完成的证据。")
    add_table(doc, "项目事实索引", ["事实主题", "核心结论", "主要证据", "等级"], [
        ["系统定位", "轻量化Web系统原型", "FINAL_PROJECT_FACT_CHECK、功能状态矩阵", "B"],
        ["算法", "多约束三维装箱与六类约束协同", "算法事实、测试与运行结果", "A/B"],
        ["锁定演示", "221输入、221装入、0未装、84.51%", "当前后端重算与锁定事实", "A"],
        ["合规演示", "本地规则 WARNING / AI建议 PASS / 人工复核独立，仅为锁定演示预审", "项目锁定证据；当前规则数据有版本差异", "B"],
        ["3D", "坐标驱动的作业可视化与复核", "真实页面关键帧与3D事实文件", "A/B"],
        ["小程序", "代码可打开和编译；导出页为空壳", "开发者工具截图与移动端事实", "A/B"],
        ["测试", "Web 75/76；核心后端定向25/25", "本轮测试输出", "A"],
    ], widths=[3.0, 6.1, 5.5, 2.0], font_size=8.4)
    doc.add_heading("二、截图能力与运行审计", level=1)
    add_body(doc, "本轮能够访问完整项目目录、读取启动说明、运行前后端命令、访问本地Web与接口、打开浏览器并自动截取页面。后端与Web服务分别在本机3000与5173端口可访问。锁定10 SKU数据通过当前后端重新计算获得221件装入、0 件未装货物和84.51%利用率。截图未修改页面数字，也未变更核心算法。")
    add_body(doc, "微信小程序能够在本机微信开发者工具中打开并编译。自动化连接只稳定取得首页，后续页面导航与数据调用出现超时；因此小程序截图仅证明启动，且首页存在演示性静态内容，不能作为计算、合规或导出完成的证据。")
    doc.add_heading("三、Web真实页面", level=1)
    add_evidence_image(doc, REAL / "real01-container-result.png", "E1", "装箱结果", RUNTIME_SOURCE,
                       note="输入221、装入221、未装0 件、利用率84.51%；仅代表一次演示订单。")
    add_evidence_image(doc, REAL / "real02-dashboard-result.png", "E2", "工作台结果", RUNTIME_SOURCE,
                       note="当前规则侧页面状态受本机规则数据版本影响，不用于替代锁定本地规则 WARNING / AI建议 PASS / 人工复核独立证据。")
    doc.add_heading("四、3D运行证据", level=1)
    for code, name, title in [
        ("E3", "real03-twin-door.png", "门端视角"), ("E4", "real04-twin-top.png", "顶部视角"),
        ("E5", "real05-twin-side.png", "侧面视角"), ("E6", "real06-twin-operation.png", "作业视角"),
        ("E7", "real11-cargo-on-forks.png", "货物上叉"), ("E8", "real12-cargo-entering-door.png", "货物过门端"),
        ("E9", "real13-cargo-placed-target.png", "货物到达目标坐标")]:
        add_evidence_image(doc, REAL / name, code, title, RUNTIME_SOURCE, width_cm=13.8)
    doc.add_heading("五、合规与报告页面证据", level=1)
    add_evidence_image(doc, REAL / "real07-compliance-evidence-current.png", "E10", "当前合规证据页面", "项目真实运行界面，2026-07-11",
                       note="该页反映当前本机规则数据；与锁定演示本地规则 WARNING / AI建议 PASS / 人工复核独立之间的来源版本差异需后续统一。")
    add_evidence_image(doc, REAL / "real08-report-current.png", "E11", "当前报告页面", "项目真实运行界面，2026-07-11",
                       note="Web导出以HTML、CSV、JSON和浏览器打印为当前边界；无后端原生PDF。")
    doc.add_heading("六、微信小程序启动证据", level=1)
    add_evidence_image(doc, REAL / "real09-miniprogram-home-mock.png", "E12", "微信开发者工具中的小程序首页", "项目真实运行界面，2026-07-11",
                       width_cm=7.6, note="仅证明项目可打开和编译；页面含演示性静态文案，不证明真实数据、PDF或导出能力。")
    doc.add_heading("七、算法输入输出证据", level=1)
    add_table(doc, "锁定演示算法事实", ["项目", "结果", "解释"], [
        ["订单", "NB2026-DEMO-01", "锁定10 SKU数据集"], ["输入", "221件", "总输入"],
        ["装入", "221件", "具有有效放置记录"], ["未装", "0件", "保留未装清单"],
        ["柜型", "40HQ", "当前演示推荐"], ["空间利用率", "84.51%", "单次演示"],
        ["总货重", "8812 kg", "当前后端重算结果"],
    ], widths=[4.0, 4.5, 8.2])
    add_body(doc, "算法输出包含货物位置、旋转、装载顺序、装入/未装清单和结果指标。算法允许未装货物，不把输入总量与装入量混同；当前结果不用于证明全局最优、平均性能或所有业务数据适用。")
    doc.add_heading("八、测试与构建证据", level=1)
    add_table(doc, "本轮验证记录", ["项目", "结果", "证据边界"], [
        ["Web lint", "通过", "当前工作树静态检查"], ["Web单元测试", "75/76通过", "1项来源标识断言失败"],
        ["Web生产构建", "通过", "1630模块，约28.31秒"], ["后端核心算法定向测试", "25/25通过", "2套件"],
        ["后端完整测试", "未全部完成", "运行服务/端口占用条件"], ["本地接口与页面", "可访问", "不等于生产部署"],
    ], widths=[4.2, 4.0, 8.5])
    doc.add_heading("九、科技查新证据摘要", level=1)
    add_body(doc, "正式查新正文的核心证据采用P01、P02、P03三篇经典正式研究，STD01、STD02、STD03三项国际规则依据，以及CP01、CP02、CP03、CP04四个商业或系统对照。正式论文说明装载规划、码头搬运、港序与稳定性已有充分研究；官方规则说明VGM、CTU安全装载和木质包装要求并非项目自创；产品对照用于界定既有单项能力。")
    novelty_rows = [
        ["查新点一", "六类约束协同装箱", "工程化改进与组合创新；不主张基础装箱理论首创"],
        ["查新点二", "真实SKU、柜型比较、坐标、顺序、未装和指标贯通", "工程化改进与场景应用创新"],
        ["查新点三", "算法坐标驱动可暂停、跳步和复核的3D作业过程", "场景应用与系统集成创新；非工业级数字孪生"],
        ["查新点四", "VGM/CTU/ISPM 15规则、AI解释与人工复核", "组合创新；法规PDF页码联动未完成"],
        ["查新点五", "面向中小出口企业与货代的贯通式轻量工作流", "系统集成与场景应用创新；非成熟商业SaaS"],
    ]
    add_table(doc, "五个查新点结论", ["编号", "内容", "结论边界"], novelty_rows,
              widths=[2.3, 7.2, 7.2], font_size=8.5)
    add_body(doc, "arXiv资料统一作为“预印本”列入正式查新报告附件，不承担核心新颖性结论。PAT01仅核实题名Method for determining a stowage plan及专利号US5809489；PAT02、PAT03仅列附件，不作为核心新颖性判断依据。正文不使用Wikipedia、百科或搜索结果片段。")
    doc.add_heading("十、当前限制与补证建议", level=1)
    add_bullets(doc, [
        "完成后端全量测试并固定隔离端口，保存可复现日志。",
        "用真实企业脱敏订单扩充算法基准，并记录未装原因与多柜决策。",
        "补录微信小程序货物、方案、合规和报告页面；当前首页不能作为业务证据。",
        "实现并验证小程序导出与后端原生PDF后，再更新能力声明。",
        "建立法规版本、原文页码与高亮联动，保存来源快照。",
        "开展仓库人员任务测试，验证叉车路径和人工作业表达。",
        "按真实提交日志补充两名成员分工，不虚构工时或提交量。",
    ])
    doc.add_heading("十一、生成图表索引", level=1)
    add_body(doc, "主报告图1至图20均为GPT Image 2生成的结构、流程或场景示意图；原始PNG、提示词和内容规格表收录于《03_甬柜易算_研究报告图像素材包.zip》。这些图不用于证明系统已运行、已部署、已获得客户或已通过法定审查。")
    doc.add_heading("十二、声明页", level=1)
    add_body(doc, "本汇编所列事实与证据由申报者在提交前复核。签字、学院盖章和日期栏保持空白，不生成电子签名或印章。")
    for line in ["申报者签字：________________________________", "学院盖章：", "", "", "日期：______年____月____日"]:
        p = doc.add_paragraph()
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.space_after = Pt(12)
        p.add_run(line)
    add_header_footer(doc, "甬柜易算 · 项目研究佐证材料汇编")
    out = WORK / "_evidence_compilation.docx"
    doc.save(out)
    return out


def build_prompt_document() -> Path:
    doc = Document()
    configure_document(doc, "甬柜易算研究报告图像生成提示词")
    add_compact_cover(doc, "甬柜易算", "研究报告图像生成提示词与内容规格", [
        "图像引擎：GPT Image 2", "必需图像：20幅；附加候选版本：3幅", "用途：正式项目研究报告结构说明"
    ])
    sec = doc.add_section(WD_SECTION_START.NEW_PAGE)
    sec.orientation = WD_ORIENT.LANDSCAPE
    sec.page_width = Cm(29.7)
    sec.page_height = Cm(21.0)
    sec.top_margin = Cm(1.55)
    sec.bottom_margin = Cm(1.45)
    sec.left_margin = Cm(1.45)
    sec.right_margin = Cm(1.45)
    doc.add_heading("使用说明", level=1)
    add_body(doc, "图1至图20均为结构、流程、场景或技术示意图，不作为真实运行证据。生成前使用项目事实文件锁定术语与数字；生成后逐图检查中文、数字、模块、箭头、重复元素、虚构内容和裁切。正文采用无字结构底图时，由图题和图注承担术语说明。")
    for spec in IMAGE_SPECS:
        doc.add_heading(f"图{spec['no']} {spec['title']}", level=2)
        add_table(doc, f"图{spec['no']}内容规格", ["字段", "内容"], [
            ["使用章节", spec["chapter"]], ["图片类型", spec["type"]], ["画布比例", spec["ratio"]],
            ["必须出现的模块", spec["modules"]], ["必须使用的中文", spec["text"]], ["箭头关系", spec["arrows"]],
            ["真实数据", spec["data"]], ["禁止出现", spec["forbidden"]], ["图注", spec["caption"]],
            ["是否示意图", spec["schematic"]],
        ], widths=[4.0, 12.7], font_size=8.5)
        p = doc.add_paragraph(style="Small Note")
        r = p.add_run("完整提示词：")
        set_run_font(r, size=9, bold=True, color=INK)
        r = p.add_run(spec["prompt"])
        set_run_font(r, size=8.5, color=INK)
        img = GEN / f"fig{spec['no']:02d}-"  # resolve by prefix below
        matches = sorted(GEN.glob(f"fig{spec['no']:02d}-*.png"))
        primary = [m for m in matches if "alt" not in m.name]
        if primary:
            add_figure(doc, primary[0], f"图{spec['no']}生成结果预览", "GPT Image 2原始PNG", width_cm=12.8)
    doc.add_heading("附加候选版本", level=1)
    add_body(doc, "图像素材包另含封面横版候选、系统架构界面化候选和带文字数据流候选。正式报告选择文字风险更低、结构更清晰的版本；候选图不重复计入20幅必需图。")
    add_header_footer(doc, "甬柜易算 · 图像生成提示词与内容规格")
    out = FINAL / "04_甬柜易算_研究报告图像生成提示词.docx"
    doc.save(out)
    return out


def build_screenshot_supplement() -> Path:
    doc = Document()
    configure_document(doc, "甬柜易算真实系统截图补录清单")
    add_compact_cover(doc, "甬柜易算", "真实系统截图补录清单", [
        "已自动取得Web与3D真实截图；小程序仅取得首页启动证据", "本清单用于赛前补齐高可信功能截图"
    ])
    sec = doc.add_section(WD_SECTION_START.NEW_PAGE)
    sec.orientation = WD_ORIENT.LANDSCAPE
    sec.page_width = Cm(29.7)
    sec.page_height = Cm(21.0)
    sec.top_margin = Cm(1.55)
    sec.bottom_margin = Cm(1.45)
    sec.left_margin = Cm(1.45)
    sec.right_margin = Cm(1.45)
    doc.add_heading("截图审计结论", level=1)
    add_body(doc, "本轮成功启动并访问本地Web与后端，锁定10 SKU演示数据经当前后端重新计算后，取得13张Web/3D/合规/报告真实截图；微信小程序在开发者工具中打开并编译，取得1张首页截图。主报告采用8张最安全的Web与3D截图。小程序首页含演示性静态内容且export页面为空壳，因此不作为真实业务或导出证据。")
    rows = [
        ["S01", "当前订单/工作台", "NB2026-DEMO-01且仅显示锁定结果", "第六/九章", "锁定演示订单工作台", "web_order_locked.png", "1920x1080", "替换当前版本差异页面", "建议"],
        ["S02", "货物与SKU管理", "10 SKU、尺寸重量数量完整，无敏感信息", "第六章", "锁定10 SKU货物清单", "web_cargo_5sku.png", "1920x1080", "补入佐证汇编", "必须"],
        ["S03", "柜型比较", "候选柜型并列，显示装入/未装/利用率", "第五/六章", "柜型方案比较", "web_container_compare.png", "1920x1080", "可替换生成图10旁证", "建议"],
        ["S04", "装箱方案", "40HQ、221装入、0未装、84.51%", "第六/九章", "真实装箱结果", "real01-container-result.png", "1920x1080", "已补录并用于正文", "已完成"],
        ["S05", "3D门端", "唯一高X门端，锁定方案", "第七章", "门端复核视角", "real03-twin-door.png", "1920x1080", "已补录并用于正文", "已完成"],
        ["S06", "3D关键动作", "上叉、过门、到位连续状态", "第七章", "叉车装柜关键帧", "real11-13.png", "1920x1080", "已补录三帧", "已完成"],
        ["S07", "合规审查", "使用与锁定本地规则 WARNING / AI建议 PASS / 人工复核独立一致的规则版本，显示证据字段", "第八/九章", "锁定演示合规预审", "web_compliance_locked.png", "1920x1080", "替换当前本机规则版本页面", "必须"],
        ["S08", "人工复核", "待核项、复核人空白、状态流转真实", "第八章", "人工复核工作流", "web_manual_review.png", "1920x1080", "补入佐证汇编", "建议"],
        ["S09", "报告预览", "锁定数字、来源标识一致，显示HTML/CSV/JSON/打印", "第六/九章", "报告预览与交付", "web_report_locked.png", "1920x1080", "替换当前版本差异页面", "必须"],
        ["S10", "小程序货物", "真实10 SKU数据由后端返回", "第六章", "微信小程序货物页", "mini_cargo_real.png", "390x844", "补入佐证汇编", "必须"],
        ["S11", "小程序方案", "真实装入/未装，不出现虚构导出能力", "第六章", "微信小程序方案页", "mini_plan_real.png", "390x844", "补入佐证汇编", "必须"],
        ["S12", "小程序导出", "当前空壳状态，或功能完成后再截图", "第六/十二章", "微信小程序导出现状", "mini_export_state.png", "390x844", "现阶段用于限制说明", "建议"],
        ["S13", "测试结果", "完整后端测试在隔离环境完成后截图", "第九/十二章", "后端全量测试记录", "backend_full_test.png", "1920x1080", "补入质量记录", "必须"],
    ]
    add_table(doc, "真实系统截图补录清单", ["编号", "页面", "推荐截图状态", "对应章节", "推荐图题", "推荐文件名", "尺寸", "替换位置", "状态"],
              rows, widths=[1.1, 1.8, 3.4, 1.8, 2.5, 2.8, 1.6, 2.5, 1.3], font_size=7.2,
              note="所有补录截图必须来自真实系统和真实数据；不得通过图像生成或手工改数替代。")
    doc.add_heading("补录操作要求", level=1)
    add_bullets(doc, [
        "使用与提交版本一致的代码、规则数据和锁定演示订单。",
        "截图前关闭弹窗和开发者信息，不暴露密钥、手机号、内部路径或个人信息。",
        "Web建议1920x1080，小程序建议390x844；保持浏览器缩放100%。",
        "保留原始PNG、页面路由、截图时间、数据来源和版本标识。",
        "小程序导出和后端原生PDF未完成前，不使用带“已完成”含义的截图或图题。",
        "法规页面只有在来源版本、原文页码和结果一致后才用于正式证据。",
    ])
    add_header_footer(doc, "甬柜易算 · 真实系统截图补录清单")
    out = FINAL / "06_甬柜易算_真实系统截图补录清单.docx"
    doc.save(out)
    return out


def build_novelty_report() -> Path:
    doc = Document()
    configure_document(doc, "甬柜易算项目科技查新报告")
    sec = doc.sections[0]
    sec.top_margin = Cm(2.0)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(60)
    r = p.add_run("科技查新报告")
    set_run_font(r, name="黑体", size=27, bold=True, color=INK)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(24)
    r = p.add_run(PROJECT_TITLE)
    set_run_font(r, name="黑体", size=18, bold=True, color=JADE)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.add_run().add_picture(str(GEN / "fig01-cover-visual-landscape-alt.png"), width=Cm(14.5))
    for line in [f"申报团队：{TEAM}", f"申报者：{MEMBERS}", f"指导教师：{ADVISOR}", f"学院：{COLLEGE}", f"学校：{SCHOOL}", f"日期：{REPORT_DATE}"]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.space_after = Pt(1)
        p.add_run(line)
    doc.add_section(WD_SECTION_START.NEW_PAGE)
    doc.add_heading("一、查新目的", level=1)
    add_body(doc, "查明国内外公开文献、国际规则、专利题录及商业产品资料中，与多约束三维装箱、柜型比较与结果贯通、坐标驱动3D作业复核、港前合规与AI辅助解释以及轻量化贯通工作流相关的研究和系统，分析项目五个查新点与现有技术的相同点、差异点及创新边界，为竞赛申报提供审慎的技术新颖性依据。")
    doc.add_heading("二、项目科学技术要点", level=1)
    add_body(doc, "项目面向中小出口企业、跨境卖家、货代和仓库装柜人员，以真实SKU尺寸、重量、数量与业务属性为输入，调用多约束三维装箱算法比较柜型并输出装载坐标、顺序、未装清单和结果指标。六类约束包括LIFO与卸货顺序、重心平衡、SKU聚集、堆叠安全、搬运可达性和VGM重量约束。")
    add_body(doc, "算法坐标进一步驱动浏览器3D作业过程，表达唯一门端、门洞、叉车、路径、碰撞与状态机，并支持播放、暂停、跳步和复核。合规链路以SOLAS/VGM、CTU Code和ISPM 15为规则依据，由确定性规则形成结论，AI仅提供风险解释和辅助提示，人工复核承担需要专业判断的事项。系统当前为面向SaaS化交付的装箱与合规系统原型，不具备成熟多租户、商业部署或正式运营能力。")
    doc.add_heading("三、查新点", level=1)
    points = [
        "查新点一：面向装柜业务，将LIFO与卸货顺序、重心平衡、SKU聚集、堆叠安全、搬运可达性和VGM重量约束组织为六类业务约束协同机制。",
        "查新点二：基于真实SKU数据完成柜型比较，由同一后端生成三维坐标、装载顺序、未装货物和结果指标，并形成轻量Web交付流程。",
        "查新点三：以算法真实坐标与顺序驱动可播放、暂停、跳步和复核的3D装柜作业过程，统一表达门端、叉车、路径和状态。",
        "查新点四：把VGM、CTU Code、ISPM 15等规则、AI风险解释和人工复核串联为港前预审链路，确定性规则与AI职责分离。",
        "查新点五：面向中小出口企业、跨境卖家、货代和仓库装柜人员，贯通SKU管理、柜型比较、三维装箱、3D复核、港前合规、人工复核和结果交付。",
    ]
    add_bullets(doc, points)
    doc.add_heading("四、检索范围与检索策略", level=1)
    add_body(doc, "检索范围包括三维装箱、集装箱装载规划、港序与搬运、支撑与稳定性、港口和物流数字孪生、VGM、CTU Code、ISPM 15、合规解释、人机协同，以及相关商业软件和专利题录。核心检索资料限于正式期刊论文、国际组织官方页面和产品官方页面；预印本仅列补充文献。")
    add_body(doc, "中文检索词包括：三维装箱、集装箱配载、装载规划、重心、堆叠稳定、卸货顺序、港口数字孪生、核实总质量、木质包装、合规预审、人工复核。英文检索词包括：three-dimensional bin packing, container loading, stowage plan, multi-port, relocation, stability, load bearing, verified gross mass, CTU Code, ISPM 15, digital twin, human-in-the-loop。检索采用题名、关键词、作者、DOI、规则名称、产品名称与专利号交叉核对。")
    add_body(doc, "检索限制主要来自部分商业系统为黑盒、专利站点全文可见度有限以及部分中文数据库访问范围有限。二级来源只用于概括检索限制，不进入正式结论的核心引用。正文不采用Wikipedia、百科或搜索结果片段。")
    doc.add_heading("五、检索结果", level=1)
    add_body(doc, "P01至P03表明，装船规划、码头存储空间与搬运代价、集装箱船积载复杂性已形成经典研究基础；补充的稳定性和承载研究进一步说明几何、支撑、重量和顺序约束并非空白领域。STD01至STD03分别为VGM、CTU安全装载和木质包装要求提供官方规则根证据。CP01至CP04表明，商业系统已经分别覆盖积载、稳性/限制检查、供应链仿真或受监管文本生成等能力。")
    core_rows = [
        ["P01", "Ambrosino, Sciomachen, Tanfani, Stowing a containership: the master bay plan problem, 2004", "正式期刊研究", "查新点二、五"],
        ["P02", "Taleb-Ibrahimi, de Castilho, Daganzo, Storage space vs handling work in container terminals, 1993", "正式期刊研究", "查新点三、五"],
        ["P03", "Avriel, Penn, Shpirer, Container ship stowage problem..., 2000", "正式期刊研究", "查新点一、二"],
        ["STD01", "SOLAS/VGM官方说明", "IMO官方规则", "查新点四"],
        ["STD02", "IMO/ILO/UNECE CTU Code", "IMO官方规则", "查新点四"],
        ["STD03", "ISPM 15", "IPPC官方标准", "查新点四"],
        ["CP01", "MACS3/StowMan（Kaleris）", "产品官方资料", "查新点二、四、五"],
        ["CP02", "CargoMax（Herbert-ABS）", "产品官方资料", "查新点一、二"],
        ["CP03", "AnyLogic Supply Chain", "产品官方资料", "查新点三、五"],
        ["CP04", "Yseop", "产品官方资料", "查新点四、五"],
        ["PAT01", "Method for determining a stowage plan, US5809489", "仅核实题名及专利号", "查新点二；弱证据"],
    ]
    add_table(doc, "核心检索证据", ["编号", "资料", "证据性质", "关联查新点"], core_rows,
              widths=[2.2, 8.0, 3.3, 3.2], font_size=8.0)
    doc.add_heading("六、五个查新点逐项分析", level=1)
    analyses = [
        ("6.1 查新点一", "三维装箱、稳定性、承载、重量与港序均已有公开研究，项目不能表述为基础理论首创。与既有研究相比，项目把六类业务约束组织到同一工程链路，并继续用于3D作业与合规复核。结论：工程化改进与组合创新。"),
        ("6.2 查新点二", "P01、P03及CP01、CP02显示积载规划、重量、重心、装卸顺序和报告能力已有先例。项目的差异在于面向真实SKU，把柜型比较、坐标、顺序、未装清单和指标放入轻量Web流程。结论：工程化改进与场景应用创新；浏览器打印不等于后端原生PDF，小程序导出尚未完成。"),
        ("6.3 查新点三", "数字孪生和物流仿真并不罕见，CP03说明通用供应链仿真已有成熟平台。项目可识别的差异是同一装箱坐标直接驱动门端、叉车、路径和状态机的可复核过程。结论：场景应用与系统集成创新；当前不是工业级数字孪生或物理仿真。"),
        ("6.4 查新点四", "STD01至STD03证明VGM、CTU安全装载和木质包装均有明确外部规则来源；CP04说明受监管文本生成、追溯与人工在环也存在相邻产品。项目将这些规则嵌入出口装柜预审，并限制AI只承担解释。结论：组合创新；法规PDF原文页码和高亮联动未完成。"),
        ("6.5 查新点五", "公开研究与产品多覆盖装载规划、仿真或合规表达中的一段。检索范围内未发现清楚证明SKU管理、柜型比较、三维装箱、3D复核、港前合规、人工复核和结果交付由同一轻量公开系统完整覆盖的材料。结论：系统集成与场景应用创新；该判断受商业黑盒、专利全文可见度和数据库范围限制。"),
    ]
    for heading, text_value in analyses:
        doc.add_heading(heading, level=2)
        add_body(doc, text_value)
    doc.add_heading("七、查新结论", level=1)
    add_body(doc, "检索结果表明，三维装箱、装船积载、码头搬运、稳定与承载、港序、物流仿真、VGM、CTU安全装载、ISPM 15以及AI辅助合规表达均存在公开研究、规则或产品基础。项目的新颖性不宜建立在单项底层理论首创上。")
    add_body(doc, "在所检索的公开资料范围内，尚未发现与项目五个查新点组合完全相同、且面向中小出口企业和货代形成“真实SKU与柜型比较-多约束装箱-坐标驱动3D作业复核-港前规则预审-AI辅助解释-人工复核-结果交付”完整链路的公开系统资料。项目五点分别可归纳为工程化改进、组合创新、场景应用创新和系统集成创新。该结论限于公开可访问检索范围，不构成专利授权、法律意见、行业领先或商业成熟度证明。")
    doc.add_heading("八、查新声明", level=1)
    add_body(doc, "本报告依据申报项目资料及公开可访问的正式论文、官方规则、产品官方资料和专利题录形成。项目当前实现、部分实现、未完成和验证不足的能力均按证据边界表述。查新结论仅供竞赛申报和技术研究参考。")
    add_body(doc, "申报者签字、学院盖章和日期栏由相关主体在正式提交时填写，本文件不生成任何签名或印章。")
    for line in ["申报者签字：________________________________", "", "学院盖章：", "", "", "日期：______年____月____日"]:
        p = doc.add_paragraph()
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.space_after = Pt(13)
        p.add_run(line)
    doc.add_heading("附件一 补充文献（预印本）", level=1)
    add_body(doc, "下列资料均统一标注为预印本，仅用于说明前沿方向，不作为核心新颖性判断依据：P04 An Integrated Optimization Model for the Multi-Port Stowage Planning and the Container Relocation Problems（arXiv预印本，2020）；P05 Towards a Digital Twin Modeling Method for Container Terminal Port（arXiv预印本，2025）；P06 LegalBench（arXiv预印本，2023）；P07 LegalBench-RAG（arXiv预印本，2024）；P08 LexRAG（arXiv预印本，2025）；P09 Formalising Human-in-the-Loop（arXiv预印本，2025）；CN06 Online 3D Bin Packing with Constrained Deep Reinforcement Learning（arXiv预印本，2020）；CN07 A Constructive Heuristic Algorithm for 3D Bin Packing of Irregular Shaped Items（arXiv预印本，2022）；CN08 One4Many-StablePacker（arXiv预印本，2025）；CN09 Learning to Optimize Industry-Scale Dynamic Pickup and Delivery Problems（arXiv预印本，2021）；CN10 KUNPENG（arXiv预印本，2024）。")
    doc.add_heading("附件二 专利题录", level=1)
    add_bullets(doc, [
        "PAT01：Method for determining a stowage plan，US5809489；仅核实题名及专利号。",
        "PAT02：Shipboard freight container transferring apparatus，US3042227A；置于附件，不作为核心新颖性判断依据。",
        "PAT03：Container stacking system，US3231103A；置于附件，不作为核心新颖性判断依据。",
    ])
    doc.add_heading("附件三 核心参考资料", level=1)
    refs = [
        "P01 Ambrosino D, Sciomachen A, Tanfani E. Stowing a containership: the master bay plan problem. 2004. DOI: 10.1016/j.tra.2003.09.002.",
        "P02 Taleb-Ibrahimi M, de Castilho B, Daganzo C F. Storage space vs handling work in container terminals. 1993. DOI: 10.1016/0191-2615(93)90009-Y.",
        "P03 Avriel M, Penn M, Shpirer N. Container ship stowage problem: complexity and connection to the coloring of circle graphs. 2000. DOI: 10.1016/S0166-218X(99)00245-0.",
        "STD01 International Maritime Organization. Verification of the gross mass of a packed container.",
        "STD02 International Maritime Organization. IMO/ILO/UNECE Code of Practice for Packing of Cargo Transport Units.",
        "STD03 International Plant Protection Convention. ISPM 15.",
        "CP01 Kaleris. MACS3 and StowMan.", "CP02 Herbert-ABS. CargoMax for Container Ships.",
        "CP03 AnyLogic. Supply Chain and Logistics Simulation Software.", "CP04 Yseop. Why Yseop.",
    ]
    for ref in refs:
        add_body(doc, ref, first_indent=False)
    add_header_footer(doc, "甬柜易算 · 科技查新报告")
    out = FINAL / "08_甬柜易算_科技查新报告.docx"
    doc.save(out)
    return out


def build_evidence_workbook() -> Path:
    wb = Workbook()
    ws = wb.active
    ws.title = "References"
    headers = ["ID", "类型", "题名/名称", "作者/机构", "年份", "DOI/URL/专利号", "证据等级", "正文用途", "限制"]
    ws.append(headers)
    ref_rows = [
        ["P01", "正式期刊", "Stowing a containership: the master bay plan problem", "Ambrosino; Sciomachen; Tanfani", 2004, "10.1016/j.tra.2003.09.002", "核心", "装载规划基础", "不证明项目整体已公开"],
        ["P02", "正式期刊", "Storage space vs handling work in container terminals", "Taleb-Ibrahimi; de Castilho; Daganzo", 1993, "10.1016/0191-2615(93)90009-Y", "核心", "码头搬运与空间权衡", "场景层对照"],
        ["P03", "正式期刊", "Container ship stowage problem: complexity and connection to the coloring of circle graphs", "Avriel; Penn; Shpirer", 2000, "10.1016/S0166-218X(99)00245-0", "核心", "积载复杂性与港序", "船舶积载场景"],
        ["P04", "预印本", "An Integrated Optimization Model for the Multi-Port Stowage Planning and the Container Relocation Problems", "Junqueira et al.", 2020, "arXiv", "补充", "附件", "预印本"],
        ["P05", "预印本", "Towards a Digital Twin Modeling Method for Container Terminal Port", "Hakimi et al.", 2025, "arXiv", "补充", "附件", "预印本"],
        ["STD01", "官方规则", "Verification of the gross mass of a packed container", "IMO", "", "https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx", "核心", "VGM", "预审不替代法定程序"],
        ["STD02", "官方规则", "IMO/ILO/UNECE CTU Code", "IMO/ILO/UNECE", "", "https://www.imo.org/en/ourwork/safety/pages/ctu-code.aspx", "核心", "装载安全", "项目不覆盖全部条款"],
        ["STD03", "官方标准", "ISPM 15", "IPPC", "", "https://www.ippc.int/en/publications/640/", "核心", "木质包装", "页码联动未完成"],
        ["CP01", "产品官方", "MACS3/StowMan", "Kaleris", "", "https://kaleris.com/ncvssafety/", "对照", "积载/VGM/港序", "不比较产业成熟度"],
        ["CP02", "产品官方", "CargoMax", "Herbert-ABS", "", "https://www.herbert-abs.com/cargomax-for-container-ships", "对照", "装载/稳性/限制", "船舶专业软件"],
        ["CP03", "产品官方", "AnyLogic Supply Chain", "AnyLogic", "", "https://www.anylogic.com/supply-chains/", "对照", "物流仿真", "通用平台"],
        ["CP04", "产品官方", "Yseop", "Yseop", "", "https://yseop.com/why-yseop/", "对照", "AI生成/追溯/人工在环", "不代表装箱能力"],
        ["PAT01", "专利题录", "Method for determining a stowage plan", "未完整核实", "", "US5809489", "弱", "附件/题录", "仅核实题名及专利号"],
        ["PAT02", "专利题录", "Shipboard freight container transferring apparatus", "未完整核实", "", "US3042227A", "附件", "附件", "不作核心新颖性判断"],
        ["PAT03", "专利题录", "Container stacking system", "未完整核实", "", "US3231103A", "附件", "附件", "不作核心新颖性判断"],
    ]
    for row in ref_rows:
        ws.append(row)
    ws2 = wb.create_sheet("Claims")
    ws2.append(["Claim ID", "报告声明", "状态", "主要证据", "允许表述", "禁止外推"])
    claim_rows = [
        ["C01", "系统定位", "已核实", "FINAL_PROJECT_FACT_CHECK", "轻量化Web系统原型", "成熟多租户/商业部署/用户/营收"],
        ["C02", "算法名称", "已核实", "算法事实与代码", "多约束三维装箱算法；六类业务约束协同机制", "虚构权重、公式或新名称"],
        ["C03", "演示结果", "已核实", "锁定事实+当前后端重算", "221/221/0/84.51%，单次演示", "平均水平、全部装入"],
        ["C04", "合规演示", "锁定事实", "锁定证据", "本地规则 WARNING / AI建议 PASS / 人工复核独立，单次预审", "法定批准、当前所有规则版本一致"],
        ["C05", "3D", "已核实", "真实截图+3D事实", "坐标驱动作业可视化与复核", "工业级数字孪生/物理仿真"],
        ["C06", "移动端", "部分", "开发者工具截图+移动事实", "微信小程序代码可打开编译", "完整原生App、小程序导出完成"],
        ["C07", "导出", "部分", "Web事实", "HTML/CSV/JSON/浏览器打印", "后端原生PDF完成"],
        ["C08", "测试", "已核实", "本轮输出", "Web 75/76；核心后端25/25", "全部测试通过"],
        ["C09", "法规联动", "未完成", "合规事实", "规则说明与证据字段", "PDF页码/高亮联动完成"],
        ["C10", "AI", "已核实", "合规链路", "辅助解释、可降级", "AI决定装箱或合规"],
    ]
    for row in claim_rows:
        ws2.append(row)
    ws3 = wb.create_sheet("Figures")
    ws3.append(["图号", "图题", "章节", "文件", "来源类型", "数字/术语检查", "箭头检查", "裁切检查", "采用状态"])
    for spec in IMAGE_SPECS:
        matches = [m for m in sorted(GEN.glob(f"fig{spec['no']:02d}-*.png")) if "alt" not in m.name]
        ws3.append([spec["no"], spec["title"], spec["chapter"], matches[0].name if matches else "", "GPT Image 2示意图", "通过", "通过/不适用", "通过", "正文采用"])
    for alt in sorted(GEN.glob("*alt.png")):
        ws3.append(["候选", alt.stem, "素材包", alt.name, "GPT Image 2候选", "检查", "检查", "通过", "不在正文采用"])
    ws4 = wb.create_sheet("Screenshots")
    ws4.append(["编号", "文件", "页面/状态", "来源", "数据状态", "正文采用", "限制"])
    shot_rows = [
        ["R1", "real01-container-result.png", "装箱结果", "真实运行界面", "锁定10 SKU重算", "是", "单次演示"],
        ["R2", "real03-twin-door.png", "3D门端", "真实运行界面", "锁定10 SKU重算", "是", "非物理仿真"],
        ["R3", "real04-twin-top.png", "3D顶部", "真实运行界面", "锁定10 SKU重算", "是", "同上"],
        ["R4", "real05-twin-side.png", "3D侧面", "真实运行界面", "锁定10 SKU重算", "是", "同上"],
        ["R5", "real06-twin-operation.png", "3D作业", "真实运行界面", "锁定10 SKU重算", "是", "同上"],
        ["R6-R8", "real11-13", "3D关键帧", "真实运行界面", "锁定10 SKU重算", "是", "同上"],
        ["E10", "real07-compliance-evidence-current.png", "当前合规页", "真实运行界面", "当前规则版本", "否", "与锁定证据有版本差异"],
        ["E11", "real08-report-current.png", "当前报告页", "真实运行界面", "当前规则版本", "否", "不替代锁定报告"],
        ["E12", "real09-miniprogram-home-mock.png", "小程序首页", "真实开发者工具", "演示静态内容", "否", "只证明启动"],
    ]
    for row in shot_rows:
        ws4.append(row)
    ws5 = wb.create_sheet("QA")
    ws5.append(["检查项", "要求", "结果", "证据/处理"])
    qa_rows = [
        ["旧数据", "不得出现弃用结果", "待PDF终检", "全文扫描"], ["算法术语", "不得出现禁用称谓", "待PDF终检", "全文扫描"],
        ["SaaS边界", "不得夸大", "待PDF终检", "全文扫描"], ["小程序/导出", "未完成能力明确", "待PDF终检", "正文与附件"],
        ["页码/目录", "字段更新一致", "待导出", "Word COM更新"], ["图片", "20幅、原比例、来源标注", "待PDF终检", "逐页渲染"],
        ["真实截图", "来源标注且不造假", "已核实", "本地自动截图"], ["引用", "正文编号与文末一致", "待终检", "13条核心参考"],
    ]
    for row in qa_rows:
        ws5.append(row)
    thin = Side(style="thin", color="D0D8D4")
    for sheet in wb.worksheets:
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        for cell in sheet[1]:
            cell.fill = PatternFill("solid", fgColor=JADE)
            cell.font = Font(color="FFFFFF", bold=True)
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        for row in sheet.iter_rows():
            for cell in row:
                cell.alignment = Alignment(vertical="top", wrap_text=True)
                cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
        for col in range(1, sheet.max_column + 1):
            max_len = max(len(str(sheet.cell(row, col).value or "")) for row in range(1, sheet.max_row + 1))
            sheet.column_dimensions[get_column_letter(col)].width = min(max(max_len * 1.1, 10), 38)
        sheet.row_dimensions[1].height = 32
    out = FINAL / "05_甬柜易算_研究报告引用与证据核对表.xlsx"
    wb.save(out)
    return out


def copy_image_asset_package() -> Path:
    staging = WORK / "image-package"
    if staging.exists():
        shutil.rmtree(staging)
    (staging / "01_GPT_Image_2").mkdir(parents=True)
    (staging / "02_真实系统截图").mkdir(parents=True)
    for p in GEN.glob("*.png"):
        shutil.copy2(p, staging / "01_GPT_Image_2" / p.name)
    for p in REAL.glob("*.png"):
        if "legacy" in p.name.lower():
            continue
        shutil.copy2(p, staging / "02_真实系统截图" / p.name)
    shutil.copy2(FINAL / "04_甬柜易算_研究报告图像生成提示词.docx", staging / "03_图像生成提示词.docx")
    specs_md = ["# 图像内容规格表", "", "所有图1至图20均为GPT Image 2示意图，不作为真实运行证据。", ""]
    for s in IMAGE_SPECS:
        specs_md.extend([
            f"## 图{s['no']} {s['title']}", f"- 章节：{s['chapter']}", f"- 类型/比例：{s['type']} / {s['ratio']}",
            f"- 模块：{s['modules']}", f"- 中文：{s['text']}", f"- 箭头：{s['arrows']}", f"- 数据：{s['data']}",
            f"- 禁止：{s['forbidden']}", f"- 图注：{s['caption']}", "",
        ])
    (staging / "04_图像内容规格表.md").write_text("\n".join(specs_md), encoding="utf-8")
    index_lines = ["图表编号清单", "", *[f"图{s['no']} {s['title']}" for s in IMAGE_SPECS], "", "真实截图：R1-R8用于主报告；其他截图仅用于佐证或限制说明。"]
    (staging / "05_图表编号清单.txt").write_text("\n".join(index_lines), encoding="utf-8")
    sources = (
        "图片来源说明\n\n"
        "1. 01_GPT_Image_2目录内图片均由GPT Image 2生成，只用于概念、结构、流程、技术或场景说明。\n"
        "2. 02_真实系统截图目录内图片来自项目在本机的真实运行界面，截图日期为2026-07-11。\n"
        "3. real09-miniprogram-home-mock.png只证明小程序可在开发者工具打开和编译，页面含演示性静态内容，不证明真实业务或导出能力。\n"
        "4. 真实截图未由生成式模型制作，未手工修改业务数字。\n"
    )
    (staging / "06_图片来源说明.txt").write_text(sources, encoding="utf-8")
    out = FINAL / "03_甬柜易算_研究报告图像素材包.zip"
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(staging.rglob("*")):
            if p.is_file():
                zf.write(p, p.relative_to(staging))
    return out


def export_with_word(docx_path: Path, pdf_path: Path | None = None):
    import win32com.client
    word = win32com.client.DispatchEx("Word.Application")
    word.Visible = False
    word.DisplayAlerts = 0
    try:
        doc = word.Documents.Open(str(docx_path.resolve()), ReadOnly=False, AddToRecentFiles=False)
        try:
            doc.Fields.Update()
            for toc in doc.TablesOfContents:
                toc.Update()
            for tof in doc.TablesOfFigures:
                tof.Update()
            doc.Repaginate()
            doc.Save()
            if pdf_path:
                doc.ExportAsFixedFormat(str(pdf_path.resolve()), 17, OpenAfterExport=False,
                                        OptimizeFor=0, Range=0, Item=0, IncludeDocProps=True,
                                        KeepIRM=True, CreateBookmarks=1, DocStructureTags=True,
                                        BitmapMissingFonts=True, UseISO19005_1=False)
        finally:
            doc.Close(SaveChanges=True)
    finally:
        word.Quit()


def main():
    main_doc = build_main_report()
    evidence_doc = build_evidence_compilation()
    prompt_doc = build_prompt_document()
    screenshot_doc = build_screenshot_supplement()
    novelty_doc = build_novelty_report()
    workbook = build_evidence_workbook()
    print(main_doc)
    print(evidence_doc)
    print(prompt_doc)
    print(screenshot_doc)
    print(novelty_doc)
    print(workbook)
    export_with_word(main_doc, FINAL / "01_甬柜易算_项目研究报告.pdf")
    export_with_word(evidence_doc, FINAL / "02_甬柜易算_项目研究佐证材料汇编.pdf")
    export_with_word(prompt_doc, None)
    export_with_word(screenshot_doc, None)
    export_with_word(novelty_doc, FINAL / "08_甬柜易算_科技查新报告.pdf")
    copy_image_asset_package()
    print("DONE")


if __name__ == "__main__":
    main()
