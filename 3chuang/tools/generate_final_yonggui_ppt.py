from __future__ import annotations

import html
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PPT_MASTER = ROOT / "ppt-master"
PROJECT = PPT_MASTER / "projects" / "final_yonggui_ppt_red_gold"
OUT = ROOT / "outputs" / "final_yonggui_ppt"
DESIGN_REFS = ROOT / "docs" / "design_refs"
AI_DIR = PPT_MASTER / "projects" / "yonggui_yisuan_guosai_gptimage_ppt169_20260629" / "images"

FONT = "Microsoft YaHei, Arial"

C = {
    "bg": "#07050A",
    "bg2": "#100409",
    "black": "#000000",
    "panel": "#240912",
    "panel2": "#35101A",
    "panel3": "#120A10",
    "red": "#E60012",
    "deep_red": "#8F0012",
    "gold": "#F6C85F",
    "gold2": "#B8860B",
    "gold3": "#FFE2A0",
    "text": "#FFF6E5",
    "muted": "#E2C8A8",
    "line": "#743032",
    "blue": "#28C7FF",
    "blue2": "#0B1B2A",
    "blue3": "#13344B",
    "white": "#FFFFFF",
    "green": "#18D08F",
    "warn": "#FF744D",
}

AI = {
    "cover": "anchor_cover_hero.png",
    "pain": "anchor_pain_hero.png",
    "risk": "risk_hero.png",
    "position": "positioning_hero.png",
    "loop": "loop_hero.png",
    "arch": "architecture_hero.png",
    "algo": "algorithm_hero.png",
    "fast": "fastblock_hero.png",
    "ai": "ai_boundary_hero.png",
    "compliance": "compliance_hero.png",
    "demo": "demo_hero.png",
    "summary": "summary_hero.png",
}

REAL = {
    "cargo": "cargo-input.png",
    "dashboard": "dashboard.png",
    "recommend": "container-recommendation.png",
    "twin": "twin-3d.png",
    "compliance": "compliance-review.png",
    "report": "report-export.png",
}


SLIDES = [
    ("01_cover", "甬柜易算"),
    ("02_pain", "一个柜子装错，四方一起买单"),
    ("03_risks", "真正的风险，藏在柜子里面"),
    ("04_positioning", "我们聚焦进港前的柜内装载空白"),
    ("05_loop", "从一票货开始，完成港前装柜闭环"),
    ("06_architecture", "Web、小程序、后端智能中枢三端一体"),
    ("07_constraints", "六类业务约束协同机制：不只装满，更要装对"),
    ("08_fastblock", "Fast Block多约束三维装箱引擎：大批量装箱更快、更稳、更可控"),
    ("09_ai_boundary", "AI 不替代物理规则，AI 让规则更好理解"),
    ("10_compliance", "每条风险都能追溯"),
    ("11_twin", "从算法排布，到工人能照着装"),
    ("12_summary", "把每一个柜子装对、装稳、装合规"),
]


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def img(name: str, x: int, y: int, w: int, h: int, mode: str = "slice") -> str:
    preserve = "xMidYMid slice" if mode == "slice" else "xMidYMid meet"
    return f'<image href="../images/{name}" x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="{preserve}"/>'


def rect(x: int, y: int, w: int, h: int, fill: str, stroke: str | None = None,
         opacity: str = "1", rx: int = 8, sw: str = "1") -> str:
    stroke_part = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" fill-opacity="{opacity}"{stroke_part}/>'


def text_line(text: str, x: int, y: int, size: int, fill: str,
              weight: str = "400", anchor: str = "start") -> str:
    return (
        f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
        f'font-weight="{weight}" text-anchor="{anchor}" fill="{fill}">{esc(text)}</text>'
    )


def text_block(lines: list[str], x: int, y: int, size: int, fill: str,
               weight: str = "400", leading: int | None = None) -> str:
    leading = leading or int(size * 1.45)
    body = [f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}">']
    for i, line in enumerate(lines):
        dy = 0 if i == 0 else leading
        body.append(f'<tspan x="{x}" dy="{dy}">{esc(line)}</tspan>')
    body.append("</text>")
    return "\n".join(body)


