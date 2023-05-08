const express = require('express');
const utils = require('./utils');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const Human = utils.getGenomeFile('Human');

// GET endpoint
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// POST endpoint
app.post('/process-data', async (req, res) => {
  console.log('Received data:', req.body.data);
  let processedData;
  if (req.body.data == 'Human') {
    processedData = await Human;
  } else {
    processedData = await utils.getGenomeFile(req.body.data);
  }

  // Send the processed data back as a response
  res.json({ data: processedData });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
