from __future__ import annotations

import html
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PPT_MASTER = ROOT / "ppt-master"
PROJECT_ROOT = PPT_MASTER / "projects"
OUT_ROOT = ROOT / "outputs" / "yonggui_glass_consulting"
SCREENSHOTS = ROOT / "docs" / "final_product_integration" / "screenshots"

FONT = "Microsoft YaHei, Arial"

REAL = {
    "dashboard": "final-dashboard.png",
    "cargo": "final-cargo-input.png",
    "recommend": "final-container-recommendation.png",
    "container_after": "final-container-after-generate.png",
    "twin": "final-twin-3d.png",
    "compliance": "final-compliance-review.png",
    "regulation": "final-compliance-regulation-detail.png",
    "report": "final-report-export.png",
    "report_modal": "final-report-preview-modal.png",
    "e2e": "final-e2e-end-state.png",
}

REALITY = {
    "order": "NB2026-DEMO-01",
    "container": "40HQ",
    "input": "221",
    "loaded": "221",
    "unloaded": "0",
    "util": "84.51%",
    "weight": "8,812 kg",
    "compliance": "本地规则 WARNING / AI建议 PASS / 人工复核独立",
    "api": "24/27",
    "buttons": "49/49",
    "vlm": "Qwen3-VL：2/5 图片通过；前端上传通过",
}

SLIDES = [
    ("01_cover", "甬柜易算", "港前装柜智能决策系统"),
    ("02_pain", "装柜风险，正在进港前被放大", "中小卖家、货代仓库、港前物流共同承担返工与滞留成本"),
    ("03_solution", "从一票货开始，形成智能作业闭环", "货物录入 → 柜型推荐 → 3D 作业孪生 → 合规预审 → 报告导出"),
    ("04_workbench", "产品工作台：五类能力一体化", "Web / 小程序 / 后端 / AI / 3D 进入同一条作业链路"),
    ("05_vlm", "货物录入与 VLM：降低录入门槛", "SKU、尺寸重量、包装风险、拍照识别进入同一张事实表"),
    ("06_recommend", "柜型推荐：推荐结果必须讲得清楚", "40HQ 推荐、装箱约束、推荐理由和真实装箱结果同屏"),
    ("07_twin", "3D 作业孪生：从方案到现场动作", "把装箱坐标翻译成叉车路径、人工路径和顶部补位"),
    ("08_compliance", "合规预审与 RAG：每条风险都有依据", "VGM、LIFO、重心、IPPC、单证一致性可追溯"),
    ("09_ai_boundary", "AI 不是替代规则，而是解释规则", "AI 做解释、审计、建议；核心算法确定性执行"),
    ("10_architecture", "技术架构：前端、引擎、模型与法规库协同", "Three.js、DeepSeek、Qwen3-VL、RAG 服务于同一闭环"),
    ("11_acceptance", "真实联调与验收：成功项和注意项都可见", "真实接口、真实装箱、真实合规、真实导出，不假装外部服务全稳"),
    ("12_summary", "一个柜子装对、装稳、装合规", "让港前装柜从经验判断走向可计算、可解释、可执行、可复核"),
]

VERSIONS = {
    "version_A_glass_blue": {
        "project": "yonggui_glass_blue_final",
        "label": "Version A：浅蓝玻璃科技风",
        "summary": "吸收 glassmorphism_demo 的半透明玻璃卡片、淡科技蓝和轻量发光，适合线上腾讯会议共享屏幕。",
        "mode": "glass",
        "bg": "#EEF6FF",
        "bg2": "#F8FBFF",
        "ink": "#10233D",
        "muted": "#5F7088",
        "primary": "#246BFE",
        "primary2": "#55D6FF",
        "navy": "#112C4F",
        "accent": "#F2B84B",
        "success": "#24A46A",
        "danger": "#E15A4F",
        "card": "#FFFFFF",
        "card_opacity": "0.64",
        "stroke": "#FFFFFF",
        "line": "#B8D7F5",
    },
    "version_B_consulting_white": {
        "project": "yonggui_consulting_white_final",
        "label": "Version B：白底蓝金咨询风",
        "summary": "吸收 Kimsoong 的企业咨询型排版：大标题、关键数字、分区卡片、阶段路线和明确结论。",
        "mode": "consulting",
        "bg": "#F7FAFE",
        "bg2": "#FFFFFF",
        "ink": "#102033",
        "muted": "#56677D",
        "primary": "#173E67",
        "primary2": "#2E7BD9",
        "navy": "#0D2745",
        "accent": "#D7A641",
        "success": "#2D8A4E",
        "danger": "#D74C45",
        "card": "#FFFFFF",
        "card_opacity": "0.96",
        "stroke": "#D8E5F3",
        "line": "#DDE8F5",
    },
}


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def img(file: str, x: int, y: int, w: int, h: int, mode: str = "meet") -> str:
    preserve = "xMidYMid slice" if mode == "slice" else "xMidYMid meet"
    return f'<image href="../images/{file}" x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="{preserve}"/>'


