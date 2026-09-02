# groq.chat

Chat multi-modelo usando a API da Groq (streaming), com a chave gerenciada
**uma vez** por um admin em `/admin.html` — quem acessar o site depois não
precisa colar chave nenhuma, só escolher o modelo e conversar.

## O que mudou nessa versão

- **Chave centralizada**: antes cada pessoa colava a própria chave da Groq no
  navegador dela. Agora a chave fica só no servidor; o front-end fala com
  `/api/chat` e `/api/models` (rotas próprias), que usam a chave guardada.
- **Painel de admin** (`/admin.html`): protegido por senha (`ADMIN_PASSWORD`).
  É lá que você cola a chave da Groq depois do deploy.
- **Modelos com badge de capacidade**: cada modelo aparece com `chat` ou
  `chat/imagem` (quando também consegue ler imagem) e o nome dele embaixo, num
  seletor em grade em vez do `<select>` simples de antes. Isso é lógica
  genérica (`lib/models.js`) então se a Groq lançar um modelo com outra
  capacidade no futuro, é só ajustar ali.
- Zero dependências de npm — tudo com módulos nativos do Node
  (`http`, `crypto`, `fs`). Isso importa principalmente pro Termux, onde
  `npm install` de pacotes com binário nativo às vezes dá dor de cabeça.

## Estrutura

```
api/                 → funções serverless (Vercel) / handlers (server.js)
  admin/
    login.js          POST  login com a senha de admin
    logout.js          POST  encerra a sessão
    key.js              GET/POST  consulta/grava a chave da Groq (autenticado)
    whoami.js          GET  diz se a sessão atual está autenticada
  chat.js              POST  proxy de streaming pro chat da Groq (público)
  models.js           GET  lista de modelos já classificados (público)
  status.js            GET  { ready: true/false } (público, sem segredos)
lib/                  → código compartilhado (auth, storage, classificação de modelos)
public/
  index.html          → o chat em si
  admin.html          → painel de admin
server.js             → servidor Node standalone (Termux, VPS, etc.)
vercel.json
package.json
.env.example
```

## Rodando no Termux (Android)

```bash
pkg install nodejs-lts   # se ainda não tiver
cd groqchat
cp .env.example .env
# edite o .env e defina pelo menos ADMIN_PASSWORD (e de preferência SESSION_SECRET)
nano .env
node server.js
```

Isso sobe o site em `http://localhost:3000` (ajustável pela variável `PORT`).
Abra esse endereço no navegador do celular. Vá em `/admin.html`, faça login
com a `ADMIN_PASSWORD` que você definiu e cole a chave da Groq — ela fica
salva em `data/config.json`, que persiste enquanto o processo continuar
rodando (reinicie com `node server.js` de novo depois de fechar o Termux).

Pra deixar rodando em segundo plano no Termux, dá pra usar `tmux` ou
`termux-services`; isso já foge do escopo deste projeto, mas o app em si não
muda nada.

## Deploy na Vercel

1. Suba esta pasta pro GitHub (ou use `vercel` via CLI direto na pasta).
2. Importe o repositório na Vercel — ela detecta `/api` como funções
   serverless e `/public` como os arquivos estáticos automaticamente, sem
   precisar de build command.
3. Em **Project Settings → Environment Variables**, configure pelo menos:
   - `ADMIN_PASSWORD` — a senha do painel `/admin.html`
   - `SESSION_SECRET` — uma string aleatória (ex: `openssl rand -hex 32`)
4. Depois do deploy, acesse `/admin.html`, faça login e cole a chave da Groq.

### Importante sobre persistência da chave na Vercel

A Vercel é serverless: o sistema de arquivos de cada função é efêmero. Isso
quer dizer que **se você salvar a chave só pelo painel de admin, sem mais
nada configurado, ela fica guardada em `/tmp` e pode sumir** num cold start
ou no próximo deploy. Duas formas de resolver, dependendo do que você
prefere:

- **Mais simples**: defina a variável de ambiente `GROQ_API_KEY` direto no
  painel da Vercel com a sua chave. Ela passa a valer sempre, e o painel de
  admin fica só de status (não vai deixar trocar por ali enquanto essa
  variável existir — é assim de propósito, pra não haver ambiguidade sobre
  qual chave está valendo).
- **Mais flexível** (trocar a chave sem precisar redeploy): conecte um
  **Vercel KV** (ou um Upstash Redis) ao projeto. Assim que as variáveis
  `KV_REST_API_URL`/`KV_REST_API_TOKEN` (ou as equivalentes da Upstash)
  existirem no ambiente, o painel de admin passa a gravar ali, que é durável
  entre deploys.

O painel de admin mostra qual modo de armazenamento está ativo (`env`, `kv`,
`tmp-ephemeral` ou `file`) pra você não ficar no escuro sobre isso.

## Variáveis de ambiente

Veja `.env.example` — todas comentadas.

## Segurança

- A senha de admin nunca fica em texto puro no cookie: o login gera um token
  assinado por HMAC-SHA256 (`SESSION_SECRET`), guardado num cookie
  `HttpOnly`.
- A chave da Groq nunca é enviada pro navegador de quem usa o chat — só o
  servidor fala com `api.groq.com`.
- Antes de salvar uma chave nova, o painel testa ela contra a API da Groq
  (`GET /models`) pra evitar salvar algo inválido.

## Limitações a saber

- A Groq não gera nem edita imagens — os modelos marcados `chat/imagem`
  conseguem **ler** imagens que você anexar (OCR, descrição, análise), não
  criar imagens novas.
- Como o site passa a usar uma chave só, compartilhada por quem acessar,
  todo uso conta pra cota/limite dessa chave na Groq. Se for um site público,
  vale considerar algum controle de acesso extra (senha do próprio site,
  por exemplo) — isso não veio implementado aqui, é só o painel de admin
  pra gerenciar a chave.
