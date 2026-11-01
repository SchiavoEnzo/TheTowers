import {ZodError} from 'zod';
import {database} from '../../lib/db.js';
import {actor,authentication} from '../../lib/auth.js';
import {game} from '../../lib/game.js';
export const config={api:{bodyParser:{sizeLimit:'128kb'}}};
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const parts=req.query.path;
    const db=await database();
    if(parts[0]==='auth'||parts[0]==='profile') return await authentication(db,req,res,parts.join('/'));
    const {user}=await actor(db,req);
    return await game(db,user,parts,req,res);
  }catch(e){
    if(e instanceof ZodError) return res.status(422).json({error:'Dados inválidos',fields:e.issues.map(i=>({path:i.path,message:i.message}))});
    if(e.code===11000) return res.status(409).json({error:'Registro já existe'});
    if(e.status) return res.status(e.status).json({error:e.message});
    console.error('Falha na API:',e.name);
    return res.status(503).json({error:'Serviço indisponível'});
  }
}
