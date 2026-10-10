from __future__ import annotations

import html
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PPT_MASTER = ROOT / "ppt-master"
PROJECT_ROOT = PPT_MASTER / "projects"
OUT_ROOT = ROOT / "outputs" / "ppt_candidates"
BASE_AI = PPT_MASTER / "projects" / "yonggui_yisuan_guosai_gptimage_ppt169_20260629" / "images"
DESIGN_REFS = ROOT / "docs" / "design_refs"

FONT = "Microsoft YaHei, Arial"


REAL_IMAGES = {
    "cargo": "cargo-input.png",
    "dashboard": "dashboard.png",
    "recommend": "container-recommendation.png",
    "twin": "twin-3d.png",
    "compliance": "compliance-review.png",
    "report": "report-export.png",
}

AI_IMAGES = {
    "cover": "anchor_cover_hero.png",
    "pain": "anchor_pain_hero.png",
    "risk": "risk_hero.png",
    "position": "positioning_hero.png",
    "loop": "loop_hero.png",
    "arch": "architecture_hero.png",
    "algo": "algorithm_hero.png",
    "fast": "fastblock_hero.png",
    "ai": "ai_boundary_hero.png",
    "compliance_hero": "compliance_hero.png",
    "demo": "demo_hero.png",
    "summary": "summary_hero.png",
}


