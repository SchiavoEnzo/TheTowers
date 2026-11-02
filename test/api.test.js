import test from 'node:test'
import assert from 'node:assert/strict'
import { ObjectId } from 'mongodb'
import { dispatch } from '../routes/index.js'
import { handleApiError } from '../utils/errors.js'
import { digest } from '../utils/crypto.js'

const user = 'a'.repeat(24)
const other = 'b'.repeat(24)
const recordId = 'c'.repeat(24)
const agentId = 'd'.repeat(24)
const rawToken = 'e'.repeat(64)
const session = { _id: digest(rawToken), user, expires: new Date(Date.now() + 86400000) }

function database(collections) {
  return {
    collection(name) {
      assert.ok(collections[name], `Coleção inesperada: ${name}`)
      return collections[name]
    },
    client: {
      withSession: (callback) => callback({ withTransaction: (transaction) => transaction() }),
    },
  }
}

async function request(db, path, method = 'GET', body, { authenticated = true, query = {}, headers = {} } = {}) {
  const req = { method, body, query, headers }
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
    end() { return this },
  }
  try {
    await dispatch(db, path.split('/'), req, res, authenticated ? session : undefined)
  } catch (error) {
    handleApiError(error, res)
  }
  return res
}

test('cada entidade lista apenas registros acessíveis e oculta o hash de convite', async () => {
  for (const kind of ['beings', 'agents', 'threats', 'objects', 'money', 'locals', 'dates', 'campaigns', 'homebrews']) {
    let filter
    const cursor = {
      sort(value) { assert.deepEqual(value, { _id: -1 }); return this },
      limit(value) { assert.equal(value, 100); return this },
      async toArray() { return [{ _id: recordId, inviteHash: 'segredo', data: {} }] },
    }
    const db = database({ records: { find(value) { filter = value; return cursor } } })
    const res = await request(db, kind)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, [{ _id: recordId, data: {} }])
    assert.deepEqual(filter, kind === 'campaigns'
      ? { kind, $or: [{ owner: user }, { members: user }] }
      : { kind, owner: user })
  }
})

test('busca escapa regex, filtra ameaças e mantém paginação', async () => {
  let filter
  const cursor = { sort() { return this }, limit() { return this }, async toArray() { return [] } }
  const db = database({ records: { find(value) { filter = value; return cursor } } })
  const res = await request(db, 'threats', 'GET', undefined, {
    query: { q: 'A.*[B]', element: 'medo', before: recordId },
  })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(filter['data.caractheristics.name'], { $regex: 'A\\.\\*\\[B\\]', $options: 'i' })
  assert.equal(filter['data.element'], 'medo')
  assert.deepEqual(filter._id, { $lt: recordId })
})

test('rotas inválidas, métodos, IDs e autenticação recebem erros adequados', async () => {
  const db = database({})
  assert.equal((await request(db, 'desconhecido')).statusCode, 404)
  assert.equal((await request(db, `agents/${recordId}/invites`)).statusCode, 404)
  assert.equal((await request(db, 'agents/id-invalido')).statusCode, 422)
  const invalidMethod = await request(db, 'agents', 'PATCH')
  assert.equal(invalidMethod.statusCode, 405)
  assert.equal(invalidMethod.headers.Allow, 'GET, POST')
  assert.equal((await request(db, 'agents', 'GET', undefined, { authenticated: false })).statusCode, 401)
})

test('cadastro e login públicos preservam senha derivada e token armazenado como hash', async () => {
  let account, storedSession
  const db = database({
    accounts: {
      async insertOne(document) { account = { ...document, _id: new ObjectId(user) }; return { insertedId: account._id } },
      async findOne({ email }) { return account?.email === email ? account : null },
    },
    sessions: { async insertOne(document) { storedSession = document } },
  })
  const credentials = { email: 'VIGIA@example.org', password: 'senha-de-teste-123' }
  const registered = await request(db, 'auth/register', 'POST', credentials, { authenticated: false })
  assert.equal(registered.statusCode, 201)
  assert.equal(registered.body.email, 'vigia@example.org')
  assert.equal(registered.body.hash, undefined)
  assert.equal(account.password, undefined)
  assert.match(account.hash, /^[a-f0-9]{128}$/)
  const logged = await request(db, 'auth/login', 'POST', credentials, { authenticated: false })
  assert.equal(logged.statusCode, 200)
  assert.match(logged.body.token, /^[a-f0-9]{64}$/)
  assert.equal(storedSession._id, digest(logged.body.token))
  assert.equal(storedSession.user, user)
  assert.ok(storedSession.expires > new Date())
  const rejected = await request(db, 'auth/login', 'POST', { ...credentials, password: 'outra-senha-123' }, { authenticated: false })
  assert.equal(rejected.statusCode, 401)
})

