$ErrorActionPreference = 'Stop'
$path = "d:\cixing\3chuang\web-dashboard\src\App.jsx"
$backup = "d:\cixing\3chuang\web-dashboard\src\App.jsx.bak"
Copy-Item $path $backup -Force
$enc = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText($path, $enc)
$origLen = $content.Length
$ok = 0
$fail = 0

function DoReplace($old, $new, $label) {
  $old = $old -replace "`r`n", "`n"
  $new = $new -replace "`r`n", "`n"
  if ($script:content.Contains($old)) {
    $script:content = $script:content.Replace($old, $new)
    $script:ok++
    Write-Host "OK  : $label"
  } else {
    $script:fail++
    Write-Host "FAIL: $label"
  }
}

# ---- Fix 1: reportSummary array ----
$old1 = @'
    ['柜型', DEMO.container],
    ['装入件数', `${DEMO.loadedPieces}/${DEMO.pieces} 件`],
    ['空间利用率', DEMO.utilization],
    ['合规评分', `${DEMO.complianceScore} / 100`],
    ['复核状态', reviewed ? '已完成审计' : '待审计', reviewed ? 'pass' : 'warning'],
'@
$new1 = @'
    ['柜型', container?.shortName || container?.name || DEMO.container],
    ['装入件数', `${plan?.loadedCargo?.length || 0}/${Number(plan?.totalCargoInput) || ((plan?.loadedCargo?.length || 0) + (plan?.unloadedCargo?.length || 0))} 件`],
    ['空间利用率', plan?.spaceUtilization != null ? `${plan.spaceUtilization.toFixed(1)}%` : '—'],
    ['合规评分', `${Number(compliance?.score ?? 0) > 0 ? compliance.score + ' / 100' : '待审计'}`],
    ['复核状态', reviewed ? '已完成审计' : '待审计', reviewed ? 'pass' : 'warning'],
'@
DoReplace $old1 $new1 "Fix1: reportSummary"

# ---- Fix 2: files array + variable declarations ----
$old2 = @'
  const files = [
    ['甬柜易算装柜与合规报告.html', '装柜方案、合规矩阵、SKU 摘要', 'HTML', '可下载', () => downloadTextFile('甬柜易算装柜与合规报告-NB2026-DEMO-01.html', 'text/html', reportHtml)],
    ['法规证据清单.csv', 'RAG 法规证据与复核状态', 'CSV', '可下载', () => downloadTextFile('法规证据清单-NB2026-DEMO-01.csv', 'text/csv', evidenceCsv)],
    ['全量演示数据.json', '订单、货物、方案摘要、证据清单', 'JSON', '可下载', () => downloadTextFile('甬柜易算演示数据-NB2026-DEMO-01.json', 'application/json', exportJson)]
  ];
'@
$new2 = @'
  const loaded = plan?.loadedCargo?.length || 0;
  const hasPlan = loaded > 0;
  const passed = isCompliancePassed(compliance);
  const reportState = !hasPlan ? 'draft' : !passed ? 'pending' : reviewed ? 'exportable' : 'pending';
  const files = [
    ['甬柜易算装柜与合规报告.html', '装柜方案、合规矩阵、SKU 摘要', 'HTML', reportState === 'exportable' ? '可下载' : '待复核', () => downloadTextFile('甬柜易算装柜与合规报告-NB2026-DEMO-01.html', 'text/html', reportHtml)],
    ['法规证据清单.csv', 'RAG 法规证据与复核状态', 'CSV', reportState === 'exportable' ? '可下载' : '待复核', () => downloadTextFile('法规证据清单-NB2026-DEMO-01.csv', 'text/csv', evidenceCsv)],
    ['全量演示数据.json', '订单、货物、方案摘要、证据清单', 'JSON', '可下载', () => downloadTextFile('甬柜易算演示数据-NB2026-DEMO-01.json', 'application/json', exportJson)]
  ];
'@
DoReplace $old2 $new2 "Fix2: files array + vars"

# ---- Fix 3: report-alert span ----
$old3 = @'
          <span>{reviewed ? '当前报告按真实后端结果生成：221/221、84.51%、本地规则 WARNING / AI建议 PASS / 人工复核独立。' : '请先完成真实 DeepSeek 合规审计。'}</span>
'@
$new3 = @'
          <span>{reviewed ? `当前报告按真实结果生成：${plan?.loadedCargo?.length || 0}/${Number(plan?.totalCargoInput) || 0}、${plan?.spaceUtilization != null ? plan.spaceUtilization.toFixed(1) + '%' : '—'}、${passed ? 'PASS' : compliance?.status || '待审计'} / ${Number(compliance?.score ?? 0) || '—'}。` : '请先完成真实 DeepSeek 合规审计。'}</span>
'@
DoReplace $old3 $new3 "Fix3: report-alert"

