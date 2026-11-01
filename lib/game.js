import {ObjectId} from 'mongodb';
import {randomInt} from 'node:crypto';
import {z} from 'zod';
import {schemas,id,combat,joinedAgent,roll} from './schema.js';
import {fail,token,digest} from './auth.js';

const newId=()=>new ObjectId().toString();
const member=user=>({$or:[{owner:user},{members:user}]});
const visible=doc=>{
  const {inviteHash,...safe}=doc;
  return safe;
};
function references(kind,data){
  if(data.habilities) return {objects:data.habilities['atained-objects'],money:data.habilities.money};
  if(kind==='campaigns') return {agents:data.users,threats:data.enemies,beings:data.allies,locals:data.locals,dates:data.dates};
  return {};
}
async function validateRefs(records,kind,data,user,previous,session){
  for(const [target,ids] of Object.entries(references(kind,data))){
    for(const ref of ids){
      const query={_id:ref,kind:target};
      // Existing player-owned agents can stay on the roster when the GM edits the campaign.
      if(target!=='agents' || !previous?.data.users.includes(ref)) query.owner=user;
      const result=await records.updateOne(query,{$inc:{refRevision:1}},{session});
      if(!result.matchedCount) fail(422,'Referência inexistente ou inacessível: '+target);
    }
  }
}
async function campaignAction(db,user,cid,action,req,res){
  const records=db.collection('records'),events=db.collection('events');
  const filter={_id:cid,kind:'campaigns'};
  if(action==='join' && req.method==='POST'){
    const code=z.string().regex(/^[a-f0-9]{64}$/).parse(req.body?.code);
    const result=await records.updateOne({...filter,inviteHash:digest(code),inviteExpires:{$gt:new Date()}},{$addToSet:{members:user}});
    if(!result.matchedCount) fail(404,'Convite inválido ou expirado');
    return res.status(204).end();
  }
  const campaign=await records.findOne({...filter,...member(user)});
  if(!campaign) fail(404,'Campanha indisponível');
  const gm=campaign.owner===user;
  if(action==='shield' && req.method==='GET'){
    if(!gm) fail(403,'Apenas o mestre pode consultar o escudo');
    const [agents, rolls, combats]=await Promise.all([
      records.find({kind:'agents',_id:{$in:campaign.data.users}}).toArray(),
      events.find({campaign:cid,type:'rolls'}).sort({_id:-1}).limit(30).toArray(),
      events.find({campaign:cid,type:'combats'}).sort({_id:-1}).limit(10).toArray()
    ]);
    return res.json({campaign:visible(campaign),agents,rolls,combats});
  }
  if(action==='invites' && req.method==='POST'){
    if(!gm) fail(403,'Apenas o mestre pode convidar');
    const code=token(),expires=new Date(Date.now()+86400000);
    await records.updateOne(filter,{$set:{inviteHash:digest(code),inviteExpires:expires}});
    return res.status(201).json({code,expires,campaign:cid});
  }
  if(action==='agents' && req.method==='POST'){
    const {agent}=joinedAgent.parse(req.body);
    await db.client.withSession(s=>s.withTransaction(async()=>{
      await validateRefs(records,'campaigns',{users:[agent],enemies:[],allies:[],locals:[],dates:[]},user,null,s);
      await records.updateOne({...filter,...member(user)},{$addToSet:{'data.users':agent}},{session:s});
    }));
    return res.status(204).end();
  }
  if(['rolls','combats'].includes(action) && req.method==='GET'){
    return res.json(await events.find({campaign:cid,type:action}).sort({_id:-1}).limit(100).toArray());
  }
  if(action==='combats' && req.method==='POST'){
    if(!gm) fail(403,'Apenas o mestre pode criar combates');
    const input=combat.parse(req.body);
    if(!input.threats.every(t=>campaign.data.enemies.includes(t))) fail(422,'Selecione ameaças da campanha');
    const foes=await records.find({kind:'threats',_id:{$in:input.threats}}).toArray();
    if(foes.length!==input.threats.length) fail(409,'Ameaça indisponível');
    const event={_id:newId(),campaign:cid,type:action,name:input.name,created:new Date(),threats:foes.map(t=>({id:t._id,sheet:t.data}))};
    await events.insertOne(event); return res.status(201).json(event);
  }
  if(action==='rolls' && req.method==='POST'){
    const input=roll.parse(req.body);
    if(!campaign.data.users.includes(input.agent)) fail(422,'Agente fora da campanha');
    const agent=await records.findOne({_id:input.agent,kind:'agents'});
    if(!agent || (!gm && agent.owner!==user)) fail(403,'Sem acesso à rolagem');
    const group=input.group==='attack'?'lasts':input.group;
    if(input.group==='attack' && !['fight','acuracy'].includes(input.key)) fail(422,'Ataque usa fight ou acuracy');
    const values=agent.data.habilities[group];
    if(!Object.hasOwn(values,input.key)) fail(422,'Habilidade inválida');
    const die=randomInt(1,21),bonus=values[input.key];
    const event={_id:newId(),campaign:cid,type:action,...input,die,bonus,total:die+bonus,by:user,created:new Date()};
    await events.insertOne(event);return res.status(201).json(event);
  }
  fail(405,'Ação ou método indisponível');
}
export async function game(db,user,parts,req,res){
  const [kind,raw,action]=parts;
  if(!Object.hasOwn(schemas,kind) || parts.length>3) fail(404,'Rota inexistente');
  const key=raw && id.parse(raw);
  if(action && kind==='campaigns') return campaignAction(db,user,key,action,req,res);
  if(action) fail(404,'Ação inexistente');
  const records=db.collection('records');
  const own={kind,owner:user};
  const access=kind==='campaigns'?{kind,...member(user)}:own;
  if(req.method==='GET'){
    if(key){
      let doc=await records.findOne({...access,_id:key});
      if(!doc && kind==='agents' && await records.findOne({kind:'campaigns','data.users':key,...member(user)}))
        doc=await records.findOne({kind,_id:key});
      if(!doc) fail(404,'Registro indisponível');
      return res.json(visible(doc));
    }
    const query={...access};
    if(req.query.q){
      const q=z.string().max(100).parse(req.query.q);
      const escaped=Array.from(q).map(c=>'.*+?^${}()|[]\\'.includes(c)?'\\'+c:c).join('');
      query[['agents','beings','objects','threats'].includes(kind)?'data.caractheristics.name':'data.name']={$regex:escaped,$options:'i'};
    }
    if(kind==='threats' && req.query.element) query['data.element']=z.string().parse(req.query.element);
    if(kind==='homebrews' && req.query.category) query['data.category']=z.string().parse(req.query.category);
    if(req.query.before) query._id={$lt:id.parse(req.query.before)};
    return res.json((await records.find(query).sort({_id:-1}).limit(100).toArray()).map(visible));
  }
  if((req.method==='POST' && !key)||(req.method==='PUT' && key)){
    const data=schemas[kind].parse(req.body);
    const result=await db.client.withSession(s=>s.withTransaction(async()=>{
      const previous=key && await records.findOne({...own,_id:key},{session:s});
      if(key && !previous) fail(404,'Registro indisponível');
      await validateRefs(records,kind,data,user,previous,s);
      if(key){
        await records.updateOne({...own,_id:key},{$set:{data}},{session:s});
        return {_id:key,data};
      }
      const doc={_id:newId(),...own,data};
      if(kind==='campaigns') doc.members=[];
      await records.insertOne(doc,{session:s});return doc;
    }));
    return res.status(key?200:201).json(result);
  }
  if(req.method==='DELETE' && key){
    await db.client.withSession(s=>s.withTransaction(async()=>{
      const doc=await records.findOne({...own,_id:key},{session:s});
      if(!doc) fail(404,'Registro indisponível');
      const paths=['users','allies','enemies','dates','locals','habilities.atained-objects','habilities.money'];
      if(await records.findOne({$or:paths.map(p=>({['data.'+p]:key}))},{session:s})) fail(409,'Remova primeiro os vínculos deste registro');
      if(kind==='campaigns') await db.collection('events').deleteMany({campaign:key},{session:s});
      await records.deleteOne({...own,_id:key},{session:s});
    }));
    return res.status(204).end();
  }
  fail(405,'Método indisponível');
}
