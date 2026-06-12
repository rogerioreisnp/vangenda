---
name: pagina-vendas-high-converting
description: >
  Use quando o usuario pedir pagina de vendas, landing page, sales page ou oferta de infoproduto.
  Gera HTML completo responsivo com os 12 blocos psicologicos validados
  para conversao no mercado brasileiro de infoprodutos.
triggers:
  - "cria uma página de vendas para meu produto"
  - "faz uma landing page para o meu curso"
  - "quero uma sales page para vender meu ebook"
  - "me ajuda a criar uma página de oferta"
  - "preciso de uma página para vender meu infoproduto"
---

# Skill: Pagina de Vendas High-Converting

Este skill gera uma pagina de vendas HTML completa, responsiva e psicologicamente
estruturada para maxima conversao. A estrutura e baseada em paginas validadas no
mercado brasileiro de infoprodutos (Hotmart, Kiwify, Monetizze) com foco em
produtos low ticket (R$17 a R$97) mas adaptavel a qualquer ticket.

---

## PASSO 0 - Antes de escrever uma linha de codigo

Colete ou solicite as seguintes informacoes do usuario:

VARIAVEIS OBRIGATORIAS:
- NOME_PRODUTO         Ex: Cartilha do Trafego Low Ticket
- NICHO                Ex: trafego pago, emagrecimento, financas pessoais
- AVATAR_DOR_PRINCIPAL Ex: nao consegue ROI acima de 2 com Low Ticket
- RESULTADO_PROMETIDO  Ex: ROI de 2+ todos os dias
- RESULTADO_NUMERICO   Ex: 2.76 ou R$5.000/mes ou 10kg em 30 dias
- NOME_PRODUTOR        Ex: Ricardo Maxxima
- PRECO_PARCELADO      Ex: 5x de R$8,19
- PRECO_A_VISTA        Ex: R$37
- PRECO_ORIGINAL       Ex: R$314 (valor somado dos entregaveis)
- EMAIL_SUPORTE        Ex: contato@seusite.com.br
- CNPJ                 Ex: 40.109.402/0001-43
- COR_PRIMARIA         Ex: #1a5cb5 (azul padrao se nao informado)
- COR_DESTAQUE         Ex: #e63946 (vermelho padrao se nao informado)
- COR_CTA              Ex: #2dc653 (verde padrao se nao informado)
- LINK_CHECKOUT        Ex: https://pay.kiwify.com.br/xxx

VARIAVEIS DOS ENTREGAVEIS (repetir para cada modulo e bonus):
- ENTREGAVEL_N_TITULO  Ex: Estruturas de Campanha de Trafego Pago
- ENTREGAVEL_N_DESC    Ex: Modelos prontos para copiar, colar e lucrar
- ENTREGAVEL_N_PRECO   Ex: R$85,00

VARIAVEIS DE PROVA SOCIAL (minimo 3):
- PROVA_N_METRICA      Ex: ROI 2.1
- PROVA_N_GASTO        Ex: R$153.874,71
- PROVA_N_FATURAMENTO  Ex: R$325.264,32
- PROVA_N_LUCRO        Ex: R$171.389,61

VARIAVEIS DE DOR (frases reais do avatar, minimo 4):
- FALA_DOR_N           Ex: Ja troquei criativo, oferta, publico... nada funciona

BENEFICIOS (minimo 6, foco em TRANSFORMACAO e nao em feature):
- BENEFICIO_N_TITULO   Ex: Aumentar acima de 2 o ROI dos seus produtos
- BENEFICIO_N_DESC     Ex: Com estruturas validadas que os Big Players usam

BIG_PLAYERS (pessoas conhecidas no nicho que usam ou endossam):
- PLAYER_N_NOME        Ex: Lucas Scudeler

