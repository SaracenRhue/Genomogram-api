const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const utils = require('./utils');

const app = express();
app.use(cors());

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

  const connection = utils.connectToDB();
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
      sqlQuery += `name = ? AND variantCount >= ?`;
      sqlParams.push(nameFilter, variantCountFilter);
    } else if (nameFilter) {
      sqlQuery += `name = ?`;
      sqlParams.push(nameFilter);
    } else if (variantCountFilter) {
      sqlQuery += `variantCount >= ?`;
      sqlParams.push(variantCountFilter);
    }
  }

  sqlQuery += ` LIMIT ?, ?;`;
  sqlParams.push(offset, pageSize);

  const connection = utils.connectToDB(species);
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
      sqlQuery += ` AND exonCount >= ?`;
      sqlParams.push(exonCountFilter);
    }
  }

  sqlQuery += ` LIMIT ?, ?`;
  sqlParams.push(offset, pageSize);

  const connection = utils.connectToDB(species);
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


app.listen(3000);
console.log('Server listening on port 3000');

