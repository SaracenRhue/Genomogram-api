const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://genomogram:6mwpnrpSBJ7Z9wmM@genomogram.bnmp3cf.mongodb.net/?retryWrites=true&w=majority';

async function main() {

    const client = new MongoClient(uri);

  try {
    // Connect to the MongoDB cluster
    await client.connect();

    // Select the "admin" database
    const database = client.db('Genomogram');

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