def rect(x: int, y: int, w: int, h: int, fill: str, stroke: str | None = None,
         opacity: str = "1", rx: int = 12, sw: str = "1") -> str:
    stroke_part = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" fill-opacity="{opacity}"{stroke_part}/>'


def text(text: str, x: int, y: int, size: int, fill: str, weight: str = "400",
         anchor: str = "start") -> str:
    return f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{esc(text)}</text>'


def tblock(lines: list[str], x: int, y: int, size: int, fill: str, weight: str = "400", leading: int | None = None) -> str:
    leading = leading or int(size * 1.38)
    out = [f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}">']
    for i, line in enumerate(lines):
        dy = 0 if i == 0 else leading
        out.append(f'<tspan x="{x}" dy="{dy}">{esc(line)}</tspan>')
    out.append("</text>")
    return "\n".join(out)


def defs(v: dict) -> str:
    return f"""
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{v['bg2']}"/>
      <stop offset="48%" stop-color="{v['bg']}"/>
      <stop offset="100%" stop-color="#EAF4FF"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="{v['card_opacity']}"/>
      <stop offset="100%" stop-color="#ECF7FF" stop-opacity="0.52"/>
    </linearGradient>
    <linearGradient id="blueLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="{v['primary']}"/>
      <stop offset="100%" stop-color="{v['primary2']}"/>
    </linearGradient>
    <radialGradient id="orbA" cx="18%" cy="18%" r="55%">
      <stop offset="0%" stop-color="{v['primary2']}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="{v['primary2']}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbB" cx="88%" cy="12%" r="48%">
      <stop offset="0%" stop-color="{v['accent']}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="{v['accent']}" stop-opacity="0"/>
    </radialGradient>
  </defs>"""


def bg(v: dict) -> list[str]:
    parts = [
        '<rect width="1280" height="720" fill="url(#bgGrad)"/>',
        '<rect width="1280" height="720" fill="url(#orbA)"/>',
        '<rect width="1280" height="720" fill="url(#orbB)"/>',
    ]
    if v["mode"] == "glass":
        parts += [
            f'<path d="M88 612 C310 526 520 570 720 456 C894 358 1030 316 1212 260" fill="none" stroke="{v["primary2"]}" stroke-opacity="0.35" stroke-width="2"/>',
            f'<path d="M746 78 L1180 78 L1180 586" fill="none" stroke="{v["primary"]}" stroke-opacity="0.16" stroke-width="1.4"/>',
        ]
    else:
        parts += [
            f'<rect x="0" y="0" width="1280" height="7" fill="{v["success"]}"/>',
            f'<rect x="0" y="7" width="1280" height="2" fill="{v["accent"]}"/>',
        ]
    return parts


def title(v: dict, title_text: str, subtitle: str | None = None) -> list[str]:
    y = 88 if v["mode"] == "consulting" else 92
    parts = [
        text(title_text, 64, y, 38, v["ink"], "800"),
    ]
    if subtitle:
        parts.append(text(subtitle, 66, y + 34, 18, v["muted"], "500"))
    if v["mode"] == "glass":
        parts.append(f'<rect x="64" y="{y+48}" width="112" height="5" rx="2.5" fill="url(#blueLine)"/>')
    else:
        parts.append(f'<rect x="64" y="{y+46}" width="1110" height="34" rx="3" fill="{v["navy"]}" fill-opacity="0.96"/>')
        parts.append(text("核心结论", 84, y + 69, 15, "#FFFFFF", "700"))
    return parts