test('perfil vazio é rejeitado e logout revoga apenas a sessão atual', async () => {
  let removed
  const db = database({ sessions: { async deleteOne(filter) { removed = filter } } })
  const profile = await request(db, 'profile', 'PATCH', {})
  assert.equal(profile.statusCode, 422)
  const logout = await request(db, 'auth/logout', 'POST')
  assert.equal(logout.statusCode, 204)
  assert.deepEqual(removed, { _id: session._id })
})

test('rotas protegidas verificam o hash e a validade da sessão Bearer', async () => {
  let active = true
  const db = database({
    sessions: { async findOne(filter) {
      assert.equal(filter._id, digest(rawToken))
      assert.ok(filter.expires.$gt instanceof Date)
      return active ? session : null
    } },
    accounts: { async findOne(filter, options) {
      assert.equal(filter._id.toString(), user)
      assert.deepEqual(options.projection, { email: 1, profile: 1 })
      return { email: 'vigia@example.org', profile: { name: 'Vigia' } }
    } },
  })
  const options = { authenticated: false, headers: { authorization: `Bearer ${rawToken}` } }
  const result = await request(db, 'profile', 'GET', undefined, options)
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.profile.name, 'Vigia')
  active = false
  assert.equal((await request(db, 'profile', 'GET', undefined, options)).statusCode, 401)
})

test('fichas compartilhadas só podem ser consultadas por participantes da campanha', async () => {
  let participates = true
  const db = database({ records: { async findOne(filter) {
    if (filter.kind === 'campaigns') {
      assert.equal(filter['data.users'], agentId)
      assert.deepEqual(filter.$or, [{ owner: user }, { members: user }])
      return participates ? { _id: recordId } : null
    }
    return filter.owner ? null : { _id: agentId, owner: other, data: {} }
  } } })
  assert.equal((await request(db, `agents/${agentId}`)).statusCode, 200)
  participates = false
  assert.equal((await request(db, `agents/${agentId}`)).statusCode, 404)
})

test('criação valida o modelo e registra a entidade com seu proprietário', async () => {
  let inserted
  const db = database({ records: { async insertOne(document) { inserted = document } } })
  assert.equal((await request(db, 'locals', 'POST', { name: 'Torre' })).statusCode, 422)
  const result = await request(db, 'locals', 'POST', { name: 'Torre', desc: 'Local da missão' })
  assert.equal(result.statusCode, 201)
  assert.equal(inserted.kind, 'locals')
  assert.equal(inserted.owner, user)
  assert.match(inserted._id, /^[a-f0-9]{24}$/)
  assert.deepEqual(result.body, inserted)
})

test('edição de campanha mantém agentes de jogadores já vinculados e valida novos vínculos', async () => {
  const previous = { data: { users: [agentId] } }
  const references = []
  const db = database({ records: {
    async findOne() { return previous },
    async updateOne(filter, update) {
      if (update.$inc) references.push(filter)
      return { matchedCount: 1 }
    },
  } })
  const input = {
    name: 'Torre', desc: 'Missão', start: '2026-01-01T00:00:00Z', end: '2026-01-02T00:00:00Z',
    users: [agentId, other], enemies: [], locals: [],
    dificulty: { level: 1, 'rolling-minimum-level': 5 },
  }
  const result = await request(db, `campaigns/${recordId}`, 'PUT', input)
  assert.equal(result.statusCode, 200)
  assert.deepEqual(references, [
    { _id: agentId, kind: 'agents' },
    { _id: other, kind: 'agents', owner: user },
  ])
})

