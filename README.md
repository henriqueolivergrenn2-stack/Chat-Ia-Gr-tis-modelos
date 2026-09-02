# groq.chat

Chat multi-modelo usando as APIs da **Groq** e da **Hugging Face** (Inference
Providers), com as chaves gerenciadas **uma vez** por um admin em
`/admin.html` — quem acessar o site depois não precisa colar chave nenhuma,
só escolher o modelo e conversar.

## O que mudou nessa versão

- **Hugging Face como segundo provedor**: além dos modelos da Groq, o chat
  agora também lista modelos servidos pelos *Inference Providers* da Hugging
  Face (Fireworks, Together, DeepInfra, hf-inference, etc, todos atrás de um
  único token grátis). Eles aparecem no seletor com um badge **HF** ao lado
  do badge de capacidade (`chat` / `chat/imagem`). Basta o admin colar um
  token em `/admin.html`; ninguém mais precisa colar nada.
- **Roteamento automático**: cada modelo retornado por `/api/models` já vem
  identificado (id prefixado com `hf:` pros modelos da Hugging Face); o
  `/api/chat` decide sozinho pra qual provedor mandar a conversa, sem o
  front-end precisar saber a diferença.
- **Duas chaves, mesmo esquema de armazenamento**: a chave da Groq e o token
  da Hugging Face são guardados separadamente (arquivo local, KV ou variável
  de ambiente fixa — ver `.env.example`), mas seguem exatamente a mesma
  lógica de persistência.
- **Chave centralizada**: quem usa o chat nunca vê nem cola nenhuma chave; o
  front-end fala só com `/api/chat` e `/api/models` (rotas próprias), que
  usam as chaves guardadas no servidor.
- **Painel de admin** (`/admin.html`): protegido por senha (`ADMIN_PASSWORD`).
  É lá que você cola a chave da Groq e, opcionalmente, o token da Hugging
  Face.
- **Modelos com badge de capacidade**: cada modelo aparece com `chat` ou
  `chat/imagem` (quando também consegue ler imagem) e o nome dele embaixo, num
  seletor em grade em vez do `<select>` simples de antes. Isso é lógica
  genérica (`lib/models.js`) então se a Groq ou a Hugging Face lançarem um
  modelo com outra capacidade no futuro, é só ajustar ali.
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
    hfkey.js            GET/POST  consulta/grava o token da Hugging Face (autenticado)
    whoami.js          GET  diz se a sessão atual está autenticada
  chat.js              POST  proxy de streaming pro chat (Groq ou HF, roteia sozinho — público)
  models.js           GET  lista de modelos já classificados, das duas fontes (público)
  status.js            GET  { ready: true/false } (público, sem segredos)
lib/                  → código compartilhado (auth, storage, classificação de modelos)
public/
  index.html          → o chat em si
  admin.html          → painel de admin (chave da Groq + token da Hugging Face)
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
com a `ADMIN_PASSWORD` que você definiu e cole a chave da Groq e, se quiser,
o token da Hugging Face — cada uma fica salva em `data/config.json`, que
persiste enquanto o processo continuar rodando (reinicie com `node
server.js` de novo depois de fechar o Termux).

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
4. Depois do deploy, acesse `/admin.html`, faça login e cole a chave da Groq
   e, se quiser habilitar os modelos "HF", o token da Hugging Face.

### Importante sobre persistência das chaves na Vercel

A Vercel é serverless: o sistema de arquivos de cada função é efêmero. Isso
quer dizer que **se você salvar as chaves só pelo painel de admin, sem mais
nada configurado, elas ficam guardadas em `/tmp` e podem sumir** num cold
start ou no próximo deploy. Duas formas de resolver, dependendo do que você
prefere:

- **Mais simples**: defina as variáveis de ambiente `GROQ_API_KEY` e/ou
  `HF_TOKEN` direto no painel da Vercel com suas chaves. Elas passam a valer
  sempre, e o painel de admin fica só de status pra cada uma que estiver
  fixa por variável (não vai deixar trocar por ali enquanto a variável
  existir — é assim de propósito, pra não haver ambiguidade sobre qual
  chave está valendo).
- **Mais flexível** (trocar a chave sem precisar redeploy): conecte um
  **Vercel KV** (ou um Upstash Redis) ao projeto. Assim que as variáveis
  `KV_REST_API_URL`/`KV_REST_API_TOKEN` (ou as equivalentes da Upstash)
  existirem no ambiente, o painel de admin passa a gravar as duas chaves
  ali, que é durável entre deploys.

O painel de admin mostra qual modo de armazenamento está ativo (`env`, `kv`,
`tmp-ephemeral` ou `file`) pra cada chave, pra você não ficar no escuro sobre
isso.

## Variáveis de ambiente

Veja `.env.example` — todas comentadas. Resumo rápido:

- `ADMIN_PASSWORD` — obrigatória pra usar `/admin.html`.
- `SESSION_SECRET` — recomendada, assina o cookie de sessão do admin.
- `GROQ_API_KEY` — opcional, fixa a chave da Groq por variável de ambiente.
- `HF_TOKEN` (ou `HUGGINGFACE_API_KEY`) — opcional, fixa o token da Hugging
  Face por variável de ambiente. Pegue um token grátis em
  [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
  (permissão **"Make calls to Inference Providers"** é suficiente).
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — opcionais, só pra Vercel com KV.
- `PORT` — porta do servidor local (Termux/VPS).

## Segurança

- A senha de admin nunca fica em texto puro no cookie: o login gera um token
  assinado por HMAC-SHA256 (`SESSION_SECRET`), guardado num cookie
  `HttpOnly`.
- Nenhuma das duas chaves (Groq ou Hugging Face) é enviada pro navegador de
  quem usa o chat — só o servidor fala com `api.groq.com` e
  `router.huggingface.co`.
- Antes de salvar uma chave/token novo, o painel testa ele contra a API
  correspondente (`GET /models`) pra evitar salvar algo inválido.

## Limitações a saber

- Nem a Groq nem a Hugging Face geram ou editam imagens por esse chat — os
  modelos marcados `chat/imagem` conseguem **ler** imagens que você anexar
  (OCR, descrição, análise), não criar imagens novas.
- Os modelos "HF" são roteados com `:auto` pelo router da Hugging Face, que
  escolhe automaticamente um provedor disponível por trás (Fireworks,
  Together, DeepInfra, hf-inference...); a velocidade e o limite de uso
  variam conforme o provedor escolhido e o plano do seu token.
- Como o site passa a usar chaves compartilhadas por quem acessar, todo uso
  conta pra cota/limite dessas chaves (Groq e/ou Hugging Face). Se for um
  site público, vale considerar algum controle de acesso extra (senha do
  próprio site, por exemplo) — isso não veio implementado aqui, é só o
  painel de admin pra gerenciar as chaves.
