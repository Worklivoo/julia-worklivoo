/**
 * HTML da janela "Pagamento via PIX" (QR Code + copia e cola), aberta pelo botão
 * "Baixar PDF do Pagamento". O usuário salva em PDF pelo diálogo de impressão.
 */
export const buildPagamentoPdfHtml = ({
  qrImgSrc,
  payloadQuebrado,
}: {
  qrImgSrc: string;
  payloadQuebrado: string;
}): string => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Pagamento PIX</title>
<style>
  @page { size: A5; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #ffffff; color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .page {
    width: 100%; min-height: 100vh; padding: 28px 24px 32px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .titulo {
    font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 18px;
    text-align: center;
  }
  .qr-wrap {
    display: flex; align-items: center; justify-content: center;
    padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;
    margin-bottom: 18px;
  }
  .qr-wrap img {
    width: 280px; height: 280px; display: block; image-rendering: pixelated;
  }
  .qr-empty {
    width: 280px; height: 280px; display: flex; align-items: center; justify-content: center;
    color: #6b7280; font-size: 12px; border: 1px dashed #d1d5db; border-radius: 12px;
    background: #fafafa; text-align: center; padding: 20px;
  }
  .label-copia {
    font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 6px;
    align-self: flex-start; width: 100%;
  }
  .payload {
    width: 100%; background: #0b0b0b; color: #f9fafb; border-radius: 10px; padding: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 11px; line-height: 1.55; word-break: break-all; white-space: pre-wrap;
    user-select: all;
  }
  .acoes {
    width: 100%; display: flex; gap: 10px; justify-content: center;
    margin-top: 20px;
  }
  .btn {
    flex: 1; padding: 10px 14px; border-radius: 10px;
    font-size: 12px; font-weight: 600; cursor: pointer; text-align: center;
  }
  .btn.primary { background: #0b0b0b; color: #ffffff; border: 0; }
  .btn.ghost { background: #ffffff; color: #111827; border: 1px solid #d1d5db; }
  .btn.copy { background: #EBF57D; color: #0b0b0b; border: 0; }
  @media print {
    .no-print { display: none !important; }
    .page { padding: 0; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="titulo">Pagamento via PIX</div>

    ${
      qrImgSrc
        ? `<div class="qr-wrap"><img src="${qrImgSrc}" alt="QR Code PIX" /></div>`
        : `<div class="qr-wrap"><div class="qr-empty">QR Code não disponível.<br/>Use o código copia e cola abaixo.</div></div>`
    }

    <div class="label-copia no-print">Copia e Cola PIX</div>
    <div id="payload-texto" class="payload">${payloadQuebrado || '(PIX não gerado)'}</div>

    <div class="acoes no-print">
      <button type="button" class="btn copy" onclick="(function(){var t=document.getElementById('payload-texto').innerText||'';var l=t.replace(/\\s+/g,'');if(navigator.clipboard&&l){navigator.clipboard.writeText(l);}})();">Copiar código</button>
      <button type="button" class="btn primary" onclick="window.print()">Salvar PDF</button>
      <button type="button" class="btn ghost" onclick="window.close()">Fechar</button>
    </div>
  </div>
</body>
</html>`;