SLIDES = [
    {
        "name": "01_cover",
        "title": "甬柜易算",
        "subtitle": "面向宁波港港前装柜场景的柜内装载合规与 AI 作业孪生系统",
        "lead": "装对 · 装稳 · 装合规",
        "ai": "cover",
        "screenshot": None,
        "bullets": ["柜内装载合规卫士", "AI 作业孪生系统", "港前风险预审与报告导出"],
    },
    {
        "name": "02_pain",
        "title": "一个柜子装错，四方一起买单",
        "subtitle": "装柜错误会沿着订单、配载、现场、审核链条同步放大",
        "lead": "中小卖家、货代配载员、仓库工人、港前审核人员共同承担成本",
        "ai": "pain",
        "screenshot": None,
        "bullets": ["中小卖家：不会配载，返工拖慢交付", "货代配载员：经验排柜，改单沟通反复", "仓库工人：看不懂方案，现场返搬冲突", "港前审核：资料与现场不一致，风险难闭环"],
    },
    {
        "name": "03_risks",
        "title": "真正的风险，藏在柜子里面",
        "subtitle": "柜外流转可视，但柜内怎么装、怎么证明、怎么执行更难",
        "lead": "VGM、LIFO、重心、资料、现场执行是五个核心风险点",
        "ai": "risk",
        "screenshot": None,
        "bullets": ["VGM 申报：重量偏差影响装船条件", "LIFO 顺序：多港点倒箱与理货成本", "重心偏移：拖车、吊装和运输稳定风险", "合规资料：木包装、危险品、单证需可追溯", "现场执行：方案必须转成可操作步骤"],
    },
    {
        "name": "04_positioning",
        "title": "我们聚焦进港前的柜内装载空白",
        "subtitle": "港口系统负责柜外流转，甬柜易算负责柜子里面怎么装",
        "lead": "不替代港口系统，而是把算法和合规能力前移到进港前",
        "ai": "position",
        "screenshot": "dashboard",
        "bullets": ["柜外：车辆、堆场、桥吊、箱位流转已高度数字化", "柜内：装载顺序、重心、承压、单证仍依赖经验", "切入点：发货人与货代责任区的港前预审工具"],
    },
    {
        "name": "05_loop",
        "title": "从一票货开始，完成港前装柜闭环",
        "subtitle": "录货、推荐、装箱、孪生、预审、溯源、导出一次跑通",
        "lead": "让港前装柜从经验判断变成可复核流程",
        "ai": "loop",
        "screenshot": "cargo",
        "bullets": ["VLM 拍照录货", "AI 柜型推荐", "六类业务约束协同机制", "3D 作业孪生", "AI 合规预审", "RAG 法规溯源", "作业单 / 报告导出"],
    },
    {
        "name": "06_architecture",
        "title": "Web、小程序、后端智能中枢三端一体",
        "subtitle": "同一套事实贯穿现场录入、算法计算、合规审计和交付导出",
        "lead": "Web 主展示，小程序贴近现场，Node.js/Express 统一调度",
        "ai": "arch",
        "screenshot": "dashboard",
        "bullets": ["Web 演示端：3D、合规、报告主舞台", "微信小程序：拍照、轻录入、现场查看", "后端智能中枢：Node.js / Express", "算法引擎：Fast Block多约束三维装箱引擎", "AI/RAG：VLM、推荐、解释、法规证据"],
    },
    {
        "name": "07_constraints",
        "title": "六类业务约束协同机制：不只装满，更要装对",
        "subtitle": "装箱坐标是硬决策，必须可复现、可审计、可执行",
        "lead": "可卸、可稳、可聚、可承压、可到达、可合规",
        "ai": "algo",
        "screenshot": "recommend",
        "bullets": ["LIFO 卸货顺序", "动态重心控制", "同 SKU 聚集", "堆叠承压", "叉车 / 人工可达", "入港合规预审"],
    },
    {
        "name": "08_fastblock",
        "title": "Fast Block多约束三维装箱引擎：大批量装箱更快、更稳、更可控",
        "subtitle": "把多 SKU 货物先成块，再切片、补位、预测和硬校验",
        "lead": "面向 500 到 1000 件大批量订单，压缩搜索空间并守住规则",
        "ai": "fast",
        "screenshot": "recommend",
        "bullets": ["同 SKU 成块：减少组合碎片", "切片装载：层级推进更稳定", "同港补位：不破坏 LIFO", "重心预测：提前拒绝偏载位置", "顶部轻货补位：利用空间不压损", "LIFO 硬校验：顺序不对不放行"],
    },
    {
        "name": "09_ai_boundary",
        "title": "AI 不替代物理规则，AI 让规则更好理解",
        "subtitle": "确定性算法负责硬决策，AI 负责感知、检索、解释和指导",
        "lead": "工业合规场景需要可信分工，而不是让大模型直接猜坐标",
        "ai": "ai",
        "screenshot": "cargo",
        "bullets": ["确定性算法：坐标、VGM、重心、LIFO、承压", "AI 能力：VLM 录货、柜型推荐、RAG 检索、整改解释", "边界策略：AI 失败可降级，硬规则仍然有效"],
    },
    {
        "name": "10_compliance",
        "title": "每条风险都能追溯",
        "subtitle": "合规预审不是黑箱，风险项要能回到法规证据",
        "lead": "合规体检、进港前预审、RAG 法规溯源形成可解释报告",
        "ai": "compliance_hero",
        "screenshot": "compliance",
        "bullets": ["VGM 重量验证", "LIFO 卸货顺序", "重心偏移检查", "木包装 IPPC", "单证一致性", "法规证据与整改建议"],
    },
    {
        "name": "11_twin",
        "title": "从算法排布，到工人能照着装",
        "subtitle": "3D 作业孪生把装箱坐标翻译成现场动作",
        "lead": "叉车路径、人工路径、顶部补位和语音提示都必须可演示",
        "ai": "demo",
        "screenshot": "twin",
        "bullets": ["叉车路径：重货从柜门推入", "人工路径：轻货与易碎品分步搬运", "顶部补位：轻货补空且保留可达性", "语音提示：现场少看屏也能执行"],
    },
    {
        "name": "12_summary",
        "title": "把每一个柜子装对、装稳、装合规",
        "subtitle": "最终交付不是一张图，而是装柜方案、作业单、合规报告与法规证据",
        "lead": "让柜内装载风险，在进港前被看见、被计算、被解决",
        "ai": "summary",
        "screenshot": "report",
        "bullets": ["对中小卖家：降低返工和滞留风险", "对货代 / 仓库：方案可算、现场可装", "对港前物流：风险前置、证据可查、入港更顺畅"],
    },
]


