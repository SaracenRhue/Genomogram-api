const express = require('express');
const utils = require('./utils');
const app = express();
const port = process.env.PORT || 3000;

// This middleware is necessary to parse JSON request bodies
app.use(express.json());

// Example GET endpoint
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Example POST endpoint
app.post('/process-data', async (req, res) => {
  console.log('Received data:', req.body.data);

  // Process the received data
  const processedData = await utils.getGenomeFile(req.body.data);

  // Send the processed data back as a response
  res.json({ data: processedData });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