FALLBACK - Se o usuario nao fornecer as variaveis obrigatorias:
1. Liste quais variaveis estao faltando e pergunte ao usuario antes de gerar
2. Se o usuario pedir para gerar mesmo assim, use placeholders visiveis como
   [INSIRA AQUI: nome do produto] em cada campo ausente
3. Ao final do HTML, adicione comentario listando todos os campos para preencher

---

## OUTPUT

Este skill entrega um arquivo HTML unico e completo, pronto para hospedar, contendo:

- Pagina de vendas com os 12 blocos psicologicos na ordem correta e sem omissoes
- CSS3 embutido responsivo (mobile-first, breakpoint 768px) sem dependencias externas
- Copywriting preenchido com as variaveis do usuario (ou placeholders visiveis onde ausentes)
- Fallbacks coloridos em todos os slots de imagem nao fornecida
- Lista de imagens para substituir no final do HTML (dentro de comentario HTML)
- Checklist de revisao aplicada antes da entrega

---

## PASSO 1 - Estrutura dos 12 Blocos (NUNCA pular, NUNCA reordenar)

A ordem psicologica abaixo segue a jornada emocional do avatar:
Atencao > Identificacao > Dor > Esperanca > Desejo > Confianca > Decisao

BLOCO 01: Hero          - Headline de dor + promessa + visual antes/depois
BLOCO 02: Prova Social  - Screenshots reais de resultados de clientes
BLOCO 03: Agitacao      - Pensamentos/falas do avatar + imagem de frustracao
BLOCO 04: Virada        - Pergunta qualificadora + transicao para solucao
BLOCO 05: Beneficios    - Grid de transformacoes (nao features)
BLOCO 06: Entregaveis   - Cards alternados: imagem 3D + titulo + descricao
BLOCO 07: Big Players   - Autoridade social com nomes do nicho
BLOCO 08: Para Quem E   - Lista de qualificacao + CTA intermediario
BLOCO 09: Recapitulacao - Ancora de preco + revelacao do valor real + CTA
BLOCO 10: Como Funciona - 3 passos: compra, acesso, resultado
BLOCO 11: Autoridade    - Bio do produtor com foto e credenciais relevantes
BLOCO 12: Duas Opcoes   - Contraste dor vs. solucao + CTA final + repeticao oferta
FOOTER:   Rodape        - Logo, e-mail, aviso legal, CNPJ, copyright

---

## PASSO 2 - Especificacoes tecnicas do HTML

Stack:
- HTML5 semantico puro + CSS3 embedded + JS vanilla minimo
- SEM dependencias externas (sem Bootstrap, sem jQuery, sem frameworks)
- Google Fonts via link (fonte serifada para headlines, sans para corpo)
- Responsivo: mobile-first, breakpoint principal em 768px
- Arquivo unico: tudo em um .html

Paleta padrao (sobrescrever com COR_PRIMARIA e COR_DESTAQUE se fornecido):
  --azul-primario: #1a5cb5
  --azul-escuro: #0d3a7a
  --azul-claro-bg: #eaf2fb
  --vermelho: #e63946
  --verde-cta: #2dc653
  --verde-escuro: #1a9e3f
  --cinza-bg: #f0f4f8
  --cinza-texto: #555555
  --branco: #ffffff
  --preto-titulo: #1a1a1a

Tipografia padrao:
  Headlines: Montserrat, font-weight 800
  Corpo: Inter, font-weight 400

Layout:
  max-width: 900px
  margin: 0 auto
  sections com padding: 60px 20px desktop e 40px 16px mobile
  alternancia de fundo: branco, cinza-claro, azul-escuro

---

## PASSO 3 - Instrucoes de copywriting por bloco

BLOCO 01 - Hero:
  [Logo pequena centralizada]
  [SUBHEADLINE VERMELHO] pergunta de dor: Nao consegue AVATAR_DOR_PRINCIPAL?
  [HEADLINE PRINCIPAL] 2-3 linhas com destaque em negrito+cor no RESULTADO_PROMETIDO
  [PILL/TAG] microboneficio de atalho: So copiar no seu gerenciador
  [VISUAL ANTES/DEPOIS] lado esquerdo vermelho (resultado ruim),
                         seta amarela, lado direito verde (resultado bom com numeros)
  REGRA: O resultado numerico DEVE aparecer na headline. Nunca generico.

