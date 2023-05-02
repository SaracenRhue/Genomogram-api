# Genomegram API

```js
const fs = require('fs/promises');

async function getData(genome) {
  const dataToSend = genome;

  const response = await fetch('http://localhost:3000/process-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: dataToSend }),
  });

  const processedData = await response.json();
  return processedData;
}

const GENOME = 'Human'
getData(GENOME)
  .then((response) => {
    console.log('Received data:', response);

    const data = response.data;

    if (data) {
      // Write the value of the 'data' key to a JSON file
      fs.writeFile(`data/${GENOME.toLocaleLowerCase()}.json`, JSON.stringify(data, null, 2))
        .then(() => {
          console.log(
            `Data written to data/${GENOME.toLocaleLowerCase()}.json`
          );
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