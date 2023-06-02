const express = require('express');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql');
const cors = require('cors');
const os = require('os');
const disk = require('diskusage');
const { execSync } = require('child_process');
const logFile = path.join(__dirname, 'access.log');

const app = express();
app.set('trust proxy', true); // if behind a proxy like Nginx, set true
app.use(cors());

var accessLogStream = fs.createWriteStream(logFile, { flags: 'a' });
app.use(
  morgan(
    (tokens, req, res) =>
      [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens.res(req, res, 'content-length'),
        '-',
        tokens['response-time'](req, res),
        'ms',
        req.ip, // logging IP address
      ].join(' '),
    { stream: accessLogStream }
  )
);

// Set up rate limiter: maximum of 1000 requests per minute per IP
var limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000,
});

// Apply the rate limit to all requests
app.use(limiter);

function connectToDB(db = 'hgcentral') {
  // Connect to the MySQL server and return a connection object
  const connection = mysql.createConnection({
    host: 'genome-euro-mysql.soe.ucsc.edu',
    port: 3306,
    user: 'genome',
    database: db,
  });

  return connection;
}
// Rotating logs
function truncateLog(maxLines) {
  fs.readFile(logFile, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }

    let lines = data.split('\n');
    if (lines.length > maxLines) {
      lines = lines.slice(lines.length - maxLines);
      fs.writeFile(logFile, lines.join('\n'), 'utf8', (err) => {
        if (err) console.error(err);
      });
    }
  });
}

setInterval(() => truncateLog(5000), 24 * 60 * 60 * 1000); // Keeps last 5000 lines and runs every 24 hours

function formatBytes(bytes) {
  if (bytes < 1024) return bytes.toFixed(3) + ' Bytes';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(3) + ' KB';
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(3) + ' MB';
  return (bytes / 1073741824).toFixed(3) + ' GB';
}

function formatUptime(seconds) {
  function pad(s) {
    return (s < 10 ? '0' : '') + s;
  }
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  return `${pad(days)} Days ${pad(hours)} Hours ${pad(minutes)} Minutes ${pad(
    secs
  )} Seconds`;
}


// http://localhost:3000/species
app.get('/species', (req, res) => {
  const page = req.query.page ? parseInt(req.query.page) : 1; // default page is 1
  let pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 100; // default page size is 100
  pageSize = Math.min(pageSize, 100); // max page size is 100
  const offset = (page - 1) * pageSize;

  const nameFilter = req.query.name ? req.query.name : null;
  const dbFilter = req.query.db ? req.query.db : null;

  let sqlQuery = `
        SELECT 
            a.genome AS name, a.name AS db
        FROM
            hgcentral.dbDb AS a
            JOIN
            information_schema.tables AS b ON b.table_schema = a.name
        AND b.table_name = 'ncbiRefSeq'`;

  let sqlParams = [];

  if (nameFilter || dbFilter) {
    sqlQuery += ` WHERE `;
    if (nameFilter && dbFilter) {
      sqlQuery += `a.genome = ? AND a.name = ?`;
      sqlParams.push(nameFilter, dbFilter);
    } else if (nameFilter) {
      sqlQuery += `a.genome = ?`;
      sqlParams.push(nameFilter);
    } else if (dbFilter) {
      sqlQuery += `a.name = ?`;
      sqlParams.push(dbFilter);
    }
  }

  sqlQuery += ` LIMIT ?, ?;`;
  sqlParams.push(offset, pageSize);

  const connection = connectToDB();
  connection.query(sqlQuery, sqlParams, (err, result) => {
    connection.end();
    if (err) {
      console.error(err);
    }
    res.json(result);
  });
});