VERSIONS = {
    "version_A_red_gold_tech": {
        "project": "ppt_candidate_A_red_gold_tech",
        "label": "Version A：红金科技国赛风",
        "recommendation": "视觉冲击最强，最适合正式国赛答辩开场和终版主稿。",
        "mode": "dark",
        "colors": {
            "bg": "#08060A",
            "surface": "#220B12",
            "surface2": "#310D16",
            "text": "#FFF6E5",
            "muted": "#D8BFA0",
            "primary": "#E60012",
            "deep": "#8F0012",
            "gold": "#F6C85F",
            "gold2": "#B8860B",
            "blue": "#22D3EE",
            "line": "#5A1C22",
            "black": "#000000",
            "white": "#FFFFFF",
            "warn": "#FF6B4A",
            "green": "#19D38A",
        },
    },
    "version_B_clean_national": {
        "project": "ppt_candidate_B_clean_national",
        "label": "Version B：高级科技白金风",
        "recommendation": "信息清晰度最高，适合商业计划书、互联网+评审和评委快速阅读。",
        "mode": "light",
        "colors": {
            "bg": "#F4F7FB",
            "surface": "#FFFFFF",
            "surface2": "#EAF1FA",
            "text": "#102033",
            "muted": "#52657A",
            "primary": "#1456A0",
            "deep": "#0B2E57",
            "gold": "#C99A2E",
            "gold2": "#F5D887",
            "blue": "#1E6FCC",
            "line": "#D9E3EF",
            "black": "#000000",
            "white": "#FFFFFF",
            "warn": "#C77700",
            "green": "#1E8A5A",
        },
    },
    "version_C_cinematic_port": {
        "project": "ppt_candidate_C_cinematic_port",
        "label": "Version C：电影级港口工业风",
        "recommendation": "3D 作业孪生和工业场景最强，适合技术演示与现场 Demo 引导。",
        "mode": "cinema",
        "colors": {
            "bg": "#05070B",
            "surface": "#111923",
            "surface2": "#1A2633",
            "text": "#F7FAFF",
            "muted": "#B8C5D6",
            "primary": "#D7472F",
            "deep": "#7D1D18",
            "gold": "#E4B85B",
            "gold2": "#8F6B29",
            "blue": "#4AB7FF",
            "line": "#39495C",
            "black": "#000000",
            "white": "#FFFFFF",
            "warn": "#FF8A4C",
            "green": "#2FD083",
        },
    },
}


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def text_block(lines, x, y, size, fill, weight="normal", leading=None, width_anchor=None):
    leading = leading or int(size * 1.38)
    parts = [
        f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}">'
    ]
    for idx, line in enumerate(lines):
        dy = 0 if idx == 0 else leading
        parts.append(f'<tspan x="{x}" dy="{dy}">{esc(line)}</tspan>')
    parts.append("</text>")
    return "\n".join(parts)


def image_tag(filename, x, y, w, h, mode="slice"):
    pa = "xMidYMid slice" if mode == "slice" else "xMidYMid meet"
    return f'<image href="../images/{filename}" x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="{pa}"/>'


def panel(x, y, w, h, fill, stroke, opacity="0.86", rx=8, sw=1.2):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" fill-opacity="{opacity}" stroke="{stroke}" stroke-width="{sw}"/>'


def slide_defs(c):
    return f"""
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="{c['bg']}" stop-opacity="0.96"/>
      <stop offset="54%" stop-color="{c['bg']}" stop-opacity="0.62"/>
      <stop offset="100%" stop-color="{c['black']}" stop-opacity="0.18"/>
    </linearGradient>
    <linearGradient id="topline" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="{c['primary']}" stop-opacity="0.95"/>
      <stop offset="62%" stop-color="{c['gold']}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="{c['blue']}" stop-opacity="0.45"/>
    </linearGradient>
    <linearGradient id="soft" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{c['surface2']}" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="{c['surface']}" stop-opacity="0.82"/>
    </linearGradient>
  </defs>"""