# ---- Fix 4: deliverable-status-list ----
$old4 = @'
              <div><span>装柜方案 已生成</span><StatusTag status="pass">PASS</StatusTag></div>
              <div><span>3D 作业单 已生成</span><StatusTag status="pass">PASS</StatusTag></div>
              <div><span>合规预审报告 已生成</span><StatusTag status="pass">PASS</StatusTag></div>
              <div><span>法规证据清单 已归档</span><StatusTag status="pass">PASS</StatusTag></div>
'@
$new4 = @'
              <div><span>装柜方案 已生成</span><StatusTag status={hasPlan ? 'pass' : 'pending'}>{hasPlan ? 'PASS' : 'PENDING'}</StatusTag></div>
              <div><span>3D 作业单 已生成</span><StatusTag status={hasPlan ? 'pass' : 'pending'}>{hasPlan ? 'PASS' : 'PENDING'}</StatusTag></div>
              <div><span>合规预审报告 已生成</span><StatusTag status={passed ? 'pass' : 'warning'}>{passed ? 'PASS' : 'WARNING'}</StatusTag></div>
              <div><span>法规证据清单 已归档</span><StatusTag status={reviewed ? 'pass' : 'warning'}>{reviewed ? 'PASS' : 'WARNING'}</StatusTag></div>
'@
DoReplace $old4 $new4 "Fix4: deliverable-status-list"

# ---- Fix 5: summary-list ----
$old5 = @'
              <div><span>推荐柜型</span><strong>40HQ</strong></div>
              <div><span>装入件数</span><strong>{DEMO.loadedPieces}/{DEMO.pieces} 件</strong></div>
              <div><span>未装入件数</span><strong>{DEMO.unloadedPieces} 件</strong></div>
              <div><span>空间利用率</span><strong>{DEMO.utilization}</strong></div>
              <div><span>重心偏移</span><strong>{DEMO.cog}</strong></div>
              <div><span>合规评分</span><strong>{DEMO.complianceScore} / 100</strong></div>
              <div><span>风险记录</span><strong>0 项合规预警</strong></div>
              <div><span>严重风险</span><strong>0 项</strong></div>
'@
$new5 = @'
              <div><span>推荐柜型</span><strong>{container?.shortName || container?.name || '40HQ'}</strong></div>
              <div><span>装入件数</span><strong>{(plan?.loadedCargo?.length || 0)}/{Number(plan?.totalCargoInput) || ((plan?.loadedCargo?.length || 0) + (plan?.unloadedCargo?.length || 0))} 件</strong></div>
              <div><span>未装入件数</span><strong>{plan?.unloadedCargo?.length || 0} 件</strong></div>
              <div><span>空间利用率</span><strong>{plan?.spaceUtilization != null ? plan.spaceUtilization.toFixed(1) + '%' : '—'}</strong></div>
              <div><span>重心偏移</span><strong>{plan?.cogOffset ? `横${Number(plan.cogOffset.lateral || 0).toFixed(1)}% / 纵${Number(plan.cogOffset.longitudinal || 0).toFixed(1)}%` : '—'}</strong></div>
              <div><span>合规评分</span><strong>{Number(compliance?.score ?? 0) > 0 ? compliance.score + ' / 100' : '待审计'}</strong></div>
              <div><span>风险记录</span><strong>{(compliance?.rows || []).filter(r => r.result && r.result !== 'PASS').length} 项合规预警</strong></div>
              <div><span>严重风险</span><strong>{(compliance?.rows || []).filter(r => r.result === 'FAIL').length} 项</strong></div>
'@
DoReplace $old5 $new5 "Fix5: summary-list"