BLOCO 02 - Prova Social:
  [HEADLINE] Veja abaixo resultados reais de quem usa NOME_PRODUTO
  [3 CARDS DE RESULTADO] cada card tem:
    Badge colorido no topo com ROI do aluno
    Linhas com Gastos, Faturamento, Lucro, ROI/ROAS
    Fundo escuro no card central para destaque
  REGRA: Variar tamanhos de investimento para ampla identificacao.

BLOCO 03 - Agitacao da Dor:
  [HEADLINE EMPATIA] Eu sei... PROBLEMA e seu ROI so cai, nao e mesmo?
  [IMAGEM SOFRIMENTO] foto de pessoa estressada com baloes de texto sobrepostos
  [BALOES DE DOR] 4-5 falas reais do avatar em linguagem coloquial
  [FRASE FECHAMENTO] Voce nao aguenta mais ACAO DOLOROSA...
  REGRA: As falas DEVEM soar como o avatar real fala.

BLOCO 04 - Virada:
  [BOX DESTAQUE COM ICONE de aviso]
    Agora eu te pergunto...
    Se voce pudesse ter acesso a SOLUCAO, voce ia ACAO?
    Se a sua resposta for SIM, NOME_PRODUTO e para voce!
  REGRA: A pergunta deve ter como unica resposta logica o sim.

BLOCO 05 - Beneficios:
  [HEADLINE] Com NOME_PRODUTO voce vai:
  [GRID 2x3 ou 3x2] 6 cards com icone + titulo + descricao curta
  REGRA CRITICA: Beneficio e TRANSFORMACAO, nao feature.
    ERRADO: 5 modulos em video HD
    CERTO: Dominar trafego pago em 30 dias sem perder dinheiro testando
  MISTURA: 3 beneficios de GANHO + 3 de ALIVIO DE DOR

BLOCO 06 - Entregaveis:
  [HEADLINE] Veja o que voce vai receber em NOME_PRODUTO
  [CARDS ALTERNADOS] mockup a esquerda e texto a direita, depois inverte
  [BANNER SEPARADOR] fundo azul: AINDA NAO ACABOU! Voce tambem vai receber
  [CARDS DOS BONUS] mesmo formato alternado
  REGRA: O banner de transicao para bonus aumenta antecipacao. Nunca omitir.

BLOCO 07 - Big Players:
  [HEADLINE] Grandes players tambem utilizam NOME_PRODUTO
  [FOTOS EM LINHA] 4-6 pessoas com nome embaixo
  REGRA: Se nao tiver big players reais, usar numero total de alunos.

BLOCO 08 - Para Quem E:
  [HEADLINE] NOME_PRODUTO e para voce que:
  [LAYOUT DIVIDIDO] imagem a esquerda + lista a direita
  [LISTA COM CHECKMARK] 5-7 situacoes especificas
  [CTA INTERMEDIARIO] botao verde: QUERO NOME_PRODUTO AGORA
  REGRA: Quanto mais especifica a lista, maior a identificacao.

BLOCO 09 - Recapitulacao + Preco:
  [HEADLINE] RECAPITULANDO... Veja tudo que voce vai receber
  [LISTA DE ANCORA] cada entregavel com preco individual riscado
  [TOTAL RISCADO] Tudo isso deveria custar: PRECO_ORIGINAL
  [BANNER CONTRASTE] Mas hoje voce tem acesso por apenas:
  [CARD DE OFERTA] mockup + PRECO_PARCELADO grande + PRECO_A_VISTA + botao CTA
  [SELOS] Compra Segura, Satisfacao Garantida, Privacidade Protegida
  REGRA CRITICA: A ancora de preco e o gatilho mais importante de conversao.