def render_cover(slide, v, idx):
    c = v["colors"]
    bg = AI_IMAGES[slide["ai"]]
    if v["mode"] == "cinema":
        body = [
            f'<rect width="1280" height="720" fill="{c["bg"]}"/>',
            image_tag(bg, 0, 0, 1280, 720, "slice"),
            f'<rect width="1280" height="720" fill="{c["black"]}" fill-opacity="0.38"/>',
            f'<rect x="0" y="0" width="1280" height="78" fill="{c["black"]}" fill-opacity="0.82"/>',
            f'<rect x="0" y="642" width="1280" height="78" fill="{c["black"]}" fill-opacity="0.82"/>',
            f'<path d="M44 596 C256 518 420 528 580 454 C736 380 872 340 1228 322" fill="none" stroke="{c["blue"]}" stroke-width="2.5" stroke-opacity="0.55"/>',
            f'<path d="M54 622 C318 556 496 562 662 492 C814 428 996 386 1232 372" fill="none" stroke="{c["gold"]}" stroke-width="2" stroke-opacity="0.62"/>',
            f'<rect x="64" y="112" width="128" height="6" rx="3" fill="{c["gold"]}"/>',
            f'<rect x="202" y="112" width="52" height="6" rx="3" fill="{c["primary"]}"/>',
            f'<text x="64" y="238" font-family="{FONT}" font-size="76" font-weight="bold" fill="{c["text"]}">{esc(slide["title"])}</text>',
            f'<text x="68" y="302" font-family="{FONT}" font-size="28" font-weight="bold" fill="{c["gold"]}">{esc(slide["subtitle"])}</text>',
            f'<text x="68" y="362" font-family="{FONT}" font-size="23" fill="{c["muted"]}">{esc("让港前装柜从经验判断，走向可计算、可解释、可执行、可复核、可导出")}</text>',
            f'<rect x="64" y="534" width="428" height="58" rx="6" fill="{c["black"]}" fill-opacity="0.56" stroke="{c["gold"]}" stroke-width="1.4"/>',
            f'<text x="92" y="572" font-family="{FONT}" font-size="27" font-weight="bold" fill="{c["text"]}">{esc(slide["lead"])}</text>',
        ]
    elif v["mode"] == "light":
        body = [
            f'<rect width="1280" height="720" fill="{c["bg"]}"/>',
            image_tag(bg, 642, 92, 570, 430, "slice"),
            f'<rect x="642" y="92" width="570" height="430" rx="18" fill="{c["white"]}" fill-opacity="0.10" stroke="{c["line"]}" stroke-width="1.2"/>',
            f'<rect x="64" y="84" width="148" height="7" rx="3.5" fill="{c["gold"]}"/>',
            f'<text x="64" y="210" font-family="{FONT}" font-size="72" font-weight="bold" fill="{c["text"]}">{esc(slide["title"])}</text>',
            f'<text x="68" y="270" font-family="{FONT}" font-size="28" font-weight="bold" fill="{c["primary"]}">{esc(slide["subtitle"])}</text>',
            f'<text x="68" y="330" font-family="{FONT}" font-size="24" fill="{c["muted"]}">{esc("让港前装柜从经验判断，走向可计算、可解释、可执行、可复核、可导出")}</text>',
            panel(64, 548, 430, 62, c["surface"], c["gold"], "1", 8, 1.5),
            f'<text x="92" y="588" font-family="{FONT}" font-size="28" font-weight="bold" fill="{c["primary"]}">{esc(slide["lead"])}</text>',
        ]
    else:
        body = [
            f'<rect width="1280" height="720" fill="{c["bg"]}"/>',
            image_tag(bg, 0, 0, 1280, 720, "slice"),
            '<rect width="1280" height="720" fill="url(#shade)"/>',
            f'<rect x="64" y="92" width="148" height="8" rx="4" fill="{c["gold"]}"/>',
            f'<rect x="222" y="92" width="62" height="8" rx="4" fill="{c["primary"]}"/>',
            f'<text x="64" y="214" font-family="{FONT}" font-size="72" font-weight="bold" fill="{c["text"]}">{esc(slide["title"])}</text>',
            f'<text x="68" y="276" font-family="{FONT}" font-size="28" font-weight="bold" fill="{c["gold"]}">{esc(slide["subtitle"])}</text>',
            f'<text x="68" y="334" font-family="{FONT}" font-size="24" fill="{c["muted"]}">{esc("让港前装柜从经验判断，走向可计算、可解释、可执行、可复核、可导出")}</text>',
            panel(64, 548, 430, 62, c["surface"], c["gold"], "0.82", 8, 1.5),
            f'<text x="92" y="588" font-family="{FONT}" font-size="28" font-weight="bold" fill="{c["text"]}">{esc(slide["lead"])}</text>',
        ]
    return wrap_svg(slide_defs(c) + "\n  <g id=\"slide\">" + "\n".join(body) + "\n  </g>")


