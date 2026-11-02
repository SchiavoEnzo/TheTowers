import auth from './auth.routes.js'
import profile from './profile.routes.js'
import beings from './being.routes.js'
import agents from './agent.routes.js'
import threats from './threat.routes.js'
import objects from './object.routes.js'
import money from './money.routes.js'
import locals from './local.routes.js'
import dates from './date.routes.js'
import campaigns from './campaign.routes.js'
import homebrews from './homebrew.routes.js'
import { id } from '../models/shared.js'
import { actor } from '../services/auth.service.js'
import { fail } from '../utils/errors.js'

export const routes = {
  auth, profile, beings, agents, threats, objects, money, locals, dates, campaigns, homebrews,
}

export async function dispatch(db, parts, req, res, session) {
  if (!Array.isArray(parts) || !parts.length || !Object.hasOwn(routes, parts[0]))
    fail(404, 'Rota inexistente')
  const [resource, ...segments] = parts
  const matches = routes[resource].filter((route) =>
    route.path.length === segments.length && route.path.every(
      (part, index) => part === ':id' || part === segments[index],
    ),
  )
  if (!matches.length) fail(404, 'Rota inexistente')
  const route = matches.find(({ method }) => method === req.method)
  if (!route) {
    res.setHeader('Allow', [...new Set(matches.map(({ method }) => method))].join(', '))
    fail(405, 'Método indisponível')
  }
  const authenticated = route.public ? null : session ?? await actor(db, req)
  const params = {}
  route.path.forEach((part, index) => {
    if (part === ':id') params.id = id.parse(segments[index])
  })
  return route.handler({ db, req, res, params, session: authenticated, user: authenticated?.user })
}
