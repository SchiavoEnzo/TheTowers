import {randomBytes, createHash, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {credentials,profile} from './schema.js';
const derive=promisify(scrypt);
export const token=()=>randomBytes(32).toString('hex');
export const digest=s=>createHash('sha256').update(s).digest('hex');
export function fail(status,message){throw Object.assign(new Error(message),{status})}
export async function actor(db,req){
  const raw=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if(!raw) fail(401,'Token obrigatório');
  const session=await db.collection('sessions').findOne({_id:digest(raw),expires:{$gt:new Date()}});
  if(!session) fail(401,'Sessão inválida');
  return session;
}
export async function authentication(db,req,res,path){
  const accounts=db.collection('accounts'), sessions=db.collection('sessions');
  if(['auth/register','auth/login'].includes(path) && req.method==='POST'){
    const {email,password}=credentials.parse(req.body);
    if(path==='auth/register'){
      const salt=token();
      const hash=(await derive(password,salt,64)).toString('hex');
      const result=await accounts.insertOne({email,salt,hash,profile:{name:null,image:null}});
      return res.status(201).json({id:result.insertedId,email,profile:{name:null,image:null}});
    }
    const account=await accounts.findOne({email});
    const actual=await derive(password,account?.salt ?? 'missing-account',64);
    if(!account || !timingSafeEqual(Buffer.from(account.hash,'hex'),actual)) fail(401,'Credenciais inválidas');
    const raw=token(),expires=new Date(Date.now()+86400000);
    await sessions.insertOne({_id:digest(raw),user:account._id.toString(),expires});
    return res.json({token:raw,expires});
  }
  const session=await actor(db,req);
  if(path==='auth/logout' && req.method==='POST'){
    await sessions.deleteOne({_id:session._id});return res.status(204).end();
  }
  if(path==='profile' && ['GET','PATCH'].includes(req.method)){
    const {ObjectId}=await import('mongodb');
    const filter={_id:new ObjectId(session.user)};
    if(req.method==='PATCH'){
      const update=Object.entries(profile.parse(req.body));
      if(!update.length) fail(422,'Perfil vazio');
      await accounts.updateOne(filter,{$set:Object.fromEntries(update.map(([k,v])=>['profile.'+k,v]))});
    }
    return res.json(await accounts.findOne(filter,{projection:{email:1,profile:1}}));
  }
  fail(405,'Método indisponível');
}
