import { MongoClient } from 'mongodb';
export async function database() {
  if (!process.env.MONGODB_URI || !process.env.MONGODB_DB) throw new Error('Configure MongoDB');
  if (!globalThis.torresConnection) {
    const client = new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:6000});
    globalThis.torresConnection = (async () => {
      await client.connect();
      const db = client.db(process.env.MONGODB_DB);
      await Promise.all([
        db.collection('accounts').createIndex({email:1},{unique:true}),
        db.collection('sessions').createIndex({expires:1},{expireAfterSeconds:0}),
        db.collection('events').createIndex({campaign:1,_id:-1}),
        db.collection('records').createIndex({kind:1,owner:1})
      ]);
      return db;
    })().catch(async e=>{delete globalThis.torresConnection; await client.close(); throw e});
  }
  return globalThis.torresConnection;
}
