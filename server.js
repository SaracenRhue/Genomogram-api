const express = require('express');
const utils = require('./utils');
const app = express();
const fs = require('fs/promises');
const port = process.env.PORT || 3000;

app.use(express.json());

CACHE = ['Human', 'Hedgehog'];
CACHE.forEach((item) => {
  const data = utils.getGenomeFile(item);
  fs.writeFile(
    `cache/${item.toLocaleLowerCase()}.json`,
    JSON.stringify(data, null, 2)
  );
});

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
    if (utils.getFileAge(fileName) < 30) {
      processedData = await utils.getGenomeFile(received);
    } else {
      processedData = fs.readFile(fileName);
    }
  } else {
    processedData = await utils.getGenomeFile(received);
    fs.writeFile(`cache/${item.toLocaleLowerCase()}.json`,JSON.stringify(processedData, null, 2))
  }

  // Send the processed data back as a response
  res.json({ data: processedData });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