BLOCO 10 - Como Funciona:
  [HEADLINE] Compre agora e receba seu acesso imediatamente!
  [3 ICONES EM LINHA]
    FACA SUA COMPRA: Em minutos voce recebe o acesso no e-mail
    BAIXE O MATERIAL: Disponivel para download no celular ou computador
    TUDO PRONTO: So seguir e ver o resultado subir
  REGRA: Deve ser simples e rapido de ler. Elimina ansiedade pos-compra.

BLOCO 11 - Autoridade do Produtor:
  [FUNDO ESCURO] azul-escuro ou grafite
  [NOME EM COR PRIMARIA] NOME_PRODUTOR
  [FOTO PROFISSIONAL] a direita ou centralizada
  [BIO] 3-4 paragrafos: resultado proprio + parceiro reconhecido + resultado de alunos
  REGRA: Bio e prova de que ele/ela FAZ o que ensina. Nao e curriculo academico.

BLOCO 12 - Duas Opcoes + CTA Final:
  [HEADLINE] Agora, voce tem duas opcoes
  [CARD OPCAO 1 BORDA VERMELHA] X Opcao 1: futuro de dor sem o produto
  [CARD OPCAO 2 BORDA VERDE] Check Opcao 2: futuro positivo com o produto
  [FRASE DE FECHAMENTO] Eu sei, e voce tambem sabe... A Opcao 2 e a mais inteligente.
  [REPETICAO DO CARD DE OFERTA] identico ao do Bloco 09
  REGRA: A Opcao 1 deve ser dolorosa de imaginar (gatilho de perda).
  REGRA: A repeticao do card de oferta e obrigatoria.

FOOTER:
  [LOGO OU NOME DO PRODUTO]
  Tem duvidas? Entre em contato: EMAIL_SUPORTE
  [AVISO LEGAL] Este site nao e afiliado ao Facebook ou qualquer entidade do Facebook.
    A compra desse material nao garante nenhum tipo de resultado.
  Copyright ANO Todos os Direitos Reservados.
  CIDADE/ESTADO | CNPJ: CNPJ

---

## PASSO 4 - Imagens: como inserir e onde hospedar

### Mapa de imagens por bloco

Sempre gerar o HTML com comentarios e placeholders de imagem.
Quando o usuario nao fornecer a URL, usar placeholder visivel e div de fallback colorida.

BLOCO 01 - Hero:
  Comentario no HTML: IMAGEM BLOCO 01 - visual comparativo antes/depois
  Placeholder: [URL_IMAGEM_HERO]
  Fallback: div azul claro, altura 200px, texto "Imagem Antes/Depois"

BLOCO 02 - Prova Social:
  Comentario no HTML: IMAGEM BLOCO 02 - print do painel de anuncios
  Placeholders: [URL_PRINT_RESULTADO_1] [URL_PRINT_RESULTADO_2] [URL_PRINT_RESULTADO_3]
  Fallback: div cinza, altura 150px, texto "Print Resultado Aluno N"

BLOCO 03 - Agitacao:
  Comentario no HTML: IMAGEM BLOCO 03 - foto de pessoa estressada/frustrada
  Placeholder: [URL_IMAGEM_FRUSTRACAO]
  Fallback: div cinza escuro, altura 300px, texto "Foto Avatar Frustrado"

BLOCO 06 - Entregaveis:
  Comentario no HTML: IMAGEM BLOCO 06 - mockup 3D do modulo N
  Placeholders: [URL_MOCKUP_MODULO_1] [URL_MOCKUP_MODULO_2] etc.
  Fallback: div azul, altura 180px, texto "Mockup Modulo N"

BLOCO 07 - Big Players:
  Comentario no HTML: IMAGEM BLOCO 07 - foto do player N
  Placeholders: [URL_FOTO_PLAYER_1] [URL_FOTO_PLAYER_2] etc.
  Fallback: div circular azul claro com iniciais do nome

