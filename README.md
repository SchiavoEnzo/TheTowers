# As Torres · API de RPG
Aplicação Next.js com interface de jogo em React Router e API conectada ao MongoDB. A página inicial abre o cadastro e o login do Arquivo de Campo. Todas as operações do jogo usam HTTP e JSON.

## Executar
Use Node.js 24.x, a mesma versão principal configurada na Vercel. Crie um usuário de banco no Atlas com acesso de leitura e escrita à base escolhida e permita o IP do servidor no acesso de rede. Use a URI de conexão do seu cluster e codifique caracteres especiais das credenciais na URI.
```sh
npm ci
cp .env.example .env.local
# Edite MONGODB_URI e MONGODB_DB em .env.local
npm run dev
```
Abra http://localhost:3000. Em produção use HTTPS, configure as mesmas variáveis e execute `npm run build && npm start`. O backend usa transações e requer um replica set ou cluster compatível. Os índices são criados na primeira requisição. Execute `npm test` para validar os contratos das fichas, campanhas e perfil.

## Organização do backend

```text
controllers/          Entrada HTTP e respostas, com um controller por entidade
  auth.controller.js
  profile.controller.js
  agent.controller.js
  being.controller.js
  campaign.controller.js
  date.controller.js
  homebrew.controller.js
  local.controller.js
  money.controller.js
  object.controller.js
  threat.controller.js
  record.controller.js  Fábrica do CRUD compartilhado pelos controllers
models/               Contratos Zod por entidade e campos compartilhados
routes/               Métodos e caminhos de cada entidade; index.js reúne as rotas
services/             Autenticação, perfil, CRUD e regras das campanhas
database/             Conexão MongoDB e criação de índices
utils/                Erros, criptografia, consultas, acesso e validação de vínculos
pages/api/[...path].js Entrada Next.js que conecta o banco e encaminha a requisição
pages/index.jsx       Entrada da interface de jogo, carregada no navegador
pages/[...screen].jsx Acesso direto às telas da interface
ui/                   Telas, navegação React Router e cliente HTTP da API
examples/             Exemplos de dados enviados à API
test/                 Testes dos contratos e dos fluxos da API
```

O fluxo é `pages/api → routes → controllers → services → MongoDB`. Os services validam os dados com os models e aplicam as regras de acesso, os vínculos e as transações. Controllers traduzem as chamadas HTTP em operações dos services. A conexão e os índices ficam em `database/`; as coleções existentes (`accounts`, `sessions`, `records` e `events`) foram preservadas, sem necessidade de migrar dados.

Cada recurso tem seu próprio arquivo em `models/`, `controllers/` e `routes/`. O CRUD comum é implementado em `services/record.service.js` e reutilizado pela fábrica `controllers/record.controller.js`. O controller de campanhas acrescenta convites, participantes, escudo, rolagens e combates, com regras em `services/campaign.service.js`. Cadastro, login e logout ficam em `services/auth.service.js`; consulta e edição de perfil ficam em `services/profile.service.js`.

Para acrescentar uma entidade, crie seu model e registre o contrato em `models/index.js`; crie o controller usando `createRecordController` e suas rotas com `resourceRoutes`; registre as rotas em `routes/index.js`. Ações específicas podem ser acrescentadas ao controller e ao respectivo service. O router aplica autenticação às rotas por padrão; apenas cadastro e login têm `public: true`.

Os módulos importam diretamente das pastas correspondentes; a antiga pasta `lib/` foi substituída pela organização acima. As URLs, os corpos JSON e os nomes dos campos do jogo continuam os mesmos. Métodos não permitidos recebem 405 com o cabeçalho `Allow`; caminhos inexistentes recebem 404.

Os testes exercitam os modelos e os fluxos de rotas, autenticação, permissões e vínculos com substitutos do MongoDB. Não exigem banco configurado. Para executar o servidor, configure o replica set local indicado em `.env.example` ou use a URI de um cluster Atlas.

## Primeira missão
Exemplos em Bash com curl e jq. Substitua o e-mail pelo da conta de teste. A senha precisa ter entre 10 e 128 caracteres.
```bash
API=http://localhost:3000/api
read -rp 'E-mail: ' EMAIL
read -rsp 'Senha: ' PW; echo
LOGIN=$(jq -n --arg email "$EMAIL" --arg password "$PW" '{email:$email,password:$password}')
post(){ curl --fail-with-body -sS -H 'Content-Type: application/json' -H "Authorization: Bearer ${TOKEN:-}" -d "$2" "$API/$1"; }
post auth/register "$LOGIN"
TOKEN=$(post auth/login "$LOGIN" | jq -er .token)
unset LOGIN PW
curl -X PATCH "$API/profile" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Vigia","image":"https://example.org/avatar.png"}'
AGENT=$(post agents @examples/agent.json | jq -er ._id)
CAMPAIGN=$(post campaigns "$(jq -n --arg a "$AGENT" '{name:"As Torres",desc:"Expedição",start:"2026-11-01T18:00:00Z",end:"2026-11-01T22:00:00Z",dificulty:{level:1,"rolling-minimum-level":5},users:[$a],enemies:[],locals:[]}')" | jq -er ._id)
post "campaigns/$CAMPAIGN/rolls" "$(jq -n --arg a "$AGENT" '{agent:$a,group:"lasts",key:"perception"}')"
curl -sS "$API/campaigns/$CAMPAIGN/rolls" -H "Authorization: Bearer $TOKEN"
```

