export default function CommerceDecisionSummary({plan}) {
  const fulfillment=plan?.commerce?.fulfillment, inputs=plan?.commerce?.businessInputs;
  if(!fulfillment||!inputs)return null;
  const complete=fulfillment.orders.filter(o=>o.status==='COMPLETE').length;
  return <section className="card commerce-decision" aria-label="订单与数据检查">
    <dl className="key-metrics">
      <div><dt>齐套订单</dt><dd>{complete} / {fulfillment.orders.length}</dd></div>
      <div><dt>必运缺件</dt><dd>{fulfillment.requiredMissing} 件</dd></div>
      <div><dt>到仓待确认</dt><dd>{inputs.arrival.unknownCount} 件</dd></div>
      <div><dt>包装约束待核对</dt><dd>{inputs.packaging.unverifiedCargoIds.length} 行</dd></div>
    </dl>
    {fulfillment.splitViolations.length>0&&<p role="status">{fulfillment.splitViolations.length} 个订单要求整单交付，当前仅装入部分货物。请调整装法后再安排作业。</p>}
    <details><summary>查看订单明细</summary><div className="table-scroll"><table className="data-table"><thead><tr><th>货主 / 订单</th><th>装入 / 应运</th><th>交付要求</th><th>结果</th></tr></thead><tbody>{fulfillment.orders.map(o=><tr key={o.key}><td>{o.customerId||'未录入'} / {o.orderId||'未分配订单'}</td><td>{o.loaded} / {o.expected}</td><td>{o.required?'本次必运':'未指定必运'} · {o.allowPartialShipment===false?'整单交付':o.allowPartialShipment===true?'允许拆单':'拆单许可待确认'}</td><td>{o.status==='COMPLETE'?'已齐套':o.status==='PARTIAL'?'尚未齐套':'尚未装入'}</td></tr>)}</tbody></table></div></details>
  </section>;
}