def card(v: dict, x: int, y: int, w: int, h: int, strong: bool = False) -> list[str]:
    fill = "url(#glass)" if v["mode"] == "glass" else v["card"]
    stroke = "#FFFFFF" if v["mode"] == "glass" else v["stroke"]
    op = "0.72" if v["mode"] == "glass" else "1"
    if strong and v["mode"] == "consulting":
        return [rect(x, y, w, h, "#FFFFFF", v["primary"], "1", 10, "1.6")]
    return [
        rect(x + 4, y + 8, w, h, "#9CB8D6", None, "0.14", 12),
        rect(x, y, w, h, fill, stroke, op, 12, "1.2"),
    ]


def shot(v: dict, file: str, x: int, y: int, w: int, h: int, label: str | None = None) -> list[str]:
    out = card(v, x - 12, y - 12, w + 24, h + 24, True)
    out += [
        rect(x, y, w, h, "#FFFFFF", v["line"], "1", 8, "1"),
        img(file, x + 8, y + 8, w - 16, h - 16, "meet"),
    ]
    if label:
        out += [
            rect(x + 18, y + 18, 186, 30, v["primary"], None, "0.92", 5),
            text(label, x + 34, y + 39, 15, "#FFFFFF", "700"),
        ]
    return out


def bullet(v: dict, items: list[str], x: int, y: int, size: int = 18, gap: int = 34) -> list[str]:
    out: list[str] = []
    for i, item in enumerate(items):
        yy = y + i * gap
        out.append(f'<circle cx="{x}" cy="{yy-6}" r="5" fill="{v["accent"]}"/>')
        out.append(text(item, x + 18, yy, size, v["ink"], "500"))
    return out


def metric(v: dict, x: int, y: int, value: str, label: str, sub: str = "", color: str | None = None) -> list[str]:
    color = color or v["primary"]
    out = card(v, x, y, 196, 112, True)
    out += [
        text(value, x + 24, y + 50, 32, color, "800"),
        text(label, x + 24, y + 80, 16, v["ink"], "700"),
    ]
    if sub:
        out.append(text(sub, x + 24, y + 104, 12, v["muted"], "500"))
    return out


def wrap(v: dict, content: list[str]) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">\n'
        + defs(v)
        + '\n  <g id="slide">\n'
        + "\n".join(content)
        + "\n  </g>\n</svg>\n"
    )


def slide_01(v: dict) -> str:
    p = bg(v)
    p += [
        text("甬柜易算", 76, 210, 70, v["ink"], "800"),
        tblock(["港前装柜智能决策系统", "可计算 · 可解释 · 可执行 · 可复核"], 80, 276, 30, v["primary"], "800", 42),
        text("把港前装柜从经验判断，变成智能作业闭环", 82, 386, 22, v["muted"], "500"),
    ]
    p += shot(v, REAL["dashboard"], 720, 166, 430, 272)
    p += card(v, 80, 504, 650, 88)
    p += [
        text("真实联调口径", 112, 542, 20, v["ink"], "800"),
        text(f"{REALITY['container']} · {REALITY['loaded']}/{REALITY['input']} 件 · {REALITY['util']} · {REALITY['compliance']}", 112, 574, 24, v["primary"], "800"),
    ]
    return wrap(v, p)


def slide_02(v: dict) -> str:
    p = bg(v) + title(v, "装柜风险，正在进港前被放大", "一个柜子装错，成本会沿着货主、货代仓库、港前物流传递")
    pain = [
        ("中小卖家", "SKU、尺寸重量、包装风险难以一次录准"),
        ("货代 / 仓库", "经验排柜、返搬沟通、执行口径不一致"),
        ("港前物流", "VGM、LIFO、重心、IPPC、单证风险需前置"),
    ]
    for i, (name, desc) in enumerate(pain):
        x = 86 + i * 374
        p += card(v, x, 220, 320, 210, True)
        p += [text(f"0{i+1}", x + 26, 270, 28, v["accent"], "800"),
              text(name, x + 26, 318, 26, v["ink"], "800"),
              tblock([desc[:18], desc[18:]], x + 26, 368, 18, v["muted"], "500", 28)]
    p += metric(v, 150, 510, "5 类", "柜内风险", "VGM / LIFO / 重心等")
    p += metric(v, 382, 510, "3 方", "责任链条", "卖家 / 仓库 / 港前物流")
    p += metric(v, 614, 510, "1 个", "核心空白", "进港前柜内装载")
    return wrap(v, p)


