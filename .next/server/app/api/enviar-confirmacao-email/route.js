"use strict";(()=>{var e={};e.id=586,e.ids=[586],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},5139:(e,r,o)=>{o.r(r),o.d(r,{originalPathname:()=>x,patchFetch:()=>g,requestAsyncStorage:()=>l,routeModule:()=>d,serverHooks:()=>c,staticGenerationAsyncStorage:()=>m});var a={};o.r(a),o.d(a,{POST:()=>p});var t=o(49303),n=o(88716),i=o(60670),s=o(87070);async function p(e){try{let{email:r,cliente_nome:o,origem:a,destino:t,data_hora:n,numero_reserva:i,numero_voo:p,observacoes:d,empresa_nome:l}=await e.json();if(!r)return s.NextResponse.json({error:"E-mail n\xe3o informado"},{status:400});let m=`${n.slice(8,10)}/${n.slice(5,7)}/${n.slice(0,4)}`,c=n.slice(11,16),x=i?`<p style="color:#6B7280;font-size:14px;margin:0 0 4px 0;">Reserva n\xba <strong>${i}</strong></p>`:"",g=p?`<p style="margin:8px 0 0 0;">✈️ Voo: <strong>${p}</strong></p>`:"",u=d?`<p style="margin:8px 0 0 0;">📝 Observa\xe7\xf5es: ${d}</p>`:"",f=`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0F6E56;padding:24px 28px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Confirma\xe7\xe3o de Reserva</h1>
      ${l?`<p style="color:#9FE1CB;margin:4px 0 0 0;font-size:14px;">${l}</p>`:""}
    </div>
    <div style="padding:28px;">
      ${x}
      <p style="color:#111;font-size:16px;margin:0 0 20px 0;">Ol\xe1, <strong>${o}</strong>!</p>
      <p style="color:#374151;margin:0 0 20px 0;">Confirmamos o recebimento da sua solicita\xe7\xe3o de transfer. Seguem os detalhes:</p>
      <div style="background:#F0FDF8;border-radius:10px;padding:20px;margin-bottom:20px;">
        <p style="margin:0 0 8px 0;">📅 <strong>Data:</strong> ${m} \xe0s ${c}</p>
        <p style="margin:0 0 8px 0;">📍 <strong>Origem:</strong> ${a}</p>
        <p style="margin:0;">📍 <strong>Destino:</strong> ${t}</p>
        ${g}
        ${u}
      </div>
      <p style="color:#6B7280;font-size:13px;margin:0;">Em breve voc\xea receber\xe1 as informa\xe7\xf5es do motorista respons\xe1vel. Qualquer d\xfavida, entre em contato conosco.</p>
    </div>
    <div style="background:#F9FAFB;padding:16px 28px;text-align:center;">
      <p style="color:#9CA3AF;font-size:12px;margin:0;">Enviado por ${l||"Rotagenda"}</p>
    </div>
  </div>
</body>
</html>`,v=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:`${l||"Rotagenda"} <confirmacoes@rotagenda.com.br>`,to:[r],subject:`Confirma\xe7\xe3o de Reserva${i?` #${i}`:""} — ${l||"Rotagenda"}`,html:f})});if(!v.ok){let e=await v.text();return console.error("[email] Erro Resend:",e),s.NextResponse.json({error:"Erro ao enviar e-mail"},{status:500})}return console.log(`[email] Confirma\xe7\xe3o enviada para ${r}`),s.NextResponse.json({ok:!0})}catch(e){return console.error("[email] Erro interno:",e),s.NextResponse.json({error:"Erro interno"},{status:500})}}let d=new t.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/enviar-confirmacao-email/route",pathname:"/api/enviar-confirmacao-email",filename:"route",bundlePath:"app/api/enviar-confirmacao-email/route"},resolvedPagePath:"C:\\Users\\joaov\\Documents\\Vangenda\\app\\api\\enviar-confirmacao-email\\route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:l,staticGenerationAsyncStorage:m,serverHooks:c}=d,x="/api/enviar-confirmacao-email/route";function g(){return(0,i.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:m})}}};var r=require("../../../webpack-runtime.js");r.C(e);var o=e=>r(r.s=e),a=r.X(0,[948,972],()=>o(5139));module.exports=a})();