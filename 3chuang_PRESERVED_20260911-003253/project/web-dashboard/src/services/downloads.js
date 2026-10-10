export function downloadTextFile({ content, filename, mimeType = 'text/plain;charset=utf-8' }) {
  if (typeof content !== 'string' || content.length === 0) throw new Error('导出内容为空');
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { filename, bytes: blob.size };
}

export function printHtmlReport(html) {
  if (!html) throw new Error('报告预览为空');
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('浏览器阻止了打印窗口，请允许弹出窗口后重试');
  popup.opener = null;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  window.setTimeout(() => {
    popup.focus();
    popup.print();
  }, 250);
  return true;
}
