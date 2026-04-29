import { MongoClient, type Db } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is not set')
  }
}

const dbName = process.env.MONGODB_DB || 'claudewall'

let clientPromise: Promise<MongoClient>

const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> }

if (process.env.NODE_ENV === 'development') {
  if (!globalForMongo._mongoClient && uri) {
    globalForMongo._mongoClient = new MongoClient(uri).connect()
  }
  clientPromise = globalForMongo._mongoClient as Promise<MongoClient>
} else {
  clientPromise = uri
    ? new MongoClient(uri).connect()
    : (Promise.reject(new Error('MONGODB_URI is not set')) as Promise<MongoClient>)
}

export default clientPromise

export async function db(): Promise<Db> {
  const client = await clientPromise
  return client.db(dbName)
}
