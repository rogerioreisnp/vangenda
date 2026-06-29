import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      email,
      cliente_nome,
      origem,
      destino,
      data_hora,
      numero_reserva,
      numero_voo,
      observacoes,
      empresa_nome,
    } = body

    if (!email) {
      return NextResponse.json({ error: 'E-mail não informado' }, { status: 400 })
    }

    const data = `${data_hora.slice(8,10)}/${data_hora.slice(5,7)}/${data_hora.slice(0,4)}`
    const hora = data_hora.slice(11,16)

    const reservaTexto = numero_reserva ? `<p style="color:#6B7280;font-size:14px;margin:0 0 4px 0;">Reserva nº <strong>${numero_reserva}</strong></p>` : ''
    const vooTexto = numero_voo ? `<p style="margin:8px 0 0 0;">✈️ Voo: <strong>${numero_voo}</strong></p>` : ''
    const obsTexto = observacoes ? `<p style="margin:8px 0 0 0;">📝 Observações: ${observacoes}</p>` : ''

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0F6E56;padding:24px 28px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Confirmação de Reserva</h1>
      ${empresa_nome ? `<p style="color:#9FE1CB;margin:4px 0 0 0;font-size:14px;">${empresa_nome}</p>` : ''}
    </div>
    <div style="padding:28px;">
      ${reservaTexto}
      <p style="color:#111;font-size:16px;margin:0 0 20px 0;">Olá, <strong>${cliente_nome}</strong>!</p>
      <p style="color:#374151;margin:0 0 20px 0;">Confirmamos o recebimento da sua solicitação de transfer. Seguem os detalhes:</p>
      <div style="background:#F0FDF8;border-radius:10px;padding:20px;margin-bottom:20px;">
        <p style="margin:0 0 8px 0;">📅 <strong>Data:</strong> ${data} às ${hora}</p>
        <p style="margin:0 0 8px 0;">📍 <strong>Origem:</strong> ${origem}</p>
        <p style="margin:0;">📍 <strong>Destino:</strong> ${destino}</p>
        ${vooTexto}
        ${obsTexto}
      </div>
      <p style="color:#6B7280;font-size:13px;margin:0;">Em breve você receberá as informações do motorista responsável. Qualquer dúvida, entre em contato conosco.</p>
    </div>
    <div style="background:#F9FAFB;padding:16px 28px;text-align:center;">
      <p style="color:#9CA3AF;font-size:12px;margin:0;">Enviado por ${empresa_nome || 'Rotagenda'}</p>
    </div>
  </div>
</body>
</html>`

    const resend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${empresa_nome || 'Rotagenda'} <confirmacoes@rotagenda.com.br>`,
        to: [email],
        subject: `Confirmação de Reserva${numero_reserva ? ` #${numero_reserva}` : ''} — ${empresa_nome || 'Rotagenda'}`,
        html,
      }),
    })

    if (!resend.ok) {
      const err = await resend.text()
      console.error('[email] Erro Resend:', err)
      return NextResponse.json({ error: 'Erro ao enviar e-mail' }, { status: 500 })
    }

    console.log(`[email] Confirmação enviada para ${email}`)
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[email] Erro interno:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
