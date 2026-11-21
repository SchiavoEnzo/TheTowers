import { readFile } from 'node:fs/promises'
import { MongoClient } from 'mongodb'
import { schemas } from '../models/index.js'
import { credentials } from '../models/account.model.js'
import { createIndexes } from '../database/indexes.js'
import { token, digest, hashPassword, verifyPassword } from '../utils/crypto.js'

const accountInput = credentials.parse({
  email: 'demo@astorres.example',
  password: 'Torres!Demo2026',
})
const template = JSON.parse(await readFile(new URL('../examples/agent.json', import.meta.url)))
function character(name, formation, pv, extra) {
  const data = structuredClone(template)
  delete data.class
  Object.assign(data.caractheristics, { name, formation, 'player-name': 'Demonstração' })
  Object.assign(data.atributes, { pv, 'current-pv': pv, dp: 10, 'current-dp': 10 })
  return { ...data, ...extra }
}

const examples = [
  ['agents', 'clara', character('Clara Monteiro', 'Investigação paranormal', 24, { class: 'Investigadora', rank: 'Recruta' })],
  ['agents', 'rafael', character('Rafael Nogueira', 'Medicina de campo', 28, { class: 'Médico', rank: 'Recruta' })],
  ['agents', 'helena', character('Helena Duarte', 'Estudos ocultos', 20, { class: 'Ocultista', rank: 'Recruta' })],
  ['threats', 'vigia', character('Vigia das Ruínas', 'Guardião das torres abandonadas', 45, { element: 'Medo', vd: 20, size: 'Médio', species: 'Espectro' })],
  ['threats', 'devorador', character('Devorador de Ecos', 'Predador atraído por vozes', 60, { element: 'Sangue', vd: 40, size: 'Grande', species: 'Aberração' })],
  ['homebrews', 'lanterna', {
    name: 'Lanterna dos Ecos',
    desc: 'Item de exemplo: uma lanterna que revela rastros sobrenaturais por uma cena. Uma vez por sessão, concede +2 em um teste de investigação relacionado a esses rastros, a critério do mestre.',
    category: 'item',
    extras: { activation: 'Uma ação', duration: 'Uma cena', uses: 'Uma vez por sessão' },
  }],
].map(([kind, key, data]) => ({ kind, key, data: schemas[kind].parse(data) }))

if (process.argv.includes('--validate')) {
  console.log(`Validação concluída: conta e ${examples.length} exemplos válidos.`)
} else {
  if (!process.env.MONGODB_URI || !process.env.MONGODB_DB) throw new Error('Configure MONGODB_URI e MONGODB_DB em .env.local')
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  try {
    await client.connect()
    const db = client.db(process.env.MONGODB_DB)
    await createIndexes(db)
    const salt = token()
    const hash = await hashPassword(accountInput.password, salt)
    await client.withSession((session) => session.withTransaction(async () => {
      const accounts = db.collection('accounts')
      let account = await accounts.findOne({ email: accountInput.email }, { session })
      if (account && !(await verifyPassword(accountInput.password, account))) {
        throw new Error('O email de demonstração já existe com outra senha; nenhuma conta será sobrescrita.')
      }
      if (!account) {
        const result = await accounts.insertOne({ email: accountInput.email, salt, hash, profile: { name: 'Explorador de exemplo', image: null } }, { session })
        account = { _id: result.insertedId }
      }
      const owner = account._id.toString()
      for (const { kind, key, data } of examples) {
        const _id = digest(`demo-v1:${owner}:${kind}:${key}`).slice(0, 24)
        await db.collection('records').updateOne(
          { _id, owner, kind },
          { $setOnInsert: { data } },
          { upsert: true, session },
        )
      }
    }))
    console.log('Demonstração disponível: 3 personagens, 2 ameaças e 1 homebrew.')
    console.log(`Email: ${accountInput.email}\nSenha: ${accountInput.password}`)
  } finally {
    await client.close()
  }
}
