import { ObjectId } from 'mongodb'
import { profile } from '../models/profile.model.js'
import { fail } from '../utils/errors.js'

export async function getProfile(db, user) {
  return db.collection('accounts').findOne(
    { _id: new ObjectId(user) },
    { projection: { email: 1, profile: 1 } },
  )
}

export async function updateProfile(db, user, input) {
  const update = Object.entries(profile.parse(input))
  if (!update.length) fail(422, 'Perfil vazio')
  await db.collection('accounts').updateOne(
    { _id: new ObjectId(user) },
    { $set: Object.fromEntries(update.map(([key, value]) => ['profile.' + key, value])) },
  )
  return getProfile(db, user)
}
