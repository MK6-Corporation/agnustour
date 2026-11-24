# Agnus Tour: site de peregrinações e captação de leads

Site com as 4 peregrinações (México e Cancún, Terra Santa e Roma, Aparecida e Canção Nova com Pe. Idlain e com Pe. Welinton). Cada viagem tem seu formulário de qualificação, os leads recebem pontuação automática, há um painel administrativo e os leads são enviados para o Google Sheets.

Identidade visual extraída de agnustour.com.br: azul `#009BDC` / `#006B97`, texto `#313041`, creme `#FAF5EE`, fontes DM Sans + Caveat e o logo oficial. Fotos tiradas dos roteiros em PDF da agência.

## Fluxo do formulário

1. O cliente responde as 6 perguntas e informa nome, cidade/UF e a autorização (LGPD).
2. Ao tocar em **Enviar pelo WhatsApp**, o site calcula a pontuação, gera o **protocolo** e abre o WhatsApp da Agnus Tour com a mensagem pronta (viagem, dados, as 6 respostas e o protocolo).
3. Em paralelo, uma cópia vai para a planilha Google (ou para o servidor, na versão com painel).

**Protocolo** `AG-TS-38857`: `TS` = viagem (MX, TS, AI, AW) · `38` = aleatório · `85` = pontuação · último dígito = termômetro (**7 Quente · 4 Morno · 1 Frio**). O cliente vê só um número de atendimento.

Os pontos de cada resposta ficam em `lib/trips.js` (e no painel /admin da versão com servidor). Depois de alterar, rode `node build-static.js`.

## Versão em arquivo único (sem servidor) — recomendada

`dist/agnus-tour.html` funciona sozinho: CSS, JavaScript, imagens e Política de Privacidade estão embutidos.
Pode ser aberto direto no navegador ou publicado em qualquer hospedagem comum (HostGator, Hostinger, Netlify, GitHub Pages…).

1. Instale o Apps Script na planilha (seção abaixo) e copie a URL `/exec`.
2. Abra `agnus-tour.html` num editor de texto e cole a URL em `window.AGNUS_PLANILHA_URL = "";` (logo no início).
   Ou gere já preenchido: `SHEETS_URL='https://script.google.com/macros/s/.../exec' node build-static.js`.
3. Sem a URL, o formulário roda em modo demonstração (não grava).

Nessa versão a **planilha é o painel**: cada lead chega com protocolo, pontuação e termômetro (aba **Legenda** explica o código).
Filtros e exportação: use os filtros do Google Sheets e Arquivo → Fazer download → CSV.

Depois de alterar textos/viagens em `lib/trips.js`, rode `node build-static.js` para regenerar o HTML e a pontuação padrão do script.

## Versão com servidor (painel /admin)

Requisito: Node.js 18 ou mais recente. Não há dependências para instalar.

```bash
ADMIN_PASSWORD='uma-senha-forte' node server.js
```

- Site: `http://localhost:3000`
- Painel: `http://localhost:3000/admin/` (usuário `admin`, ou o valor de `ADMIN_USER`)
- Testes: `npm test`

### Variáveis de ambiente

| Variável | Uso |
|---|---|
| `PORT` | Porta (padrão 3000) |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Login do painel. Sem senha definida, uma é gerada e gravada em `data/.admin-password` |
| `DATA_DIR` | Pasta dos dados (padrão `./data`) |
| `TRUST_PROXY=1` | Use atrás de Nginx, Cloudflare etc. (lê o IP real e o HTTPS) |
| `NODE_ENV=production` | Mantém o HTML da página inicial em cache na memória |
| `GOOGLE_PLACES_API_KEY` + `GOOGLE_PLACE_ID` | Puxa nota, total e depoimentos do Google Meu Negócio |
| `INSTAGRAM_ACCESS_TOKEN` | Feed automático do @agnustouroficial (API oficial do Instagram) |
| `LEAD_RATE_LIMIT` | Envios por IP a cada 10 minutos (padrão 12) |

Sem as chaves do Google e do Instagram, o site continua funcionando. Ele mostra a nota 5,0 / 131 avaliações (editável no painel) com link para o Google, e os posts do Instagram que a equipe escolher no painel, exibidos pela incorporação oficial do Instagram.

## Integração com o Google Sheets

1. Abra a planilha, vá em **Extensões → Apps Script** e cole o conteúdo de `google-apps-script/Codigo.gs`.
2. Troque `TOKEN` por uma senha longa e execute a função `configurar` uma vez.
3. Vá em **Implantar → Nova implantação → App da Web**, com "Executar como: Eu" e "Quem pode acessar: Qualquer pessoa". Copie a URL `/exec`.
4. No painel, abra **Integrações → Planilha Google**, cole a URL e o mesmo TOKEN, marque a opção de envio, salve e clique em **Enviar teste**.

O lead é sempre salvo no servidor **antes** de aparecer a tela de sucesso. Só depois disso ele é enviado à planilha, com até 3 tentativas. Se o envio falhar, o painel mostra o status e permite reenviar o lead. A planilha:

- ignora IDs repetidos;
- cria uma aba por viagem;
- colore a classificação;
- tem uma coluna "Status do atendimento";
- pode enviar um e-mail de alerta para leads quentes (`EMAIL_ALERTA_QUENTE`).

## Pontuação (editável em /admin → Pontuação)

| Critério | Máx. | Perguntas |
|---|---|---|
| Disponibilidade | 25 | P1 |
| Compatibilidade financeira | 30 | P5 (internacionais) / P4 (nacionais) |
| Prazo de reserva | 30 | P6 |
| Documentação, embarque e preparo | 15 | Embarque + passaporte / ônibus / "o que falta" |

Classificação: **75 a 100 pontos = Quente**, **45 a 74 = Morno**, **0 a 44 = Frio**. A classificação nunca bloqueia o envio do formulário.

Viagens internacionais: o **valor de referência por pessoa** começa no preço oficial (Terra Santa e Roma R$ 23.000 · México e Cancún R$ 22.000) e pode ser alterado no painel. A nota financeira compara o teto da faixa escolhida com esse valor. A faixa que cobre o valor recebe 100% dos pontos. Abaixo disso, a tabela de percentuais (também editável) define a nota. Com o campo em branco, valem os pontos fixos por faixa.

## Estrutura

```
server.js                  servidor HTTP (sem dependências)
lib/trips.js               viagens, perguntas, roteiros e pontuação padrão
lib/scoring.js             cálculo da pontuação e classificação
lib/leads.js               validação, registro do lead, CSV e filtros
lib/store.js               gravação atômica em data/leads.json
lib/integrations.js        planilha/webhook, Google Places, Instagram
lib/auth.js                login do painel (sessão por cookie HttpOnly)
public/                    site, painel (/admin) e política de privacidade
google-apps-script/        código para colar no Apps Script da planilha
test/                      testes de ponta a ponta da API
```

## Pendências com o cliente

- Ano e dias exatos da viagem ao México (o material informa apenas "agosto, 9 dias").
- O texto do 3º dia da Terra Santa no PDF termina em "…Arcanjo Gabriel, e". Confirmar a continuação.
- Fotos para os cards das viagens nacionais. Hoje elas usam uma arte com as cores da marca.
- Revisão jurídica da Política de Privacidade.
