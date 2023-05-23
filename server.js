const express = require('express');
const mysql = require('mysql');
const utils = require('./utils');


const app = express();

app.get('/species', (req, res) => {
  const connection = utils.connectToDB(db);
  connection.query(
    `
        SELECT 
            a.name, a.genome
        FROM
            hgcentral.dbDb AS a
                JOIN
            information_schema.tables AS b ON b.table_schema = a.name
        AND b.table_name = 'ncbiRefSeq';`,
    (err, result) => {
      connection.end();
      res.json(result);
    }
  );
});

app.get('/species/:species/genes', (req, res) => {
  const { species } = req.params;
  let db = utils.findTableFor(species);
  console.log(db);
  
  // if (species === 'human') {
  //   db = 'hg38';
  // }
  const connection = utils.connectToDB(db);
  connection.query(
    `SELECT name2 AS gene, count(*) AS variantCount FROM ncbiRefSeq GROUP BY name2`,
    (err, result) => {
      connection.end();

      res.json(result);
    }
  );
});

app.get('/species/:species/genes/:gene/variants', (req, res) => {
  const { species, gene } = req.params;
    let db;
    if (species === 'human') {
      db = 'hg38';
    }
  const connection = utils.connectToDB(db);
  connection.query(
    `SELECT * FROM ncbiRefSeq WHERE name2=?`,
    gene,
    (err, result) => {
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
      res.json(result);
    }
  );
});

app.listen(3000);