# ---- Fix 6: report-paper ----
$old6 = @'
              <p>订单编号 {DEMO.orderNo} · 柜型 {DEMO.container} · 装入件数 {DEMO.loadedPieces}/{DEMO.pieces} 件</p>
              <div className="report-cover-kpis">
                <div><span>空间利用率</span><strong>{DEMO.utilization}</strong></div>
                <div><span>合规评分</span><strong>{DEMO.complianceScore} / 100</strong></div>
                <div><span>重心偏移</span><strong>{DEMO.cog}</strong></div>
              </div>
              <div className="report-section-grid">
                {['装柜方案摘要', '3D 作业步骤摘要', '合规检查矩阵', '法规证据清单', '人工复核记录'].map((title, index) => (
                  <div key={title}>
                    <strong>{index + 1}. {title}</strong>
                    <span>{index === 0 ? `40HQ · ${DEMO.loadedPieces}/${DEMO.pieces} 件 · ${DEMO.utilization}` : index === 2 ? '本地规则 WARNING / AI建议 PASS / 人工复核独立 · 0 项合规预警' : '已生成预览摘要'}</span>
'@
$new6 = @'
              <p>订单编号 {DEMO.orderNo} · 柜型 {DEMO.container} · 装入件数 {(plan?.loadedCargo?.length || 0)}/{Number(plan?.totalCargoInput) || ((plan?.loadedCargo?.length || 0) + (plan?.unloadedCargo?.length || 0))} 件</p>
              <div className="report-cover-kpis">
                <div><span>空间利用率</span><strong>{plan?.spaceUtilization != null ? plan.spaceUtilization.toFixed(1) + '%' : '—'}</strong></div>
                <div><span>合规评分</span><strong>{Number(compliance?.score ?? 0) > 0 ? compliance.score + ' / 100' : '待审计'}</strong></div>
                <div><span>重心偏移</span><strong>{plan?.cogOffset ? `横${Number(plan.cogOffset.lateral || 0).toFixed(1)}% / 纵${Number(plan.cogOffset.longitudinal || 0).toFixed(1)}%` : '—'}</strong></div>
              </div>
              <div className="report-section-grid">
                {['装柜方案摘要', '3D 作业步骤摘要', '合规检查矩阵', '法规证据清单', '人工复核记录'].map((title, index) => (
                  <div key={title}>
                    <strong>{index + 1}. {title}</strong>
                    <span>{index === 0 ? `${container?.shortName || '40HQ'} · ${(plan?.loadedCargo?.length || 0)}/${Number(plan?.totalCargoInput) || 0} 件 · ${plan?.spaceUtilization != null ? plan.spaceUtilization.toFixed(1) + '%' : '—'}` : index === 2 ? `${passed ? 'PASS' : compliance?.status || '待审计'} / ${Number(compliance?.score ?? 0) || '—'} · ${(compliance?.rows || []).filter(r => r.result && r.result !== 'PASS').length} 项预警` : '已生成预览摘要'}</span>
'@
DoReplace $old6 $new6 "Fix6: report-paper"

# ---- Fix 7: evidence-list ----
$old7 = @'
                ['SOLAS VGM 要求', '已匹配', 'pass'],
                ['CTU Code 装载规范', '已匹配', 'pass'],
'@
$new7 = @'
                ['SOLAS VGM 要求', '本地法规库', 'pass'],
                ['CTU Code 装载规范', '本地法规库', 'pass'],
'@
DoReplace $old7 $new7 "Fix7: evidence-list"

# ---- Fix 8: check-list ----
$old8 = @'
                ['真实数据一致性', 'PASS'],
                ['报告字段完整性', 'PASS'],
                ['证据链完整性', 'PASS'],
                ['未装入尾货记录', 'PASS']
'@
$new8 = @'
                ['真实数据一致性', hasPlan ? 'PASS' : 'PENDING'],
                ['报告字段完整性', hasPlan ? 'PASS' : 'PENDING'],
                ['证据链完整性', reviewed ? 'PASS' : 'WARNING'],
                ['未装入尾货记录', hasPlan ? 'PASS' : 'PENDING']
'@
DoReplace $old8 $new8 "Fix8: check-list"

# ---- Fix 9: timeline-list ----
$old9 = @'
              <div><strong>当前</strong><span>展示 40HQ 装柜方案预览</span></div>
              <div><strong>当前</strong><span>DeepSeek V4 Flash 审计 本地规则 WARNING / AI建议 PASS / 人工复核独立</span></div>
'@
$new9 = @'
              <div><strong>当前</strong><span>展示 {container?.shortName || '40HQ'} 装柜方案预览</span></div>
              <div><strong>当前</strong><span>{passed ? 'DeepSeek 合规审计 PASS / ' + (Number(compliance?.score ?? 0) || 100) : 'DeepSeek 合规审计待完成'}</span></div>
'@
DoReplace $old9 $new9 "Fix9: timeline-list"

# ---- Fix 10: files DataTable ----
$old10 = @'
                <StatusTag status="pass">{file[3]}</StatusTag>,
                <button type="button" className="text-action" onClick={file[4]}>下载</button>
'@
$new10 = @'
                <StatusTag status={file[3] === '可下载' ? 'pass' : 'warning'}>{file[3]}</StatusTag>,
                <button type="button" className="text-action" onClick={file[4]} disabled={file[3] !== '可下载' && file[2] !== 'JSON'}>{file[3] === '可下载' || file[2] === 'JSON' ? '下载' : '待复核'}</button>
'@
DoReplace $old10 $new10 "Fix10: files DataTable"

# ---- Write back ----
[System.IO.File]::WriteAllText($path, $content, $enc)
Write-Host ""
Write-Host "Total: $ok OK, $fail FAIL. Size: $origLen -> $($content.Length)"

# ---- Verify: count remaining DEMO. in ReportModule region (lines 1155-1360) ----
$lines = $content -split "`n"
$reportDemoCount = 0
for ($i = 1154; $i -lt 1360 -and $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match 'DEMO\.') { $reportDemoCount++; Write-Host "  remaining DEMO at line $($i+1): $($lines[$i].Trim())" }
}
Write-Host "Remaining DEMO. refs in ReportModule (1155-1360): $reportDemoCount"