BLOCO 08 - Para Quem E:
  Comentario no HTML: IMAGEM BLOCO 08 - foto de pessoa trabalhando no computador
  Placeholder: [URL_IMAGEM_PARA_QUEM]
  Fallback: div cinza, altura 250px, texto "Foto Avatar"

BLOCO 09 - Oferta:
  Comentario no HTML: IMAGEM BLOCO 09 - mockup do pacote completo
  Placeholder: [URL_MOCKUP_PACOTE]
  Fallback: div azul escuro, altura 220px, texto "Mockup Pacote Completo"

BLOCO 11 - Autoridade:
  Comentario no HTML: IMAGEM BLOCO 11 - foto profissional do produtor
  Placeholder: [URL_FOTO_PRODUTOR]
  Fallback: div azul escuro, altura 350px, texto "Foto NOME_PRODUTOR"

### Codigo padrao para imagens

COM URL fornecida pelo usuario:
  img src="URL_AQUI" alt="descricao" style="width:100%; border-radius:12px; display:block;"

SEM URL (usar fallback visual para nao quebrar o layout):
  div style="background:#eaf2fb; border-radius:12px; min-height:200px;
    display:flex; align-items:center; justify-content:center;
    border:2px dashed #1a5cb5; color:#1a5cb5; font-weight:700; font-size:14px;
    text-align:center; padding:20px;"
    [URL_IMAGEM_DESCRICAO - substitua pela URL real da imagem]
  /div

### Onde hospedar as imagens

1. Imgur.com
   Acesse imgur.com, arraste a imagem, clique com botao direito na imagem
   exibida e copie o endereco da imagem. Cole no placeholder.
   Gratuito, sem cadastro, link permanente.

2. Google Drive
   Suba a imagem, clique em Compartilhar, defina como qualquer pessoa com o link.
   Pegue o ID do arquivo no link e use assim:
   https://drive.google.com/uc?export=view&id=ID_DO_ARQUIVO
   Gratuito, precisa deixar publico.

3. Cloudinary.com
   Crie conta gratuita, suba a imagem, copie a URL gerada automaticamente.
   Gratuito ate 25GB. Melhor opcao para producao.

4. Pasta local junto do HTML
   Crie uma pasta chamada "imagens" no mesmo diretorio do arquivo HTML.
   Use no codigo: src="imagens/nome-da-imagem.jpg"
   Funciona localmente ou se subir a pasta inteira para hospedagem.

### Regra geral para o Claude Code sobre imagens

Sempre que o usuario nao fornecer URL de imagem:
  1. Inserir comentario HTML explicando qual imagem vai ali
  2. Usar placeholder visivel entre colchetes: [URL_IMAGEM_DESCRICAO]
  3. Gerar div de fallback colorida para nao quebrar o layout
  4. Ao final do arquivo HTML, listar todas as imagens para substituir

Lista final obrigatoria no fim do HTML gerado (dentro de comentario HTML):
  IMAGENS PARA SUBSTITUIR:
  [URL_IMAGEM_HERO]        Bloco 01: visual antes/depois ou print de resultado
  [URL_PRINT_RESULTADO_1]  Bloco 02: print do painel do aluno 1
  [URL_PRINT_RESULTADO_2]  Bloco 02: print do painel do aluno 2
  [URL_PRINT_RESULTADO_3]  Bloco 02: print do painel do aluno 3
  [URL_IMAGEM_FRUSTRACAO]  Bloco 03: foto de pessoa frustrada/estressada
  [URL_MOCKUP_MODULO_1]    Bloco 06: mockup 3D do modulo 1
  [URL_MOCKUP_PACOTE]      Bloco 09: mockup do pacote completo
  [URL_FOTO_PRODUTOR]      Bloco 11: foto profissional do produtor

