import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {schemas,profile} from '../lib/schema.js';
const agent=JSON.parse(readFileSync(new URL('../examples/agent.json',import.meta.url)));
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