test('exclusão impede registros vinculados e remove eventos ao excluir campanha', async () => {
  let linked = true, eventsRemoved = false, removed = false
  const db = database({
    records: {
      async findOne(filter) { return filter._id ? { _id: recordId } : linked ? { _id: other } : null },
      async deleteOne() { removed = true },
    },
    events: { async deleteMany(filter) { assert.deepEqual(filter, { campaign: recordId }); eventsRemoved = true } },
  })
  assert.equal((await request(db, `campaigns/${recordId}`, 'DELETE')).statusCode, 409)
  assert.equal(removed, false)
  assert.equal(eventsRemoved, false)
  linked = false
  assert.equal((await request(db, `campaigns/${recordId}`, 'DELETE')).statusCode, 204)
  assert.equal(removed, true)
  assert.equal(eventsRemoved, true)
})

test('rolagens respeitam a propriedade do agente e registram dado e bônus', async () => {
  let owner = other, saved
  const db = database({
    records: { async findOne(filter) {
      return filter.kind === 'campaigns'
        ? { owner: other, data: { users: [agentId] } }
        : { owner, data: { habilities: { lasts: { fight: 3, perception: 2 } } } }
    } },
    events: { async insertOne(event) { saved = event } },
  })
  const input = { agent: agentId, group: 'attack', key: 'fight' }
  assert.equal((await request(db, `campaigns/${recordId}/rolls`, 'POST', input)).statusCode, 403)
  owner = user
  assert.equal((await request(db, `campaigns/${recordId}/rolls`, 'POST', { ...input, key: 'perception' })).statusCode, 422)
  const result = await request(db, `campaigns/${recordId}/rolls`, 'POST', input)
  assert.equal(result.statusCode, 201)
  assert.ok(saved.die >= 1 && saved.die <= 20)
  assert.equal(saved.bonus, 3)
  assert.equal(saved.total, saved.die + 3)
  assert.equal(saved.by, user)
})

test('apenas o mestre gera convites e os códigos são gravados como hash', async () => {
  let owner = other, updated
  const db = database({ records: {
    async findOne() { return { owner } },
    async updateOne(filter, update) { updated = { filter, update }; return { matchedCount: 1 } },
  } })
  assert.equal((await request(db, `campaigns/${recordId}/invites`, 'POST')).statusCode, 403)
  owner = user
  const invited = await request(db, `campaigns/${recordId}/invites`, 'POST')
  assert.equal(invited.statusCode, 201)
  assert.equal(updated.update.$set.inviteHash, digest(invited.body.code))
  const joined = await request(db, `campaigns/${recordId}/join`, 'POST', { code: invited.body.code })
  assert.equal(joined.statusCode, 204)
  assert.equal(updated.filter.inviteHash, digest(invited.body.code))
  assert.ok(updated.filter.inviteExpires.$gt instanceof Date)
  assert.deepEqual(updated.update, { $addToSet: { members: user } })
})

test('combates exigem o mestre e preservam uma cópia das ameaças da campanha', async () => {
  let owner = other, saved
  const sheet = { caractheristics: { name: 'Ameaça' } }
  const db = database({
    records: {
      async findOne() { return { owner, data: { enemies: [agentId] } } },
      find(filter) {
        assert.deepEqual(filter, { kind: 'threats', _id: { $in: [agentId] } })
        return { async toArray() { return [{ _id: agentId, data: sheet }] } }
      },
    },
    events: { async insertOne(event) { saved = event } },
  })
  const input = { name: 'Encontro', threats: [agentId] }
  assert.equal((await request(db, `campaigns/${recordId}/combats`, 'POST', input)).statusCode, 403)
  owner = user
  assert.equal((await request(db, `campaigns/${recordId}/combats`, 'POST', { ...input, threats: [other] })).statusCode, 422)
  const result = await request(db, `campaigns/${recordId}/combats`, 'POST', input)
  assert.equal(result.statusCode, 201)
  assert.equal(saved.type, 'combats')
  assert.deepEqual(saved.threats, [{ id: agentId, sheet }])
})
