import { z } from 'zod';

const obj = fields => z.object(fields).strict();
export const str = z.string().trim().min(1).max(8192);
const num = z.number().finite();
const optional = str.optional();
const numbers = names => Object.fromEntries(names.split(' ').map(name => [name, num]));
export const id = z.string().regex(/^[a-f0-9]{24}$/);
const ids = z.array(id).max(500).refine(a => new Set(a).size === a.length, 'IDs repetidos');
const extras = z.record(z.unknown()).default({});
const timestamp = z.string().datetime({offset:true}).transform(s => new Date(s));
const interval = x => !x.end || x.end >= x.start;
const description = {name:str, desc:str};
const identity = {name:str, age:str, formation:str, origin:optional, personality:optional, history:optional};
export const skillNames = 'acrobacy art currents training atlethics science crime diplomacy decieving fortitude furtivity initiative intimidating intuition fight medicine ocultism misticism perception piloting profession acuracy reflex religion surviving tatics technology force';
const being = obj({
  caractheristics:obj({...identity, 'player-name':str, wishes:optional}),
  atributes:obj({...numbers('level dp sanity pv shield ammo'), pary:num.optional(), dodge:num.optional()}),
  habilities:obj({
    naturals:obj(numbers('inteligence wisdom existance')),
    main:obj(numbers('intelect strengh agility charisma willing')),
    lasts:obj(numbers(skillNames)),
    'atained-objects':ids.default([]), money:ids.default([]), extras
  })
});
export const schemas = {
  beings:being,
  agents:being.extend({class:optional, rank:optional}),
  threats:being.extend({element:optional, vd:num.nonnegative().optional(), size:optional, species:optional}),
  objects:obj({
    caractheristics:obj({...identity, desc:str}),
    atributes:obj({level:num.optional(), dp:num.optional(), sanity:num.optional(), pv:num.optional(), status:str,
      damage:obj({physical:num.optional(), mental:num.optional(), ethereal:num.optional(), type:optional, desc:optional}).optional(),
      benefits:obj({desc:str,status:str})})
  }),
  money:obj({name:optional,desc:optional}),
  locals:obj(description),
  dates:obj({name:optional,desc:optional,start:timestamp,end:timestamp.optional()}).refine(interval,'Fim anterior ao início'),
  campaigns:obj({...description,start:timestamp,end:timestamp,
    dificulty:obj({level:num,'rolling-minimum-level':num,'rolling-level-cap':num.optional()})
      .refine(x => x['rolling-level-cap'] === undefined || x['rolling-level-cap'] >= x['rolling-minimum-level'],'Teto abaixo do mínimo'),
    users:ids,enemies:ids,allies:ids.default([]),locals:ids,dates:ids.default([]),extras
  }).refine(interval,'Fim anterior ao início'),
  homebrews:obj({...description,category:z.enum(['threat','ability','ritual','item']),extras}),
};
export const profile = obj({name:str.max(100).optional(), image:z.string().url().startsWith('https://').max(2048).nullable().optional()});
export const credentials = obj({email:z.string().trim().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(10).max(128)});
export const combat = obj({name:str, threats:ids});
export const joinedAgent = obj({agent:id});
export const roll = obj({agent:id, group:z.enum(['naturals','main','lasts','attack']), key:str.max(60)});
