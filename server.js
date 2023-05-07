const express = require('express');
const utils = require('./utils');
const app = express();
const fs = require('fs/promises');
const port = process.env.PORT || 3000;

app.use(express.json());

const CACHE = ['Human'];

(async () => {
  for (const item of CACHE) {
    try {
      const data = await utils.getGenomeFile(item);
      await fs.writeFile(`cache/${item.toLocaleLowerCase()}.json`,JSON.stringify(data, null, 2));
      console.log(`Cache file for ${item} created.`);
    } catch (error) {
      console.error(`Error creating cache file for ${item}:`, error);
    }
  }
})();


// GET endpoint
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// POST endpoint
app.post('/process-data', async (req, res) => {
  console.log('Received data:', req.body.data);
  const received = req.body.data;
  const fileName = `cache/${received.toLocaleLowerCase()}.json`;
  let processedData = {};
  if (utils.fileExists(fileName)) {
    processedData = await fs.readFile(fileName);
    processedData = await JSON.parse(processedData);
    console.log('File exists');
    if (utils.getFileAge(fileName) > 30) {
      processedData = await utils.getGenomeFile(received);
      processedData = await JSON.parse(processedData);
      console.log('File is older than 30 days');
    } else {
      processedData = await fs.readFile(fileName);
      processedData = await JSON.parse(processedData);
      console.log('File is younger than 30 days');
    }
  } else {
    processedData = await utils.getGenomeFile(received);
    fs.writeFile(fileName, JSON.stringify(processedData, null, 2))
  }

  // Send the processed data back as a response
  res.json({ data: processedData });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