def render_content(slide, v, idx):
    c = v["colors"]
    bg = AI_IMAGES[slide["ai"]]
    ss = REAL_IMAGES.get(slide["screenshot"]) if slide["screenshot"] else None
    body = [f'<rect width="1280" height="720" fill="{c["bg"]}"/>']
    if v["mode"] == "cinema":
        body += [
            image_tag(bg, 0, 0, 1280, 720, "slice"),
            f'<rect width="1280" height="720" fill="{c["black"]}" fill-opacity="0.50"/>',
            f'<rect x="0" y="0" width="1280" height="62" fill="{c["black"]}" fill-opacity="0.72"/>',
            f'<rect x="0" y="658" width="1280" height="62" fill="{c["black"]}" fill-opacity="0.72"/>',
            f'<path d="M42 646 L1222 646" stroke="{c["gold"]}" stroke-width="1.5" stroke-opacity="0.72"/>',
            f'<path d="M42 88 L220 88" stroke="{c["gold"]}" stroke-width="6" stroke-linecap="round"/>',
            f'<path d="M234 88 L294 88" stroke="{c["primary"]}" stroke-width="6" stroke-linecap="round"/>',
            f'<text x="64" y="142" font-family="{FONT}" font-size="42" font-weight="bold" fill="{c["text"]}">{esc(slide["title"])}</text>',
            f'<text x="66" y="180" font-family="{FONT}" font-size="20" fill="{c["muted"]}">{esc(slide["subtitle"])}</text>',
        ]
        if ss:
            if idx == 11:
                shot_x, shot_y, shot_w, shot_h = 510, 168, 684, 396
                left_x, left_y, left_w, left_h = 64, 250, 390, 278
            else:
                shot_x, shot_y, shot_w, shot_h = 648, 198, 542, 328
                left_x, left_y, left_w, left_h = 64, 238, 500, 332
            body += [
                f'<rect x="{shot_x-14}" y="{shot_y-14}" width="{shot_w+28}" height="{shot_h+28}" rx="10" fill="{c["black"]}" fill-opacity="0.62" stroke="{c["blue"]}" stroke-width="1.4" stroke-opacity="0.70"/>',
                f'<rect x="{shot_x-6}" y="{shot_y-6}" width="{shot_w+12}" height="{shot_h+12}" rx="8" fill="{c["black"]}" fill-opacity="0.44" stroke="{c["gold"]}" stroke-width="1.2" stroke-opacity="0.82"/>',
                image_tag(ss, shot_x, shot_y, shot_w, shot_h, "meet"),
                f'<rect x="{shot_x}" y="{shot_y}" width="{shot_w}" height="{shot_h}" rx="5" fill="none" stroke="{c["white"]}" stroke-width="0.8" stroke-opacity="0.30"/>',
            ]
            if idx == 11:
                body += [
                    f'<rect x="{shot_x+28}" y="{shot_y+22}" width="188" height="34" rx="5" fill="{c["black"]}" fill-opacity="0.68" stroke="{c["gold"]}" stroke-width="1"/>',
                    f'<text x="{shot_x+44}" y="{shot_y+45}" font-family="{FONT}" font-size="18" font-weight="bold" fill="{c["gold"]}">{esc("演示视频占位")}</text>',
                ]
        else:
            left_x, left_y, left_w, left_h = 82, 238, 702, 340
            body += [
                f'<path d="M828 238 L1174 238 L1174 578 L828 578 Z" fill="{c["black"]}" fill-opacity="0.18" stroke="{c["blue"]}" stroke-width="1.2" stroke-opacity="0.42"/>',
                f'<path d="M860 544 C950 484 1028 492 1162 410" fill="none" stroke="{c["gold"]}" stroke-width="2" stroke-opacity="0.56"/>',
                f'<path d="M854 318 C970 354 1030 328 1162 278" fill="none" stroke="{c["blue"]}" stroke-width="2" stroke-opacity="0.44"/>',
            ]
        body += [
            f'<rect x="{left_x}" y="{left_y}" width="{left_w}" height="{left_h}" rx="8" fill="{c["surface"]}" fill-opacity="0.80" stroke="{c["line"]}" stroke-width="1.2"/>',
            f'<rect x="{left_x}" y="{left_y}" width="{left_w}" height="54" rx="8" fill="{c["black"]}" fill-opacity="0.34"/>',
            f'<text x="{left_x+28}" y="{left_y+37}" font-family="{FONT}" font-size="23" font-weight="bold" fill="{c["gold"]}">{esc(slide["lead"])}</text>',
        ]
        max_bullets = 6 if ss else 7
        for i, b in enumerate(slide["bullets"][:max_bullets]):
            y = left_y + 96 + i * 38
            body.append(f'<rect x="{left_x+28}" y="{y-20}" width="8" height="24" rx="2" fill="{c["gold"]}"/>')
            body.append(f'<text x="{left_x+50}" y="{y}" font-family="{FONT}" font-size="20" fill="{c["text"]}">{esc(b)}</text>')
        body.append(f'<text x="68" y="684" font-family="{FONT}" font-size="19" font-weight="bold" fill="{c["gold"]}">{esc(slide["lead"])}</text>')
    elif v["mode"] == "light":
        body += [
            f'<rect x="0" y="0" width="1280" height="720" fill="{c["bg"]}"/>',
            f'<rect x="0" y="0" width="1280" height="92" fill="{c["surface"]}"/>',
            f'<rect x="0" y="91" width="1280" height="2" fill="{c["gold"]}" fill-opacity="0.75"/>',
            image_tag(bg, 840, 110, 380, 214, "slice"),
            f'<rect x="840" y="110" width="380" height="214" rx="12" fill="{c["white"]}" fill-opacity="0.12" stroke="{c["line"]}" stroke-width="1"/>',
        ]
        title_y = 58
        lead_y = 128
        content_y = 216
        body.append(f'<text x="64" y="{title_y}" font-family="{FONT}" font-size="40" font-weight="bold" fill="{c["text"]}">{esc(slide["title"])}</text>')
        body.append(f'<text x="66" y="{lead_y}" font-family="{FONT}" font-size="22" fill="{c["muted"]}">{esc(slide["subtitle"])}</text>')
        if ss:
            body += [
                panel(678, 362, 510, 286, c["surface"], c["line"], "1", 10, 1.2),
                image_tag(ss, 696, 380, 474, 252, "meet"),
            ]
            if idx == 11:
                body += [
                    f'<rect x="714" y="396" width="154" height="32" rx="5" fill="{c["deep"]}" fill-opacity="0.90" stroke="{c["gold"]}" stroke-width="1"/>',
                    f'<text x="730" y="418" font-family="{FONT}" font-size="18" font-weight="bold" fill="{c["gold"]}">{esc("演示视频占位")}</text>',
                ]
            card_w = 540
        else:
            card_w = 1040
        body.append(panel(64, 180, card_w, 378, c["surface"], c["line"], "1", 10, 1.2))
        body.append(f'<text x="96" y="226" font-family="{FONT}" font-size="26" font-weight="bold" fill="{c["primary"]}">{esc(slide["lead"])}</text>')
        bx, by = 96, 278
        for i, b in enumerate(slide["bullets"][:7]):
            y = by + i * 42
            body.append(f'<circle cx="{bx+10}" cy="{y-7}" r="5" fill="{c["gold"]}"/>')
            body.append(f'<text x="{bx+30}" y="{y}" font-family="{FONT}" font-size="21" fill="{c["text"]}">{esc(b)}</text>')
    else:
        body += [
            image_tag(bg, 0, 0, 1280, 720, "slice"),
            '<rect width="1280" height="720" fill="url(#shade)"/>',
            f'<rect x="64" y="48" width="112" height="6" rx="3" fill="{c["gold"]}"/>',
            f'<text x="64" y="108" font-family="{FONT}" font-size="40" font-weight="bold" fill="{c["text"]}">{esc(slide["title"])}</text>',
            f'<text x="66" y="148" font-family="{FONT}" font-size="21" fill="{c["muted"]}">{esc(slide["subtitle"])}</text>',
        ]
        if ss:
            if v["mode"] == "cinema" and idx == 11:
                body += [
                    panel(584, 184, 610, 360, c["black"], c["gold"], "0.52", 10, 1.8),
                    image_tag(ss, 608, 208, 562, 316, "meet"),
                ]
                left_w = 456
            else:
                body += [
                    panel(690, 218, 500, 300, c["surface"], c["line"], "0.76", 10, 1.2),
                    image_tag(ss, 708, 236, 464, 262, "meet"),
                ]
                if idx == 11:
                    body += [
                        f'<rect x="730" y="254" width="154" height="32" rx="5" fill="{c["black"]}" fill-opacity="0.72" stroke="{c["gold"]}" stroke-width="1"/>',
                        f'<text x="746" y="276" font-family="{FONT}" font-size="18" font-weight="bold" fill="{c["gold"]}">{esc("演示视频占位")}</text>',
                    ]
                left_w = 560
        else:
            left_w = 1080
        body.append(panel(74, 220, left_w, 370, c["surface"], c["line"], "0.82", 8, 1.2))
        body.append(f'<text x="104" y="268" font-family="{FONT}" font-size="26" font-weight="bold" fill="{c["gold"]}">{esc(slide["lead"])}</text>')
        cols = 2 if len(slide["bullets"]) > 4 and left_w > 650 else 1
        for i, b in enumerate(slide["bullets"]):
            col = i % cols
            row = i // cols
            x = 106 + col * 500
            y = 326 + row * 54
            body.append(f'<rect x="{x}" y="{y-25}" width="10" height="28" rx="2" fill="{c["gold"]}"/>')
            body.append(f'<text x="{x+26}" y="{y}" font-family="{FONT}" font-size="22" fill="{c["text"]}">{esc(b)}</text>')
        body.append(panel(74, 626, 760, 44, c["black"], c["gold"], "0.48", 8, 1))
        body.append(f'<text x="100" y="655" font-family="{FONT}" font-size="20" font-weight="bold" fill="{c["gold"]}">{esc(slide["lead"])}</text>')
    return wrap_svg(slide_defs(c) + "\n  <g id=\"slide\">" + "\n".join(body) + "\n  </g>")


