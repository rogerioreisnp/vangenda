import { NextRequest, NextResponse } from 'next/server'

/**
 * Envia o PDF do voucher pro cliente via email (Resend).
 * Recebe o PDF ja gerado no cliente em base64 e anexa. Fase 3 do projeto
 * vouchers/recibos do Julimar.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, cliente_nome, empresa_nome, numero, pdf_base64 } = body

    if (!email) return NextResponse.json({ error: 'Email não informado' }, { status: 400 })
    if (!pdf_base64) return NextResponse.json({ error: 'PDF não anexado' }, { status: 400 })
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY não configurado' }, { status: 500 })
    }

    const empresa = empresa_nome || 'Rotagenda'
    const numeroTxt = numero ? `Nº ${numero}` : ''
    const nomeArq = numero ? `voucher-${numero}.pdf` : 'voucher.pdf'

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;border:1px solid #e5e7eb;">
    <p style="font-size:16px;font-weight:bold;color:#0F6E56;margin:0 0 12px 0;">${empresa}</p>
    <p style="font-size:14px;color:#333;margin:0 0 12px 0;">
      Olá${cliente_nome ? `, <b>${cliente_nome}</b>` : ''}!
    </p>
    <p style="font-size:14px;color:#333;margin:0 0 12px 0;">
      Segue em anexo o voucher ${numeroTxt} do seu atendimento. Guarde-o para os seus registros.
    </p>
    <p style="font-size:13px;color:#666;margin:16px 0 0 0;">
      Qualquer dúvida, estamos à disposição.<br>
      <b>${empresa}</b>
    </p>
  </div>
</body>
</html>`

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${empresa} <atendimento@rotagenda.com.br>`,
        to: [email],
        subject: `Voucher ${numeroTxt} — ${empresa}`,
        html,
        attachments: [{ filename: nomeArq, content: pdf_base64 }],
      }),
    })

    if (!resendResp.ok) {
      const err = await resendResp.text()
      console.error('[voucher-email] Erro Resend:', err)
      return NextResponse.json({ error: 'Erro ao enviar email' }, { status: 500 })
    }

    console.log(`[voucher-email] Enviado ${numeroTxt} para ${email}`)
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[voucher-email] Erro interno:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