def slide_03(v: dict) -> str:
    p = bg(v) + title(v, "从一票货开始，形成智能作业闭环", "货物录入 → 柜型推荐 → 3D 作业孪生 → 合规预审 → 报告导出")
    steps = ["货物录入", "柜型推荐", "3D 作业孪生", "合规预审", "报告导出"]
    for i, step in enumerate(steps):
        x = 84 + i * 226
        p += card(v, x, 242, 178, 132, i in (0, 4))
        p += [text(f"{i+1}", x + 22, 286, 28, v["accent"], "800"),
              text(step, x + 22, 334, 22, v["ink"], "800")]
        if i < len(steps) - 1:
            p.append(f'<path d="M{x+180} 308 L{x+220} 308" stroke="{v["primary"]}" stroke-width="2.2" stroke-opacity="0.55"/>')
    p += shot(v, REAL["e2e"], 336, 448, 566, 160)
    p += [text("闭环交付不是一张效果图，而是可复核的装柜方案、合规结果和报告文件", 90, 656, 20, v["primary"], "800")]
    return wrap(v, p)


def slide_04(v: dict) -> str:
    p = bg(v) + title(v, "产品工作台：五类能力一体化", "Web / 小程序 / 后端 / AI / 3D 进入同一条作业链路")
    p += shot(v, REAL["dashboard"], 696, 190, 450, 284)
    modules = [("Web 工作台", "订单、装箱、合规、报告"), ("小程序现场端", "拍照录入、现场查看"), ("后端中枢", "Node.js / Express"), ("AI 能力", "DeepSeek、Qwen3-VL、RAG"), ("3D 作业孪生", "Three.js 可视化执行")]
    for i, (name, desc) in enumerate(modules):
        x = 84 + (i % 2) * 282
        y = 202 + (i // 2) * 96
        p += card(v, x, y, 248, 72)
        p += [text(name, x + 20, y + 30, 19, v["ink"], "800"),
              text(desc, x + 20, y + 56, 14, v["muted"], "500")]
    return wrap(v, p)


def slide_05(v: dict) -> str:
    p = bg(v) + title(v, "货物录入与 VLM：降低录入门槛", "SKU、尺寸重量、包装风险、拍照识别进入同一张事实表")
    p += shot(v, REAL["cargo"], 640, 176, 520, 328)
    p += card(v, 82, 206, 474, 266, True)
    p += [text("录入事实表", 112, 252, 26, v["ink"], "800")]
    p += bullet(v, ["SKU 与目的港", "尺寸 / 重量 / 件数", "包装属性与木包装风险", "VLM 识别结果需人工复核"], 118, 310, 20, 42)
    p += card(v, 82, 524, 700, 70)
    p += [text("真实口径", 110, 556, 18, v["ink"], "800"),
          text("Qwen3-VL-32B 已真实调用；2/5 图片通过，前端上传通过；失败图片不展示假成功", 210, 556, 18, v["primary"], "700")]
    return wrap(v, p)


def slide_06(v: dict) -> str:
    p = bg(v) + title(v, "柜型推荐：推荐结果必须讲得清楚", "40HQ 推荐、装箱约束、推荐理由和真实装箱结果同屏")
    p += shot(v, REAL["recommend"], 620, 188, 520, 328)
    p += metric(v, 86, 218, "40HQ", "推荐柜型", "真实接口返回")
    p += metric(v, 316, 218, f"{REALITY['loaded']}/{REALITY['input']}", "装入结果", f"未装入 {REALITY['unloaded']} 件")
    p += metric(v, 86, 362, REALITY["util"], "空间利用率", "演示订单真实结果")
    p += metric(v, 316, 362, REALITY["weight"], "总重量", "真实装箱结果")
    p += card(v, 86, 542, 686, 58)
    p += [text("推荐理由：在当前订单下，40HQ 能在空间、重量、装载稳定性之间取得更优平衡", 114, 579, 19, v["ink"], "700")]
    return wrap(v, p)


def slide_07(v: dict) -> str:
    p = bg(v) + title(v, "3D 作业孪生：从方案到现场动作", "把装箱坐标翻译成叉车路径、人工路径和顶部补位")
    p += shot(v, REAL["twin"], 458, 160, 710, 420, "核心主视觉")
    p += card(v, 74, 206, 326, 278, True)
    p += [text("现场可执行", 104, 258, 26, v["ink"], "800")]
    p += bullet(v, ["叉车路径", "人工搬运路径", "顶部轻货补位", "语音/步骤提示", "后续可替换演示视频"], 110, 316, 20, 36)
    p += card(v, 74, 586, 900, 50)
    p += [text("这页作为技术高潮：不是展示模型，而是证明算法结果能转成工人可执行动作", 106, 619, 20, v["primary"], "800")]
    return wrap(v, p)


def slide_08(v: dict) -> str:
    p = bg(v) + title(v, "合规预审与 RAG：每条风险都有依据", "VGM、LIFO、重心、IPPC、单证一致性可追溯")
    p += shot(v, REAL["compliance"], 696, 192, 448, 286)
    cols = [("合规体检", ["VGM", "LIFO", "重心"]), ("风险预审", ["IPPC", "单证一致性", "装载稳定"]), ("RAG 溯源", ["法规列表", "证据条款", "整改建议"])]
    for i, (name, items) in enumerate(cols):
        x = 82 + i * 196
        p += card(v, x, 224, 164, 230, True)
        p += [text(name, x + 20, 268, 21, v["ink"], "800")]
        p += bullet(v, items, x + 26, 320, 17, 35)
    p += card(v, 82, 532, 778, 72)
    p += [text("稳妥法规类别", 112, 562, 18, v["ink"], "800"),
          text("SOLAS VGM 要求 / CTU 装载规范 / 相关 GB 国家标准 / 交通运输行业规范 / IPPC 木包装要求", 112, 590, 17, v["primary"], "700")]
    return wrap(v, p)


def slide_09(v: dict) -> str:
    p = bg(v) + title(v, "AI 不是替代规则，而是解释规则", "AI 做解释、审计、建议；核心算法确定性执行")
    p += card(v, 88, 220, 500, 270, True)
    p += card(v, 692, 220, 420, 270, True)
    p += [text("确定性算法", 122, 278, 28, v["ink"], "800"),
          text("AI 能力", 728, 278, 28, v["primary"], "800")]
    p += bullet(v, ["坐标与摆放顺序", "VGM / 重心 / LIFO", "承压与可达性", "硬校验可复现"], 126, 342, 21, 38)
    p += bullet(v, ["VLM 录货", "柜型推荐解释", "RAG 法规检索", "审计与整改建议"], 732, 342, 21, 38)
    p += card(v, 88, 548, 830, 62)
    p += [text("边界表达：AI 可降级，硬规则仍然有效；不让大模型直接猜物理坐标", 118, 588, 21, v["primary"], "800")]
    return wrap(v, p)


def slide_10(v: dict) -> str:
    p = bg(v) + title(v, "技术架构：前端、引擎、模型与法规库协同", "Three.js、DeepSeek、Qwen3-VL、RAG 服务于同一闭环")
    layers = [("前端层", "Web Dashboard / 小程序 / Three.js"), ("服务层", "Node.js / Express / API 编排"), ("装箱引擎", "Fast Block多约束三维装箱引擎 / 真实装箱"), ("AI 与法规", "DeepSeek / Qwen3-VL / RAG 知识库"), ("输出层", "HTML / CSV / JSON 报告")]
    for i, (name, desc) in enumerate(layers):
        x = 100 + i * 216
        p += card(v, x, 248, 176, 156, i in (2, 3))
        p += [text(f"0{i+1}", x + 22, 292, 24, v["accent"], "800"),
              text(name, x + 22, 330, 22, v["ink"], "800"),
              tblock([desc[:20], desc[20:]], x + 22, 368, 14, v["muted"], "500", 22)]
        if i < 4:
            p.append(f'<path d="M{x+178} 326 L{x+214} 326" stroke="{v["primary"]}" stroke-width="2" stroke-opacity="0.55"/>')
    p += card(v, 124, 510, 1030, 68)
    p += [text("真实接口检查：24/27 通过；RAG 9 个关键词命中；按钮行为 49/49 通过", 154, 552, 21, v["primary"], "800")]
    return wrap(v, p)


def slide_11(v: dict) -> str:
    p = bg(v) + title(v, "真实联调与验收：成功项和注意项都可见", "真实接口、真实装箱、真实合规、真实导出，不假装外部服务全稳")
    p += shot(v, REAL["e2e"], 662, 178, 470, 306)
    rows = [("真实接口", "24/27 通过"), ("真实装箱", "221/221，84.51%"), ("真实合规", "本地规则 WARNING / AI建议 PASS / 人工复核独立"), ("真实导出", "HTML / CSV / JSON"), ("VLM 注意项", "2/5 图片通过，失败不展示假成功")]
    for i, (name, val) in enumerate(rows):
        y = 202 + i * 70
        p += card(v, 86, y, 498, 50, i < 4)
        p += [text(name, 112, y + 32, 19, v["ink"], "800"),
              text(val, 292, y + 32, 19, v["primary"] if i < 4 else v["danger"], "800")]
    p += [text("当前外部阻断：无；录屏建议选用已通过链路和推荐图片", 90, 610, 20, v["primary"], "800")]
    return wrap(v, p)


def slide_12(v: dict) -> str:
    p = bg(v) + title(v, "一个柜子装对、装稳、装合规", "让港前装柜从经验判断走向可计算、可解释、可执行、可复核")
    values = [("装对", "算法约束坐标与顺序"), ("装稳", "重心、承压、可达性"), ("装合规", "RAG 证据与报告导出")]
    for i, (name, desc) in enumerate(values):
        x = 112 + i * 350
        p += card(v, x, 242, 286, 170, True)
        p += [text(name, x + 36, 312, 42, v["primary"], "800"),
              text(desc, x + 36, 362, 20, v["ink"], "700")]
    p += shot(v, REAL["report"], 726, 462, 386, 152)
    p += card(v, 112, 486, 540, 96)
    p += [text("最终交付", 144, 526, 22, v["ink"], "800"),
          text("装柜方案、作业路径、合规预审、法规证据、导出报告", 144, 560, 20, v["primary"], "800")]
    return wrap(v, p)


RENDERERS = [slide_01, slide_02, slide_03, slide_04, slide_05, slide_06, slide_07, slide_08, slide_09, slide_10, slide_11, slide_12]


def notes() -> str:
    notes_map = [
        ("01_cover", "开场说明：甬柜易算是一套港前装柜智能决策系统，目标是把港前装柜从经验判断变成可计算、可解释、可执行、可复核的闭环。"),
        ("02_pain", "这一页讲痛点。中小卖家、货代仓库、港前物流都在为柜内装载不确定性买单，风险集中在进港前。"),
        ("03_solution", "这一页讲总览。我们的流程从货物录入开始，经过柜型推荐、3D 作业孪生、合规预审，最后形成报告导出。"),
        ("04_workbench", "这一页讲产品工作台。Web、小程序、后端、AI 和 3D 不是分散功能，而是围绕同一票货的作业链路。"),
        ("05_vlm", "这一页讲货物录入和 VLM。VLM 降低录入门槛，但识别结果需要人工复核，失败图片不会被包装成成功。"),
        ("06_recommend", "这一页讲柜型推荐。真实订单推荐 40HQ，并展示真实装箱结果 221/221、空间利用率 84.51%。"),
        ("07_twin", "这一页是技术主视觉。3D 作业孪生把装箱结果转成叉车路径、人工路径和顶部补位，是算法落地到现场的关键。"),
        ("08_compliance", "这一页讲合规预审和 RAG。风险项要有法规类别和证据来源，支持复核和整改建议。"),
        ("09_ai_boundary", "这一页讲 AI 边界。AI 不替代物理规则，核心装箱算法确定性执行；AI 做解释、审计、建议和检索。"),
        ("10_architecture", "这一页讲技术架构。前端、后端、装箱引擎、Three.js、DeepSeek、Qwen3-VL 和 RAG 法规库协同工作。"),
        ("11_acceptance", "这一页讲真实联调。真实接口、装箱、合规、报告导出均有证据；VLM 部分图片失败但不展示假成功。"),
        ("12_summary", "总结：甬柜易算要解决的是把每一个柜子装对、装稳、装合规，让港前装柜可计算、可解释、可执行、可复核。"),
    ]
    return "\n\n---\n\n".join(f"# {name}\n\n{text}" for name, text in notes_map) + "\n"


def design_style(v: dict) -> str:
    return f"""# {v['label']} DESIGN_STYLE

## 参考来源

- `glassmorphism_demo.pptx`：吸收半透明玻璃卡片、淡蓝科技光感、少字大图、中心化主视觉。
- `kimsoong_loyalty_programme.pptx`：吸收企业咨询型大标题、关键数据、分区卡片、阶段路线和清晰结论。

## 本版风格

{v['summary']}

## 视觉规则

- 背景：白色 / 极浅蓝灰 / 淡科技蓝，不使用暗黑红金背景。
- 卡片：半透明或浅白底、细边框、柔和阴影、轻微渐变。
- 字体：微软雅黑 / Arial，标题大、正文少、强主次。
- 截图：使用 `docs/final_product_integration/screenshots` 最新真实截图，按比例嵌入。
- 数据：只使用真实联调口径；演示样例必须显式标注。

## 真实性口径

- 订单：{REALITY['order']}
- 柜型：{REALITY['container']}
- 装箱：{REALITY['loaded']}/{REALITY['input']}，未装入 {REALITY['unloaded']}，空间利用率 {REALITY['util']}
- 合规：{REALITY['compliance']}
- VLM：{REALITY['vlm']}；失败图片不展示假成功
- 当前外部阻断：无
"""


def spec_lock(v: dict) -> str:
    colors = "\n".join(f"- {k}: {val}" for k, val in v.items() if isinstance(val, str) and k not in {"project", "label", "summary", "mode"})
    shared_colors = "\n".join([
        "- bg_soft_blue: #EAF4FF",
        "- glass_soft_blue: #ECF7FF",
        "- shadow_blue: #9CB8D6",
        "- white: #FFFFFF",
    ])
    images = "\n".join(f"- {file} | real-screenshot | existing | no-crop" for file in REAL.values())
    sizes = "\n".join(f"- size_{s}: {s}" for s in [12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28, 30, 32, 38, 42, 56, 70])
    pages = "\n".join(f"- P{i:02d}: {name}" for i, (name, _, _) in enumerate(SLIDES, 1))
    return f"""# Execution Lock - {v['label']}

## canvas
- width: 1280
- height: 720
- format: ppt169

## visual_style
- style: light glassmorphism consulting
- mode: {v['mode']}

## colors
{colors}
{shared_colors}

## typography
- font_family: {FONT}
{sizes}

## images
{images}

## page_layouts
{pages}

## constraints
- No dark red-gold background.
- No page numbers, QR codes, URLs, mojibake, or fake data.
- Screenshots must preserve aspect ratio.
"""


def copy_assets(project: Path) -> None:
    image_dir = project / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    for file in REAL.values():
        shutil.copy2(SCREENSHOTS / file, image_dir / file)


def init_version(key: str, v: dict) -> tuple[Path, Path]:
    project = PROJECT_ROOT / v["project"]
    out = OUT_ROOT / key
    if project.exists():
        shutil.rmtree(project)
    if out.exists():
        shutil.rmtree(out)
    for sub in ["svg_output", "svg_final", "images", "notes", "exports", "analysis", "icons", "sources", "templates"]:
        (project / sub).mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    copy_assets(project)
    (project / "design_spec.md").write_text(design_style(v), encoding="utf-8")
    (project / "spec_lock.md").write_text(spec_lock(v), encoding="utf-8")
    (project / "notes" / "total.md").write_text(notes(), encoding="utf-8")
    for (name, _, _), render in zip(SLIDES, RENDERERS):
        (project / "svg_output" / f"{name}.svg").write_text(render(v), encoding="utf-8")
    (out / "DESIGN_STYLE.md").write_text(design_style(v), encoding="utf-8")
    (out / "SPEAKER_NOTES.md").write_text(notes(), encoding="utf-8")
    return project, out


def main() -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    for key, version in VERSIONS.items():
        project, out = init_version(key, version)
        print(key, project, out)


if __name__ == "__main__":
    main()
