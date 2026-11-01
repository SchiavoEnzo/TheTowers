# As Torres · API de RPG
Servidor Next.js (Pages API Routes) com MongoDB Atlas. A página inicial em preto, branco e vermelho apresenta o diretório da API. Todas as operações do jogo usam HTTP e JSON.

## Executar
Use Node.js 22.13 ou superior. Crie um usuário de banco no Atlas com acesso de leitura e escrita à base escolhida e permita o IP do servidor no acesso de rede. Use a URI de conexão do seu cluster e codifique caracteres especiais das credenciais na URI.
```sh
npm ci
cp .env.example .env.local
# Edite MONGODB_URI e MONGODB_DB em .env.local
npm run dev
```
Abra http://localhost:3000. Em produção use HTTPS, configure as mesmas variáveis e execute `npm run build && npm start`. O backend usa transações e requer um replica set ou cluster compatível. Os índices são criados na primeira requisição. Execute `npm test` para validar os contratos das fichas, campanhas e perfil.

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
- Campos e grafias seguem o contrato enviado, incluindo caractheristics, atributes, habilities, dificulty e chaves com hífen. O contrato executável completo fica em lib/schema.js.
- Agente e ameaça recebem fichas independentes com a estrutura integral de being. Agentes acrescentam class e rank. Ameaças acrescentam element, vd, size e species. A lista de ameaças é o catálogo cadastrado pelo usuário.
- Inventário referencia objects e money. Na campanha, users referencia agentes, enemies referencia ameaças, allies referencia beings, locals referencia locais e dates referencia eventos de calendário. Os arrays obrigatórios podem iniciar vazios. Datas usam ISO 8601 com fuso.
- O criador é o mestre da campanha. As contas participantes ficam em members. Os membros consultam a campanha, suas fichas de agentes e o histórico comum. Apenas o proprietário altera uma ficha. Um jogador rola pelo próprio agente vinculado e o mestre pode rolar por qualquer agente do grupo.
- Regra inicial de dados: 1d20 + valor da habilidade. Para ataque, use group igual a attack e key igual a fight ou acuracy. Os parâmetros de dificuldade são metadados da campanha; não alteram o dado. O histórico guarda dado, bônus, total, agente e responsável.
- O combate registra uma cópia das ameaças selecionadas para preservar os valores do encontro. Os endpoints de campanha, fichas e histórico fornecem os dados para uma futura interface de Escudo do Mestre.
- Excluir um recurso ainda vinculado retorna 409. A exclusão de uma campanha remove também seus eventos. Os limites de quantidade observados na conta de referência não foram adotados como regra universal.
- Erros de validação usam 422, credenciais inválidas 401, ação sem permissão 403, recurso ausente ou privado 404 e conflito 409.
