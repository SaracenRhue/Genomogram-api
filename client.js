const fs = require('fs/promises');


const SERVER = 'https://genomogram-api-production.up.railway.app';
const GENOME = 'Human';
const PATH = './';

async function getData(genome, SERVER) {
  const startTime = Date.now();
  const dataToSend = genome;

  const response = await fetch(`${SERVER}/process-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: dataToSend }),
  });
  // console.log(await response.text());
  const processedData = await response.json();
  const endTime = Date.now();
  console.log(`Time taken: ${Math.floor((endTime - startTime) / 1000)}s`);
  return processedData;
}


getData(GENOME, SERVER)
  .then((response) => {
    const data = response.data;
    if (data) {
      return fs.writeFile(`${PATH}${GENOME.toLowerCase()}.json`,JSON.stringify(data, null));
    } else {
      throw new Error('No data received from the server');
    }
  })
  .then(() => console.log(`Data written to ${GENOME.toLowerCase()}.json`))
  .catch((error) => console.error('Error:', error));