---

## PASSO 5 - Regras de copywriting globais

REGRA 1 - ESPECIFICIDADE
  Sempre use numeros reais. Nunca: aumente seu ROI. Sempre: ROI acima de 2.

REGRA 2 - LINGUAGEM DO AVATAR
  Escreva como o avatar fala, nao como voce quer soar.
  Se o nicho usa girias ou palavroes, use-os nos baloes de dor do Bloco 03.

REGRA 3 - TRANSFORMACAO vs. FEATURE
  Cada beneficio deve comunicar RESULTADO, nao conteudo.
  ERRADO: 5 modulos em video HD
  CERTO: Dominar trafego pago em 30 dias sem perder dinheiro testando

REGRA 4 - ANCORA DE PRECO
  Nunca revele o preco sem antes criar ancora. Sequencia obrigatoria:
  preco individual de cada item > soma total riscada > preco real

REGRA 5 - REPETICAO DO CTA
  O botao de compra deve aparecer pelo menos 3 vezes na pagina:
  1. Final do Bloco 08
  2. Bloco 09 apos ver o preco
  3. Bloco 12 fechamento final

REGRA 6 - PROVA ANTES DA OFERTA
  NUNCA apresente o produto antes de mostrar prova de resultado.
  Ordem correta: Dor > Prova > Solucao

REGRA 7 - GATILHOS OBRIGATORIOS
  Escassez/urgencia   acesso por apenas + preco com desconto
  Prova social        prints reais + big players
  Autoridade          bio do produtor com resultado proprio
  Perda (loss)        Bloco 12 Opcao 1 com futuro de dor
  Simplicidade        Bloco 10 com 3 passos de entrega
  Seguranca           selos de garantia em todo CTA

REGRA 8 - MOBILE FIRST
  70% do trafego em low ticket vem de mobile.
  Fonte minima: 16px. Botao CTA: largura 100% no mobile.
  Antes/depois: empilhar verticalmente no mobile.

---

## PASSO 6 - Checklist final antes de entregar

COPY:
  A headline tem numero especifico de resultado?
  As falas dos baloes soam como o avatar real fala?
  Cada beneficio e uma transformacao, nao uma feature?
  A ancora de preco esta corretamente somada?
  O Bloco 12 Opcao 1 e doloroso o suficiente?

IMAGENS:
  Todos os blocos tem imagem real ou fallback colorido no lugar?
  Os placeholders estao visiveis com colchetes para facilitar substituicao?
  A lista de imagens para substituir esta no final do HTML?
  As divs de fallback tem altura minima para nao quebrar o layout?

VISUAL:
  O botao CTA esta em verde e tamanho grande?
  Os selos de seguranca aparecem junto de cada CTA?
  O card de oferta se repete no Bloco 12?
  O antes/depois tem numeros reais?

TECNICO:
  A pagina e responsiva no mobile?
  O link do checkout esta no href do botao CTA?
  O footer tem aviso legal + CNPJ + e-mail de suporte?
  Fontes carregam via Google Fonts?
  Nao ha dependencias externas quebradas?

CONVERSAO:
  O CTA aparece pelo menos 3 vezes na pagina?
  A prova social vem ANTES da apresentacao do produto?
  O bloco Como Funciona elimina a ansiedade de entrega?

---

## NOTAS IMPORTANTES

- Esta estrutura funciona para qualquer nicho: marketing digital, saude,
  financas, relacionamento, produtividade, culinaria, pets, etc.
- Para produtos high ticket acima de R$497, adicionar bloco de FAQ e
  bloco de garantia explicita com prazo de devolucao.
- Para produtos com video VSL, o Bloco 01 pode ser substituido por um player
  de video + headline abaixo. O restante da estrutura permanece identico.
- O link do botao CTA deve sempre apontar para checkout de plataforma confiavel
  como Hotmart, Kiwify ou Monetizze para aumentar a confianca do comprador.
