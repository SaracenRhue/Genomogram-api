const fs = require('fs');
const os = require('os');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql');
const morgan = require('morgan');
const express = require('express');
const dotenv = require('dotenv').config();
const rateLimit = require('express-rate-limit');
const logFile = path.join(__dirname, 'access.log');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');

const app = express();
app.set('trust proxy', true); // if behind a proxy like Nginx, set true
app.use(cors());
app.use(bodyParser.json());

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
app.use(morgan('dev')); // log requests to the console

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

setInterval(() => truncateLog(500), 24 * 60 * 60 * 1000); // Keeps last 500 lines and runs every 24 hours

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

app.get('/', (req, res) => {
  res.json(['Working']);
});

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
  const offset = (page - 1) * pageSize;

  const nameFilter = req.query.name ? req.query.name : null;
  const nameStartsWithFilter = req.query.nameStartsWith
    ? req.query.nameStartsWith
    : null;
  const minVariantCountFilter = req.query.minVariantCount
    ? parseInt(req.query.minVariantCount)
    : null;
  const maxVariantCountFilter = req.query.maxVariantCount
    ? parseInt(req.query.maxVariantCount)
    : null;
  const exonCountFilter = req.query.exonCount
    ? parseInt(req.query.exonCount)
    : null;

  let sqlQuery = `SELECT * FROM (
    SELECT name2 AS name, count(*) AS variantCount 
    FROM ncbiRefSeq 
    GROUP BY name2
  ) AS subQuery`;

  let countSqlQuery = `SELECT COUNT(*) as totalCount FROM (
    SELECT name2 AS name, count(*) AS variantCount 
    FROM ncbiRefSeq 
    GROUP BY name2
  ) AS subQuery`;

  let sqlParams = [];
  let conditions = [];

  if (nameFilter) {
    conditions.push(`name = ?`);
    sqlParams.push(nameFilter);
  }
  if (nameStartsWithFilter) {
    conditions.push(`name LIKE ?`);
    sqlParams.push(nameStartsWithFilter + '%');
  }
  if (minVariantCountFilter) {
    conditions.push(`variantCount >= ?`);
    sqlParams.push(minVariantCountFilter);
  }
  if (maxVariantCountFilter) {
    conditions.push(`variantCount <= ?`);
    sqlParams.push(maxVariantCountFilter);
  }
  if (exonCountFilter) {
    conditions.push(`exonCount = ?`);
    sqlParams.push(exonCountFilter);
  }

  if (conditions.length) {
    sqlQuery += ` WHERE ${conditions.join(' AND ')}`;
    countSqlQuery += ` WHERE ${conditions.join(' AND ')}`;
  }

  sqlQuery += ` LIMIT ?, ?;`;
  sqlParams.push(offset, pageSize);

  const connection = connectToDB(species);
  connection.query(countSqlQuery, sqlParams, (err, countResult) => {
    if (err) {
      console.error(err);
      connection.end();
      res.status(500).json({ error: 'Error counting total results' });
      return;
    }

    connection.query(sqlQuery, sqlParams, (err, result) => {
      connection.end();
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Error retrieving results' });
        return;
      }

      const totalResults = countResult[0].totalCount;
      const totalPages = Math.ceil(totalResults / pageSize);

      res.json({
        totalResults: totalResults,
        totalPages: totalPages,
        results: result,
      });
    });
  });
});

// http://localhost:3000/species/hg38/genes/ACMSD
app.get('/species/:species/genes/:gene', (req, res) => {
  const { species, gene } = req.params;

  let sqlQuery = `SELECT name, txStart, txEnd, exonCount, exonStarts, exonEnds 
                  FROM ncbiRefSeq 
                  WHERE name2=?`;

  const sqlParams = [gene];

  const connection = connectToDB(species);
  connection.query(sqlQuery, sqlParams, (err, result) => {
    if (err) {
      console.error(err);
      connection.end();
      return res.status(500).json({ error: err.toString() });
    }

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

    let data = {
      db: species,
      species: 'unknown',
      name: gene,
      variants: result,
    };

    let sqlQuery2 = `
      SELECT 
          a.genome AS name, a.name AS db
      FROM
          hgcentral.dbDb AS a
          JOIN
          information_schema.tables AS b ON b.table_schema = a.name
      AND b.table_name = 'ncbiRefSeq' WHERE a.name = ?`;

    const connection2 = connectToDB();
    connection2.query(sqlQuery2, [species], (err2, result2) => {
      connection2.end();
      if (err2) {
        console.error(err2);
        return res.status(500).json({ error: err2.toString() });
      }

      data.species = result2[0].name;

      res.json(data);
    });
  });
});

app.get('/health', async (req, res) => {
  const freeMemory = os.freemem();
  const totalMemory = os.totalmem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsageInPercentage = ((usedMemory / totalMemory) * 100).toFixed(2);

  const loadAverage = os.loadavg();

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
      uptime,
      dbStatus,
    };

    res.status(200).send(healthInfo);
  });
});

///// user data /////

const client = new MongoClient(process.env.MONGO_URI);

// http://localhost:3000/getUsers?sortByPoints=asc
app.get('/users', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('Genomogram');
    const users = database.collection('users');

    let query = {};
    let sort = {};

    if (req.query.id) {
      query._id = new ObjectId(req.query.id);
    }

    if (req.query.name) {
      query.name = req.query.name;
    }

    if (req.query.sortByPoints) {
      sort.points = req.query.sortByPoints === 'asc' ? 1 : -1;
    } else {
      sort.points = 1; // default sort order is ascending
    }

    let options = {
      limit: 100,
      skip: (req.query.page ? Number(req.query.page) - 1 : 0) * 100,
      sort: sort,
      projection: { uuid: 0 },
    };

    const allUsers = await users.find(query, options).toArray();

    res.json(allUsers);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error occurred while getting users');
  } finally {
    await client.close();
  }
});

// http://localhost:3000/editUser?id=userId&name=newName&points=6
app.put('/users', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('Genomogram');
    const users = database.collection('users');
    const { name, uuid, points, playedLevels, createdAt } = req.body;

    let updateData = { name, uuid, points, playedLevels, createdAt: new Date(createdAt), updatedAt: new Date() };

    const result = await users.replaceOne({ uuid }, updateData, {
      upsert: true,
    });
    console.log(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error occurred while updating user');
  } finally {
    await client.close();
  }
});

// http://localhost:3000/deleteUser?id=648c8b8181e2a7d4e7bb1e7f
app.delete('/users/:uuid', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('Genomogram');
    const users = database.collection('users');

    const result = await users.deleteOne({ uuid: req.params.uuid });

    if (result.deletedCount > 0) {
      res.json({ message: 'User deleted successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error occurred while deleting user');
  } finally {
    await client.close();
  }
});

app.listen(3000);
console.log('Server listening on port 3000');