def defs() -> str:
    return f"""
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="{C['bg']}" stop-opacity="0.98"/>
      <stop offset="48%" stop-color="{C['bg']}" stop-opacity="0.76"/>
      <stop offset="100%" stop-color="{C['black']}" stop-opacity="0.18"/>
    </linearGradient>
    <linearGradient id="panelGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{C['panel2']}" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="{C['panel']}" stop-opacity="0.82"/>
    </linearGradient>
    <linearGradient id="techPanel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{C['blue3']}" stop-opacity="0.84"/>
      <stop offset="100%" stop-color="{C['panel']}" stop-opacity="0.88"/>
    </linearGradient>
    <linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="{C['red']}" stop-opacity="0.95"/>
      <stop offset="36%" stop-color="{C['gold']}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="{C['blue']}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>"""


def base(bg_file: str, overlay: str = "0.50", tech: bool = False) -> list[str]:
    parts = [
        f'<rect width="1280" height="720" fill="{C["bg"]}"/>',
        img(bg_file, 0, 0, 1280, 720, "slice"),
        f'<rect width="1280" height="720" fill="{C["black"]}" fill-opacity="{overlay}"/>',
        '<rect width="1280" height="720" fill="url(#shade)"/>',
        f'<rect x="64" y="46" width="118" height="6" rx="3" fill="{C["gold"]}"/>',
        f'<rect x="194" y="46" width="48" height="6" rx="3" fill="{C["red"]}"/>',
    ]
    if tech:
        parts += [
            f'<path d="M742 90 L1180 90 L1180 610" fill="none" stroke="{C["blue"]}" stroke-opacity="0.28" stroke-width="1.4"/>',
            f'<path d="M692 644 C810 590 910 586 1016 512 C1090 460 1142 398 1218 368" fill="none" stroke="{C["blue"]}" stroke-opacity="0.48" stroke-width="2"/>',
            f'<circle cx="1180" cy="90" r="4" fill="{C["blue"]}" fill-opacity="0.8"/>',
            f'<circle cx="1016" cy="512" r="4" fill="{C["gold"]}" fill-opacity="0.8"/>',
        ]
    return parts


def title(title_text: str, subtitle: str | None = None, y: int = 108) -> list[str]:
    parts = [text_line(title_text, 64, y, 40, C["text"], "800")]
    if subtitle:
        parts.append(text_line(subtitle, 66, y + 40, 20, C["muted"], "400"))
    return parts


def bullet_list(items: list[str], x: int, y: int, size: int = 22, color: str = C["text"], gap: int = 42) -> list[str]:
    out: list[str] = []
    for i, item in enumerate(items):
        yy = y + i * gap
        out.append(rect(x, yy - 22, 8, 26, C["gold"], None, "1", 2))
        out.append(text_line(item, x + 24, yy, size, color, "500"))
    return out


def screenshot_card(file: str, x: int, y: int, w: int, h: int, label: str | None = None,
                    stroke: str = C["gold"]) -> list[str]:
    parts = [
        rect(x - 14, y - 14, w + 28, h + 28, C["black"], stroke, "0.52", 10, "1.3"),
        rect(x - 5, y - 5, w + 10, h + 10, C["white"], C["gold"], "0.10", 8, "1"),
        img(file, x, y, w, h, "meet"),
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="none" stroke="{C["white"]}" stroke-opacity="0.24" stroke-width="1"/>',
    ]
    if label:
        parts += [
            rect(x + 20, y + 18, 168, 34, C["black"], C["gold"], "0.70", 5, "1"),
            text_line(label, x + 38, y + 41, 18, C["gold"], "700"),
        ]
    return parts


def wrap(content: list[str]) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">\n'
        + defs()
        + '\n  <g id="slide">\n'
        + "\n".join(content)
        + "\n  </g>\n</svg>\n"
    )


def slide_01() -> str:
    p = base(AI["cover"], "0.40")
    p += [
        f'<rect x="0" y="0" width="1280" height="720" fill="{C["black"]}" fill-opacity="0.10"/>',
        f'<path d="M64 512 C258 454 398 468 548 406 C748 324 930 292 1216 292" fill="none" stroke="{C["gold"]}" stroke-opacity="0.62" stroke-width="2"/>',
        text_line("甬柜易算", 64, 220, 76, C["text"], "800"),
        text_block(["面向宁波港港前装柜场景的", "柜内装载合规与 AI 作业孪生系统"], 68, 286, 28, C["gold"], "700", 38),
        text_line("把港前装柜从经验判断，变成可计算、可解释、可执行、可复核、可导出的智能决策闭环", 68, 382, 22, C["muted"], "500"),
        rect(64, 548, 424, 62, C["panel"], C["gold"], "0.82", 8, "1.4"),
        text_line("装对 · 装稳 · 装合规", 96, 588, 28, C["text"], "800"),
    ]
    return wrap(p)


