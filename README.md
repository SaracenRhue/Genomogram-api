# Genomegram API

```js
const fs = require('fs/promises');

const SERVER = 'http://genomogram.richard-kammermeier.ch';
// const SERVER = 'http://tower:2023';
// const SERVER = 'http://localhost:3000';
const GENOME = 'Human';
PATH = './';

async function getGenomeData(genome, SERVER) {
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


getGenomeData(GENOME, SERVER)
  .then((response) => {
    const data = response.data;
    if (data) {
      fs.writeFile(
        `${PATH}${GENOME.toLocaleLowerCase()}.json`,
        JSON.stringify(data, null, 2)
      )
        .then(() => {
          console.log(`Data written to ${GENOME.toLocaleLowerCase()}.json`);
        })
        .catch((error) => {
          console.error('Error writing data to file:', error);
        });
    } else {
      console.error('No data received from the server');
    }
  })
  .catch((error) => {
    console.error('Error getting genome data:', error);
  });
```
