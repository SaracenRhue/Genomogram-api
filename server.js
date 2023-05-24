const express = require('express');
const mysql = require('mysql');
const utils = require('./utils');


const app = express();

app.get('/species', (req, res) => {
  const connection = utils.connectToDB();
  connection.query(
    `
        SELECT 
            a.genome AS name, a.name AS db
        FROM
            hgcentral.dbDb AS a
                JOIN
            information_schema.tables AS b ON b.table_schema = a.name
        AND b.table_name = 'ncbiRefSeq';`,
    (err, result) => {
      connection.end();
      console.log(err);
      res.json(result);
    }
  );
});

app.get('/species/:species/genes', (req, res) => {
  const { species } = req.params;
  const connection = utils.connectToDB(species);
  connection.query(
    `SELECT name2 AS name, count(*) AS variantCount FROM ncbiRefSeq GROUP BY name2`,
    (err, result) => {
      connection.end();
      console.log(err);
      res.json(result);
    }
  );
});

app.get('/species/:species/genes/:gene/variants', (req, res) => {
  const { species, gene } = req.params;
  const connection = utils.connectToDB(species);
  connection.query(
    `SELECT name, txStart, txEnd, exonCount, exonStarts, exonEnds FROM ncbiRefSeq WHERE name2=?`,
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
      console.log(err);
      res.json(result);
    }
  );
});

app.listen(3000);
