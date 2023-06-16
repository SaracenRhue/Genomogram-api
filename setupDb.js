const { MongoClient } = require('mongodb');

const dbAdress = 'mongodb://192.168.178.132:27017';

async function main() {

    const client = new MongoClient(dbAdress);

  try {
    // Connect to the MongoDB cluster
    await client.connect();

    // Select the "admin" database
    const database = client.db('admin');

    // Create a new collection called "users"
    const users = database.collection('users');

    // If you want to insert a document into "users" collection
    let user = { name: 'Johann', points: '420'};
    let result = await users.insertOne(user);
    console.log(`User inserted with the following id: ${result.insertedId}`);
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

main().catch(console.error);