// http://localhost:3000/species/hg38/genes?page=2&pageSize=20
app.get('/species/:species/genes', (req, res) => {
  const { species } = req.params;
  const page = req.query.page ? parseInt(req.query.page) : 1; // default page is 1
  let pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 100; // default page size is 100
  pageSize = Math.min(pageSize, 100); // max page size is 100
  const offset = (page - 1) * pageSize;

  const nameFilter = req.query.name ? req.query.name : null;
  const variantCountFilter = req.query.variantCount
    ? parseInt(req.query.variantCount)
    : null;

  let sqlQuery = `SELECT * FROM (
    SELECT name2 AS name, count(*) AS variantCount 
    FROM ncbiRefSeq 
    GROUP BY name2
  ) AS subQuery`;

  let sqlParams = [];

  if (nameFilter || variantCountFilter) {
    sqlQuery += ` WHERE `;
    if (nameFilter && variantCountFilter) {
      sqlQuery += `name = ? AND variantCount = ?`;
      sqlParams.push(nameFilter, variantCountFilter);
    } else if (nameFilter) {
      sqlQuery += `name = ?`;
      sqlParams.push(nameFilter);
    } else if (variantCountFilter) {
      sqlQuery += `variantCount = ?`;
      sqlParams.push(variantCountFilter);
    }
  }

  sqlQuery += ` LIMIT ?, ?;`;
  sqlParams.push(offset, pageSize);

  const connection = connectToDB(species);
  connection.query(sqlQuery, sqlParams, (err, result) => {
    connection.end();
    if (err) {
      console.error(err);
    }
    res.json(result);
  });
});

// http://localhost:3000/species/hg38/genes/ACMSD/variants
app.get('/species/:species/genes/:gene/variants', (req, res) => {
  const { species, gene } = req.params;
  const page = req.query.page ? parseInt(req.query.page) : 1; // default page is 1
  let pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 100; // default page size is 100
  pageSize = Math.min(pageSize, 100); // max page size is 100
  const offset = (page - 1) * pageSize;

  const nameFilter = req.query.name ? req.query.name : null;
  const exonCountFilter = req.query.exonCount
    ? parseInt(req.query.exonCount)
    : null;

  let sqlQuery = `SELECT name, txStart, txEnd, exonCount, exonStarts, exonEnds 
                  FROM ncbiRefSeq 
                  WHERE name2=?`;

  let sqlParams = [gene];

  if (nameFilter || exonCountFilter) {
    if (nameFilter) {
      sqlQuery += ` AND name = ?`;
      sqlParams.push(nameFilter);
    }
    if (exonCountFilter) {
      sqlQuery += ` AND exonCount = ?`;
      sqlParams.push(exonCountFilter);
    }
  }

  sqlQuery += ` LIMIT ?, ?`;
  sqlParams.push(offset, pageSize);

  const connection = connectToDB(species);
  connection.query(sqlQuery, sqlParams, (err, result) => {
    connection.end();
    const map = (points) =>
      points
        .toString()
        .split(',')
        .map((string) => parseInt(string))
        .filter((int) => !isNaN(int));
    result.forEach((variant) => {
      variant.exonStarts = map(variant.exonStarts);
      variant.exonEnds = map(variant.exonEnds);
    });
    if (err) {
      console.error(err);
    }
    res.json(result);
  });
});

app.get('/log', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'access.log'), 'utf8');
    res.send(data);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});


app.get('/health', async (req, res) => {
  const freeMemory = os.freemem();
  const totalMemory = os.totalmem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsageInPercentage = ((usedMemory / totalMemory) * 100).toFixed(2);

  const loadAverage = os.loadavg();

  const { free: freeDisk, total: totalDisk } = await disk.check('/');
  const usedDisk = totalDisk - freeDisk;
  const diskUsageInPercentage = ((usedDisk / totalDisk) * 100).toFixed(2);

  const uptime = formatUptime(process.uptime());

  const connection = connectToDB();
  let dbStatus = 'OK';
  connection.ping((err) => {
    if (err) {
      console.error('Cannot connect to the database:', err);
      dbStatus = 'Unavailable';
    }

    connection.end();

    const healthInfo = {
      status: 'OK',
      freeMemory: formatBytes(freeMemory),
      totalMemory: formatBytes(totalMemory),
      usedMemory: formatBytes(usedMemory),
      memoryUsage: memoryUsageInPercentage + '%',
      loadAverage,
      freeDisk: formatBytes(freeDisk),
      totalDisk: formatBytes(totalDisk),
      usedDisk: formatBytes(usedDisk),
      diskUsage: diskUsageInPercentage + '%',
      uptime,
      dbStatus,
    };

    res.status(200).send(healthInfo);
  });
});

app.listen(3000);
console.log('Server listening on port 3000');
