import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { schemas, profile } from '../models/index.js'
import { extras, ids } from '../models/shared.js'
const agent=JSON.parse(readFileSync(new URL('../examples/agent.json',import.meta.url)));
test('extras preservam valores heterogêneos e usam objeto vazio por padrão', () => {
  const input = { text: 'ritual', count: 2, enabled: true, nested: { tags: ['a'] }, empty: null }
  assert.deepEqual(extras.parse(input), input)
  assert.deepEqual(extras.parse(undefined), {})
  assert.equal(extras.safeParse([]).success, false)
})
test('referências rejeitam coleções excessivas e IDs repetidos', () => {
  const input = Array.from({ length: 501 }, (_, i) => i.toString(16).padStart(24, '0'))
  assert.equal(ids.safeParse(input.slice(0, 500)).success, true)
  assert.equal(ids.safeParse(input).success, false)
  assert.equal(ids.safeParse([input[0], input[0]]).success, false)
})
test('agente e ameaça preservam todos os campos de being',()=>{
  const {class:role,...being}=agent;
  assert.deepEqual(schemas.beings.parse(being),being);
  assert.equal(schemas.agents.parse(agent).class,role);
  assert.equal(schemas.threats.parse({...being,vd:80}).vd,80);
  for(const schema of [schemas.beings,schemas.agents,schemas.threats]){
    const copy=structuredClone(being);delete copy.caractheristics['player-name'];
    assert.equal(schema.safeParse(copy).success,false);
  }
});
test('ordem das datas e limites de dificuldade',()=>{
  const data={name:'Torre',desc:'Missão',start:'2026-01-01T00:00:00Z',end:'2026-01-02T00:00:00Z',users:[],enemies:[],locals:[],dificulty:{level:1,'rolling-minimum-level':5}};
  assert.ok(schemas.campaigns.safeParse(data).success);
  assert.ok(!schemas.campaigns.safeParse({...data,end:'2025-01-01T00:00:00Z'}).success);
  assert.ok(!schemas.campaigns.safeParse({...data,dificulty:{...data.dificulty,'rolling-level-cap':3}}).success);
});
test('perfil aceita URL HTTPS e rejeita campos de conta',()=>{
  assert.ok(profile.safeParse({name:'Vigia',image:'https://example.org/avatar.png'}).success);
  assert.ok(!profile.safeParse({owner:'outro'}).success);
});