def slide_02() -> str:
    p = base(AI["pain"], "0.58")
    p += title("一个柜子装错，四方一起买单", "装柜错误会沿着订单、配载、现场、审核链条同步放大")
    roles = [
        ("中小卖家", "不会配载，返工拖慢交付"),
        ("货代配载员", "经验排柜，改单沟通反复"),
        ("仓库工人", "看不懂方案，现场返搬冲突"),
        ("港前审核人员", "资料与现场不一致，风险难闭环"),
    ]
    for i, (name, desc) in enumerate(roles):
        x = 86 + (i % 2) * 548
        y = 228 + (i // 2) * 158
        p += [
            rect(x, y, 486, 110, "url(#panelGrad)", C["line"], "0.88", 8, "1.1"),
            text_line(f"0{i+1}", x + 28, y + 46, 30, C["gold"], "800"),
            text_line(name, x + 92, y + 44, 26, C["text"], "800"),
            text_line(desc, x + 92, y + 82, 21, C["muted"], "500"),
        ]
    p += [rect(86, 592, 780, 48, C["black"], C["gold"], "0.50", 7, "1"),
          text_line("痛点不是某一方效率低，而是柜内装载缺少可计算、可复核的共同语言", 112, 623, 22, C["gold"], "700")]
    return wrap(p)


def slide_03() -> str:
    p = base(AI["risk"], "0.56")
    p += title("真正的风险，藏在柜子里面", "柜外流转可视，但柜内怎么装、怎么证明、怎么执行更难")
    risks = [
        ("VGM 申报", "重量偏差影响装船条件"),
        ("LIFO 顺序", "多港点倒箱与理货成本"),
        ("重心偏移", "拖车、吊装、运输稳定风险"),
        ("合规资料", "木包装、危险品、单证需可追溯"),
        ("现场执行", "方案必须转成可操作步骤"),
    ]
    for i, (name, desc) in enumerate(risks):
        x = 78 + i * 236
        y = 246
        p += [
            rect(x, y, 204, 250, C["panel"], C["line"], "0.83", 8, "1"),
            f'<circle cx="{x+102}" cy="{y+62}" r="38" fill="{C["deep_red"]}" fill-opacity="0.82" stroke="{C["gold"]}" stroke-width="1.4"/>',
            text_line(str(i + 1), x + 102, y + 74, 32, C["gold3"], "800", "middle"),
            text_line(name, x + 102, y + 136, 24, C["text"], "800", "middle"),
            text_block([desc[:12], desc[12:]], x + 26, y + 178, 18, C["muted"], "500", 28),
        ]
    p += [text_line("VGM、LIFO、重心、资料、现场执行，是进港前最容易被低估的五个柜内风险点", 86, 606, 23, C["gold"], "700")]
    return wrap(p)


def slide_04() -> str:
    p = base(AI["position"], "0.56")
    p += title("我们聚焦进港前的柜内装载空白", "港口系统覆盖柜外流转，甬柜易算补足柜内装载")
    p += screenshot_card(REAL["dashboard"], 720, 214, 450, 292)
    p += [
        rect(78, 232, 560, 316, "url(#panelGrad)", C["line"], "0.84", 8, "1"),
        text_line("不替代港口系统，而是把能力前移到进港前", 108, 284, 26, C["gold"], "800"),
    ]
    p += bullet_list([
        "柜外：车辆、堆场、桥吊、箱位流转已高度数字化",
        "柜内：装载顺序、重心、承压、单证仍依赖经验",
        "切入点：发货人与货代责任区的港前预审工具",
    ], 108, 350, 22, C["text"], 54)
    p += [rect(78, 600, 790, 42, C["black"], C["gold"], "0.48", 7, "1"),
          text_line("价值边界清楚：把柜子里面的风险，在进港前算清楚、讲清楚、导出来", 104, 628, 20, C["gold"], "700")]
    return wrap(p)


def slide_05() -> str:
    p = base(AI["loop"], "0.58")
    p += title("从一票货开始，完成港前装柜闭环", "录货、推荐、装箱、孪生、预审、溯源、导出一次跑通")
    p += screenshot_card(REAL["cargo"], 758, 238, 384, 250)
    steps = ["VLM 拍照录货", "AI 柜型推荐", "六类业务约束协同机制", "3D 作业孪生", "AI 合规预审", "RAG 法规溯源", "作业单 / 报告导出"]
    for i, step in enumerate(steps):
        x = 80 + (i % 4) * 156
        y = 238 + (i // 4) * 124
        p += [
            rect(x, y, 136, 72, C["panel"], C["gold"] if i in (0, 6) else C["line"], "0.84", 7, "1"),
            text_line(f"{i+1}", x + 18, y + 30, 20, C["gold"], "800"),
            text_block([step.replace(" / ", " /")], x + 18, y + 56, 18, C["text"], "700", 22),
        ]
        if i not in (3, 6):
            p.append(f'<path d="M{x+139} {y+36} L{x+156} {y+36}" stroke="{C["gold"]}" stroke-width="2" stroke-opacity="0.65"/>')
    p += [text_line("从一票货进入系统开始，输出的是现场能执行、审核能复核的装柜闭环", 84, 626, 22, C["gold"], "700")]
    return wrap(p)


def slide_06() -> str:
    p = base(AI["arch"], "0.58")
    p += title("Web、小程序、后端智能中枢三端一体", "同一套事实贯穿现场录入、算法计算、合规审计和交付导出")
    p += screenshot_card(REAL["dashboard"], 762, 250, 382, 238)
    layers = [
        ("Web 演示端", "3D、合规、报告主舞台"),
        ("微信小程序现场端", "拍照、轻录入、现场查看"),
        ("Node.js/Express 后端", "统一调度业务、算法和 AI 能力"),
        ("算法引擎", "Fast Block多约束三维装箱引擎"),
        ("AI 与法规能力", "VLM、RAG、解释、整改建议"),
    ]
    for i, (name, desc) in enumerate(layers):
        x = 84
        y = 214 + i * 72
        p += [
            rect(x, y, 570, 54, C["panel"], C["line"], "0.84", 7, "1"),
            text_line(name, x + 24, y + 34, 22, C["gold"], "800"),
            text_line(desc, x + 228, y + 34, 20, C["text"], "500"),
        ]
    p += [text_line("系统输出：装柜方案、作业单、合规报告、法规证据", 88, 620, 23, C["gold"], "800")]
    return wrap(p)


def slide_07() -> str:
    p = base(AI["algo"], "0.58", tech=True)
    p += title("六类业务约束协同机制：不只装满，更要装对", "装箱坐标是硬决策，必须可复现、可审计、可执行")
    p += screenshot_card(REAL["recommend"], 744, 230, 402, 260, stroke=C["blue"])
    dims = [
        "LIFO 卸货顺序", "动态重心控制", "同 SKU 聚集",
        "堆叠承压", "叉车 / 人工可达", "入港合规预审",
    ]
    for i, item in enumerate(dims):
        x = 86 + (i % 2) * 284
        y = 228 + (i // 2) * 92
        p += [
            rect(x, y, 248, 66, "url(#techPanel)", C["blue"] if i in (1, 4) else C["gold"], "0.82", 8, "1"),
            text_line(f"0{i+1}", x + 22, y + 42, 22, C["blue"] if i in (1, 4) else C["gold"], "800"),
            text_line(item, x + 70, y + 42, 21, C["text"], "700"),
        ]
    p += [text_line("确定性算法负责坐标、重心、承压、顺序和合规硬约束", 88, 620, 22, C["gold"], "800")]
    return wrap(p)


def slide_08() -> str:
    p = base(AI["fast"], "0.58", tech=True)
    p += title("Fast Block多约束三维装箱引擎：大批量装箱更快、更稳、更可控", "把多 SKU 货物先成块，再切片、补位、预测和硬校验")
    p += screenshot_card(REAL["recommend"], 756, 238, 386, 252, stroke=C["blue"])
    steps = [
        ("同 SKU 成块", "减少组合碎片"),
        ("切片装载", "层级推进更稳定"),
        ("同港补位", "不破坏 LIFO"),
        ("重心预测", "提前拒绝偏载位置"),
        ("顶部轻货补位", "利用空间不压损"),
        ("LIFO 硬校验", "顺序不对不放行"),
    ]
    for i, (name, desc) in enumerate(steps):
        x = 84 + (i % 2) * 306
        y = 224 + (i // 2) * 94
        p += [
            rect(x, y, 270, 70, C["panel"] if i % 2 == 0 else C["blue2"], C["gold"] if i % 2 == 0 else C["blue"], "0.84", 8, "1"),
            text_line(name, x + 22, y + 32, 21, C["gold"], "800"),
            text_line(desc, x + 22, y + 58, 18, C["muted"], "500"),
        ]
    p += [rect(84, 612, 760, 42, C["black"], C["blue"], "0.48", 7, "1"),
          text_line("面向 500 到 1000 件大批量订单：压缩搜索空间，同时守住硬规则", 110, 640, 20, C["gold"], "800")]
    return wrap(p)


def slide_09() -> str:
    p = base(AI["ai"], "0.58", tech=True)
    p += title("AI 不替代物理规则，AI 让规则更好理解", "工业合规场景需要可信分工，而不是让大模型直接猜坐标")
    p += [
        rect(84, 220, 500, 318, C["panel"], C["gold"], "0.84", 9, "1.2"),
        rect(648, 220, 500, 318, C["blue2"], C["blue"], "0.82", 9, "1.2"),
        text_line("确定性算法负责硬决策", 122, 278, 28, C["gold"], "800"),
        text_line("AI 负责理解与解释", 686, 278, 28, C["blue"], "800"),
    ]
    p += bullet_list(["装箱坐标", "VGM / 重心", "LIFO / 承压", "入港合规硬校验"], 124, 342, 23, C["text"], 44)
    p += bullet_list(["VLM 录货", "柜型推荐", "RAG 检索", "整改解释与语音指导"], 688, 342, 23, C["text"], 44)
    p += [text_line("边界清楚：AI 可以降级，硬规则仍然有效", 88, 620, 23, C["gold"], "800")]
    return wrap(p)


def slide_10() -> str:
    p = base(AI["compliance"], "0.58")
    p += title("每条风险都能追溯", "合规预审不是黑箱，风险项要能回到法规证据")
    p += screenshot_card(REAL["compliance"], 766, 236, 390, 258)
    columns = [
        ("合规体检", ["VGM 重量验证", "LIFO 卸货顺序", "重心偏移检查"]),
        ("进港前风险预审", ["木包装 IPPC", "单证一致性", "风险等级提示"]),
        ("RAG 法规溯源", ["SOLAS VGM 要求", "CTU 装载规范", "相关 GB 国家标准", "交通运输行业规范", "IPPC 木包装要求"]),
    ]
    for i, (name, lines) in enumerate(columns):
        x = 78 + i * 218
        p += [
            rect(x, 228, 194, 318, C["panel"], C["line"], "0.84", 8, "1"),
            text_line(name, x + 22, 276, 24, C["gold"], "800"),
        ]
        for j, line in enumerate(lines):
            yy = 326 + j * 40
            p.append(f'<circle cx="{x+28}" cy="{yy-7}" r="5" fill="{C["gold"]}"/>')
            p.append(text_line(line, x + 44, yy, 18, C["text"], "500"))
    p += [text_line("有依据、可追溯、可复核、可给出整改建议", 84, 620, 23, C["gold"], "800")]
    return wrap(p)


def slide_11() -> str:
    p = [
        f'<rect width="1280" height="720" fill="{C["black"]}"/>',
        img(AI["demo"], 0, 0, 1280, 720, "slice"),
        f'<rect width="1280" height="720" fill="{C["black"]}" fill-opacity="0.54"/>',
        f'<rect x="0" y="0" width="1280" height="76" fill="{C["black"]}" fill-opacity="0.78"/>',
        f'<rect x="0" y="644" width="1280" height="76" fill="{C["black"]}" fill-opacity="0.78"/>',
        f'<path d="M52 642 C238 586 380 590 536 518 C730 430 882 392 1230 366" fill="none" stroke="{C["blue"]}" stroke-opacity="0.54" stroke-width="2.4"/>',
        f'<path d="M64 104 L214 104" stroke="{C["gold"]}" stroke-width="6" stroke-linecap="round"/>',
        f'<path d="M228 104 L286 104" stroke="{C["red"]}" stroke-width="6" stroke-linecap="round"/>',
        text_line("从算法排布，到工人能照着装", 64, 156, 42, C["text"], "800"),
        text_line("3D 作业孪生把装箱坐标翻译成现场动作", 66, 194, 20, C["muted"], "500"),
    ]
    p += [
        rect(64, 254, 388, 286, C["panel3"], C["line"], "0.82", 8, "1.2"),
        text_line("现场执行四件事", 94, 306, 25, C["gold"], "800"),
    ]
    p += bullet_list(["叉车路径：重货从柜门推入", "人工路径：轻货与易碎品分步搬运", "顶部补位：轻货补空且保留可达性", "语音提示：现场少看屏也能执行"], 98, 360, 20, C["text"], 42)
    p += screenshot_card(REAL["twin"], 540, 186, 650, 386, label="真实演示视频占位", stroke=C["blue"])
    p += [text_line("技术高潮页：后续可把该区域替换为真实项目演示视频", 68, 682, 20, C["gold"], "800")]
    return wrap(p)


def slide_12() -> str:
    p = base(AI["summary"], "0.58")
    p += title("把每一个柜子装对、装稳、装合规", "最终交付不是一张图，而是装柜方案、作业单、合规报告与法规证据")
    p += screenshot_card(REAL["report"], 742, 236, 404, 256)
    values = [
        ("对中小卖家", "降低返工和滞留风险"),
        ("对货代 / 仓库", "方案可算，现场可装"),
        ("对港前物流", "风险前置，证据可查，入港更顺畅"),
    ]
    for i, (name, desc) in enumerate(values):
        y = 246 + i * 98
        p += [
            rect(84, y, 540, 72, C["panel"], C["line"], "0.84", 8, "1"),
            text_line(name, 112, y + 31, 24, C["gold"], "800"),
            text_line(desc, 294, y + 31, 22, C["text"], "600"),
        ]
    p += [
        rect(84, 598, 890, 52, C["black"], C["gold"], "0.50", 8, "1"),
        text_line("让柜内装载风险，在进港前被看见、被计算、被解决", 112, 632, 25, C["gold"], "800"),
    ]
    return wrap(p)


RENDERERS = [
    slide_01, slide_02, slide_03, slide_04, slide_05, slide_06,
    slide_07, slide_08, slide_09, slide_10, slide_11, slide_12,
]


def notes() -> str:
    note_text = [
        ("01_cover", "开场说明项目名称“甬柜易算”。一句话说明：我们聚焦宁波港港前装柜，把柜内装载从经验判断变成可计算、可解释、可执行、可复核、可导出的智能决策闭环。"),
        ("02_pain", "这一页讲真实痛点。一个柜子装错，不只是仓库返工，中小卖家、货代配载员、仓库工人、港前审核人员都会承担成本，问题本质是缺少共同可复核的装柜方案。"),
        ("03_risks", "这一页把柜内风险拆开。VGM、LIFO、重心、合规资料和现场执行不是抽象概念，而是进港前经常被低估的五个风险点。"),
        ("04_positioning", "这一页讲项目切入。港口系统更多解决柜外流转，甬柜易算不替代港口系统，而是补足进港前柜内装载方案、预审和导出这一段空白。"),
        ("05_loop", "这一页讲系统闭环。从 VLM 拍照录货开始，经 AI 柜型推荐、六类业务约束协同机制、3D 作业孪生、AI 合规预审、RAG 法规溯源，最后导出作业单和报告。"),
        ("06_architecture", "这一页讲架构。Web 端负责演示和主流程，小程序贴近现场录入，Node.js/Express 后端统一调度算法、AI 和法规能力，最终输出可执行交付物。"),
        ("07_constraints", "这一页讲硬算法。六类业务约束协同机制不是只追求装满，而是同时守住 LIFO、重心、SKU 聚集、承压、可达和入港合规等硬约束。"),
        ("08_fastblock", "这一页讲提效。FastBlock 面向大批量订单，先让同 SKU 成块，再切片装载、同港补位、重心预测、顶部轻货补位，并做 LIFO 硬校验。"),
        ("09_ai_boundary", "这一页讲 AI 边界。AI 不直接决定物理坐标，确定性算法负责硬规则；AI 负责感知、推荐、检索、解释、整改建议和语音指导。"),
        ("10_compliance", "这一页讲合规可信。合规预审不是黑箱，每条风险都能回到法规类别和证据，包括 SOLAS VGM 要求、CTU 装载规范、相关 GB 国家标准、交通运输行业规范、IPPC 木包装要求。"),
        ("11_twin", "这一页是技术高潮。3D 作业孪生把算法坐标翻译成工人能照着装的路径、步骤和语音提示，右侧区域后续可以替换为真实演示视频。"),
        ("12_summary", "最后总结项目价值。对中小卖家降低返工和滞留风险，对货代和仓库让方案可算、现场可装，对港前物流实现风险前置、证据可查、入港更顺畅。"),
    ]
    return "\n\n---\n\n".join(f"# {name}\n\n{text}" for name, text in note_text) + "\n"


def design_spec() -> str:
    rows = "\n".join(f"| {i:02d} | {title} | 12 页答辩主线中的第 {i} 个叙事节点 |" for i, (_, title) in enumerate(SLIDES, 1))
    return f"""# final_yonggui_ppt_red_gold Design Spec

## Goal
生成“甬柜易算”线上国赛答辩 12 页 16:9 PPT，主风格为红金国赛科技风，吸收 3D 页电影港口氛围、正文页高清晰度、算法页蓝黑技术线条。

## Page Structure
| 页 | 标题 | 页面任务 |
|---|---|---|
{rows}

## Constraints
- 不写“全球首创”“完全自动化”“替代人工”等不稳表述。
- AI 不直接决定物理坐标，确定性算法负责硬规则。
- 不生成页码、角标、二维码、网址或乱码。
- 标题、正文、标签、流程和卡片尽量保持可编辑。
"""


def spec_lock() -> str:
    color_lines = "\n".join(f"- {k}: {v}" for k, v in C.items())
    images = "\n".join([f"- {v} | generated-main-visual | existing | crop" for v in AI.values()] +
                       [f"- {v} | product-screenshot | existing | no-crop" for v in REAL.values()])
    sizes = [16, 18, 20, 21, 22, 23, 24, 25, 26, 28, 30, 32, 34, 36, 38, 40, 42, 48, 56, 64, 76]
    size_lines = "\n".join(f"- size_{s}: {s}" for s in sizes)
    pages = "\n".join(f"- P{i:02d}: {name}" for i, (name, _) in enumerate(SLIDES, 1))
    return f"""# Execution Lock - final_yonggui_ppt_red_gold

## canvas
- width: 1280
- height: 720
- format: ppt169

## mode
- mode: briefing

## visual_style
- visual_style: custom
- behavior: A red-gold national competition technology style; P11 absorbs cinematic port industrial style; P07-P09 use restrained blue-black technology lines.

## colors
{color_lines}

## typography
- font_family: {FONT}
- title_family: {FONT}
- body_family: {FONT}
- emphasis_family: {FONT}
{size_lines}

## images
{images}

## page_layouts
{pages}

## execution_constraints
- No page numbers, corner labels, QR codes, urls, mojibake, or unstable claims.
- Text is editable SVG/PPT text; screenshots are evidence windows and must use preserveAspectRatio meet.
- P11 must reserve a visible video placeholder area.
"""


def copy_assets() -> None:
    image_dir = PROJECT / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    for filename in AI.values():
        shutil.copy2(AI_DIR / filename, image_dir / filename)
    for filename in REAL.values():
        shutil.copy2(DESIGN_REFS / filename, image_dir / filename)


def init_project() -> None:
    if PROJECT.exists():
        shutil.rmtree(PROJECT)
    if OUT.exists():
        shutil.rmtree(OUT)
    for sub in ["svg_output", "svg_final", "images", "notes", "exports", "analysis", "icons", "sources", "templates"]:
        (PROJECT / sub).mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    copy_assets()
    (PROJECT / "design_spec.md").write_text(design_spec(), encoding="utf-8")
    (PROJECT / "spec_lock.md").write_text(spec_lock(), encoding="utf-8")
    (PROJECT / "notes" / "total.md").write_text(notes(), encoding="utf-8")
    for (name, _), render in zip(SLIDES, RENDERERS):
        (PROJECT / "svg_output" / f"{name}.svg").write_text(render(), encoding="utf-8")
    (OUT / "speaker_notes.md").write_text(notes(), encoding="utf-8")


if __name__ == "__main__":
    init_project()
    print(PROJECT)
    print(OUT)