## Rotas
Prefixo de todas as rotas: `/api`. Autenticação via `Authorization: Bearer TOKEN`, exceto cadastro e login. Sessões expiram em 24 horas. O cadastro cria conta e perfil na mesma gravação. A imagem de perfil é uma URL HTTPS que pode ser alterada ou removida com null.

| Método | Caminho | Entrada / finalidade |
|---|---|---|
| POST | /auth/register, /auth/login | email, password. Login devolve token e validade |
| POST | /auth/logout | Revoga o token utilizado |
| GET, PATCH | /profile | Consultar perfil ou alterar name e image |
| GET, POST | /{recurso} | Listar ou criar com o corpo da entidade |
| GET, PUT, DELETE | /{recurso}/{id} | Consultar, substituir os dados completos ou excluir |
| POST | /campaigns/{id}/invites | Mestre gera código reutilizável válido por 24h. Novo código invalida o anterior |
| POST | /campaigns/{id}/join | Outra conta autenticada envia {"code":"..."} |
| POST | /campaigns/{id}/agents | Participante vincula um agente próprio com {"agent":"ID"} |
| GET | /campaigns/{id}/shield | Escudo do Mestre com fichas, últimas 30 rolagens e últimos 10 combates |
| GET, POST | /campaigns/{id}/rolls | Histórico ou rolagem com agent, group e key |
| GET, POST | /campaigns/{id}/combats | Histórico ou criação pelo mestre com name e threats (IDs presentes em enemies) |

Recursos CRUD: beings, agents, threats, objects, money, campaigns, dates, locals e homebrews. Os documentos retornam _id e data. POST e PUT recebem apenas o conteúdo de data. As listagens retornam até 100 itens, com busca por nome em q e paginação via before (último _id). Ameaças aceitam element. Homebrews aceitam category (threat, ability, ritual ou item). O histórico da campanha retorna os 100 eventos mais recentes.

## Modelo e regras adotadas
- Campos e grafias seguem o contrato enviado, incluindo caractheristics, atributes, habilities, dificulty e chaves com hífen. Os contratos executáveis ficam em models/, reunidos em models/index.js.
- Agente e ameaça recebem fichas independentes com a estrutura integral de being. Agentes acrescentam class e rank. Ameaças acrescentam element, vd, size e species. A lista de ameaças é o catálogo cadastrado pelo usuário.
- Inventário referencia objects e money. Na campanha, users referencia agentes, enemies referencia ameaças, allies referencia beings, locals referencia locais e dates referencia eventos de calendário. Os arrays obrigatórios podem iniciar vazios. Datas usam ISO 8601 com fuso.
- O criador é o mestre da campanha. As contas participantes ficam em members. Os membros consultam a campanha, suas fichas de agentes e o histórico comum. Apenas o proprietário altera uma ficha. Um jogador rola pelo próprio agente vinculado e o mestre pode rolar por qualquer agente do grupo.
- Regra inicial de dados: 1d20 + valor da habilidade. Para ataque, use group igual a attack e key igual a fight ou acuracy. Os parâmetros de dificuldade são metadados da campanha; não alteram o dado. O histórico guarda dado, bônus, total, agente e responsável.
- O combate registra uma cópia das ameaças selecionadas para preservar os valores do encontro. Os endpoints de campanha, fichas e histórico fornecem os dados para uma futura interface de Escudo do Mestre.
- Excluir um recurso ainda vinculado retorna 409. A exclusão de uma campanha remove também seus eventos. Os limites de quantidade observados na conta de referência não foram adotados como regra universal.
- Erros de validação usam 422, credenciais inválidas 401, ação sem permissão 403, recurso ausente ou privado 404 e conflito 409.

## Interface de jogo
A página inicial abre o cadastro e o login. O mesmo processo Next.js serve a interface React Router e as rotas /api. Após entrar, abra Agentes para criar uma ficha, crie uma campanha com esse agente e abra a mesa para rolar uma habilidade. O histórico da mesa vem do servidor. A central também permite consultar ameaças e homebrews e editar o perfil.

A tela inicial pode ser visualizada sem MongoDB configurado. Cadastro, login e operações de jogo precisam de uma conexão válida em `.env.local`. O arquivo `examples/agent.json` é compartilhado pelo formulário de agentes, pela seleção de habilidades da mesa e pelos testes dos contratos; ele deve permanecer versionado.

## Publicação na Vercel

Importe `SchiavoEnzo/TheTowers` na conta desejada, usando o preset Next.js e a raiz do repositório. O `vercel.json` define as funções na região `gru1` (São Paulo), próxima do cluster Atlas. As rotas de páginas e de API são detectadas pelo Next.js, sem rewrites adicionais.

Configure `MONGODB_URI` como segredo e `MONGODB_DB` como configuração nas variáveis de ambiente do projeto antes do deploy. Use bancos e credenciais separados para previews. A lista de acesso de rede do Atlas precisa permitir a origem das funções da Vercel; permitir apenas o IP de desenvolvimento não libera o ambiente publicado.

Para desenvolvimento local, configure essas duas variáveis em `.env.local`, carregado automaticamente pelo Next.js. Arquivos de credenciais como `atlas-credentials.env` não são carregados automaticamente e ficam excluídos do Git e do upload pela CLI da Vercel. Nunca inclua credenciais em `vercel.json` nem em variáveis com prefixo `NEXT_PUBLIC_`.