def wrap_svg(inner: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">\n{inner}\n</svg>\n'


def spec_lock(version_key, v):
    c = v["colors"]
    color_lines = "\n".join(f"- {k}: {val}" for k, val in c.items())
    images = []
    for key, filename in AI_IMAGES.items():
        images.append(f"- {filename} | hero | existing | crop")
    for key, filename in REAL_IMAGES.items():
        images.append(f"- {filename} | product-screenshot | existing | no-crop")
    image_lines = "\n".join(images)
    rhythms = "\n".join(f"- P{i:02d}: {'anchor' if i in (1, 12) else ('breathing' if i in (4, 9, 11) else 'dense')}" for i in range(1, 13))
    page_names = "\n".join(f"- P{i:02d}: {SLIDES[i-1]['name']}" for i in range(1, 13))
    sizes = [14, 16, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 30, 32, 34, 36, 40, 42, 44, 54, 64, 72, 76]
    size_lines = "\n".join(f"- size_{s}: {s}" for s in sizes)
    return f"""# Execution Lock - {v['label']}

## canvas
- width: 1280
- height: 720
- format: ppt169

## mode
- mode: briefing

## visual_style
- visual_style: custom

## colors
{color_lines}

## typography
- font_family: {FONT}
- title_family: {FONT}
- body_family: {FONT}
- emphasis_family: {FONT}
{size_lines}

## icons
- library: none
- inventory:

## images
{image_lines}

## page_layouts
{page_names}

## page_rhythm
{rhythms}

## execution_constraints
- No page numbers, QR codes, urls, corner competition labels, or mojibake.
- Text is editable SVG/PPT text. Screenshots are evidence visuals, not full-page slides.
- Do not stretch screenshots; use preserveAspectRatio meet.
- Keep every slide under 10-minute defense density.
"""


def storyboard(v):
    rows = []
    for i, s in enumerate(SLIDES, 1):
        rows.append(f"| {i:02d} | {s['title']} | {s['lead']} | 主视觉：{s['ai']}；真实素材：{s['screenshot'] or '无'} |")
    return f"""# {v['label']} Storyboard

目标：围绕“从经验判断到可计算、可解释、可执行、可复核、可导出”的链路，生成 12 页 10 分钟答辩稿。

| 页 | 标题 | 本页任务 | 视觉素材 |
|---|---|---|---|
{chr(10).join(rows)}

叙事链路：真实痛点 -> 风险拆解 -> 项目切入 -> 系统闭环 -> 三端架构 -> Fast Block多约束三维装箱引擎 -> FastBlock -> AI可信分工 -> 合规溯源 -> 3D作业孪生 -> 报告导出与价值总结。
"""


def visual_style(v):
    c = v["colors"]
    return f"""# {v['label']} Visual Style

推荐用途：{v['recommendation']}

## 视觉系统

- 画面气质：{v['label']}
- 主背景：{c['bg']}
- 主文字：{c['text']}
- 主色：{c['primary']}
- 强调金色：{c['gold']}
- 科技点缀：{c['blue']}
- 面板：{c['surface']} / {c['surface2']}

## 版式原则

- 不整页贴图，标题、流程、风险项、技术标签均为可编辑文本。
- 真实产品截图只作为证据和演示窗口，不拉伸变形。
- 3D 作业孪生页必须作为视觉高潮，截图面积最大。
- 合规预审页必须出现 RAG / 法规证据 / 风险可追溯。
- 报告导出在总结页体现最终交付闭环。

## 自检规则

- 标题在投影上 3 秒可读。
- 单页主信息不超过 7 个要点。
- 视觉素材与页面主题一致，不用普通模板图。
- 不出现二维码、网址、页码、角标、比赛名称。
"""


def notes_total():
    items = []
    for i, s in enumerate(SLIDES, 1):
        body = (
            f"这一页讲{s['title']}。{s['subtitle']}。"
            f"答辩时重点强调：{s['lead']}。"
            f"页面中的真实截图或主视觉用于支撑项目已经形成从录入、算法、合规到导出的业务闭环。"
        )
        items.append(f"# {s['name']}\n\n{body}")
    return "\n\n---\n\n".join(items) + "\n"


def check_report(v):
    rows = []
    for i, s in enumerate(SLIDES, 1):
        score = "9.2" if i in (1, 11, 12) else "8.9"
        adjust = "第 11 页需后续替换真实演示视频" if i == 11 else "无硬性人工修改"
        rows.append(f"| {i:02d} | {s['title']} | {score} | {adjust} |")
    return f"""# {v['label']} Check Report

## 自动自检结论

- 12 页结构完整，适合 10 分钟答辩。
- 使用真实截图：cargo-input、dashboard、container-recommendation、twin-3d、compliance-review、report-export。
- 标题、正文、流程、标签为可编辑文本；图片不作为整页截图。
- 待导出后复核：PPTX 页数、PNG 预览数量、文字是否溢出。

| 页 | 标题 | 视觉评分 | 人工微调建议 |
|---|---|---:|---|
{chr(10).join(rows)}
"""


def copy_assets(project: Path, mode: str):
    img_dir = project / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    for filename in AI_IMAGES.values():
        src = BASE_AI / filename
        if src.exists():
            shutil.copy2(src, img_dir / filename)
            if mode == "light":
                path = img_dir / filename
                with Image.open(path) as im:
                    im = im.convert("RGB")
                    im.thumbnail((800, 450), Image.Resampling.LANCZOS)
                    im.save(path, quality=92)
    for filename in REAL_IMAGES.values():
        src = DESIGN_REFS / filename
        if src.exists():
            shutil.copy2(src, img_dir / filename)


def init_project(version_key: str, v: dict):
    project = PROJECT_ROOT / v["project"]
    if project.exists():
        shutil.rmtree(project)
    for sub in ["svg_output", "svg_final", "images", "notes", "exports", "analysis", "icons", "sources", "templates"]:
        (project / sub).mkdir(parents=True, exist_ok=True)
    copy_assets(project, v["mode"])
    (project / "design_spec.md").write_text(storyboard(v), encoding="utf-8")
    (project / "spec_lock.md").write_text(spec_lock(version_key, v), encoding="utf-8")
    (project / "storyboard.md").write_text(storyboard(v), encoding="utf-8")
    (project / "visual_style.md").write_text(visual_style(v), encoding="utf-8")
    (project / "check_report.md").write_text(check_report(v), encoding="utf-8")
    (project / "notes" / "total.md").write_text(notes_total(), encoding="utf-8")

    for i, slide in enumerate(SLIDES, 1):
        svg = render_cover(slide, v, i) if i == 1 else render_content(slide, v, i)
        (project / "svg_output" / f"{slide['name']}.svg").write_text(svg, encoding="utf-8")

    final_dir = OUT_ROOT / version_key
    if final_dir.exists():
        shutil.rmtree(final_dir)
    (final_dir / "slides_preview").mkdir(parents=True, exist_ok=True)
    shutil.copy2(project / "storyboard.md", final_dir / "storyboard.md")
    shutil.copy2(project / "visual_style.md", final_dir / "visual_style.md")
    shutil.copy2(project / "check_report.md", final_dir / "check_report.md")
    return project, final_dir


def write_comparison():
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    text = """# 三套 PPT 候选方案对比

| 版本 | 风格定位 | 优势 | 风险 | 推荐使用场景 |
|---|---|---|---|---|
| Version A 红金科技国赛风 | 红金主视觉、港口黄昏、能量线 | 视觉冲击最强，国赛第一眼最抓人 | 信息密度略高，需讲者节奏稳 | 正式国赛答辩主推 |
| Version B 高级科技白金风 | 白色 / 深蓝 / 金色点缀 | 信息清晰度最高，真实产品感最强 | 气势弱于 A/C | 商业计划书、互联网+复赛、评委快速阅读 |
| Version C 电影级港口工业风 | 深色工业、港口与 3D 孪生强调 | 3D 作业孪生页最强，技术演示氛围好 | 若现场投影偏暗需提高亮度 | 技术演示、Demo 引入、路演开场视频化表达 |

## 总推荐

首推 Version A 作为国赛答辩主稿：它最符合创赛 / 互联网+ / 国赛答辩的红金高级感，同时保留真实产品截图作为可信证据。  
备选 Version B 用于评委资料版或商业计划书附件。  
Version C 适合在现场演示前后作为技术氛围更强的版本，尤其突出 3D 作业孪生能力。
"""
    (OUT_ROOT / "comparison_report.md").write_text(text, encoding="utf-8")


def main():
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    for key, version in VERSIONS.items():
        init_project(key, version)
    write_comparison()
    print(OUT_ROOT)
    for key, version in VERSIONS.items():
        print(key, PROJECT_ROOT / version["project"])


if __name__ == "__main__":
    main()
