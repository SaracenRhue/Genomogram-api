const express = require('express');
const mysql = require('mysql');
const utils = require('./utils');

const app = express();

// http://localhost:3000/species
app.get('/species', (req, res) => {
  const page = req.query.page ? parseInt(req.query.page) : 1; // default page is 1
  const pageSize = req.query.pageSize
    ? parseInt(req.query.pageSize)
    : Number.MAX_SAFE_INTEGER; // default page size is 'unlimited'
  const offset = (page - 1) * pageSize;

  const connection = utils.connectToDB();
  connection.query(
    `
        SELECT 
            a.genome AS name, a.name AS db
        FROM
            hgcentral.dbDb AS a
            JOIN
            information_schema.tables AS b ON b.table_schema = a.name
        AND b.table_name = 'ncbiRefSeq'
        LIMIT ?, ?;`,
    [offset, pageSize],
    (err, result) => {
      connection.end();
      if (err) {
        console.error(err);
      }
      res.json(result);
    }
  );
});

// http://localhost:3000/species/hg38/genes?page=2&pageSize=20
app.get('/species/:species/genes', (req, res) => {
  const { species } = req.params;
  const page = req.query.page ? parseInt(req.query.page) : 1; // default page is 1
  const pageSize = req.query.pageSize
    ? parseInt(req.query.pageSize)
    : Number.MAX_SAFE_INTEGER; // default page size is unlimited
  const offset = (page - 1) * pageSize;

  const connection = utils.connectToDB(species);
  connection.query(
    `SELECT name2 AS name, count(*) AS variantCount 
     FROM ncbiRefSeq 
     GROUP BY name2 
     LIMIT ?, ?`,
    [offset, pageSize],
    (err, result) => {
      connection.end();
      if (err) {
        console.error(err);
      }
      res.json(result);
    }
  );
});

// http://localhost:3000/species/hg38/genes/ACMSD/variants
app.get('/species/:species/genes/:gene/variants', (req, res) => {
  const { species, gene } = req.params;
  const page = req.query.page ? parseInt(req.query.page) : 1; // default page is 1
  const pageSize = req.query.pageSize
    ? parseInt(req.query.pageSize)
    : Number.MAX_SAFE_INTEGER; // default page size is 'unlimited'
  const offset = (page - 1) * pageSize;

  const connection = utils.connectToDB(species);
  connection.query(
    `SELECT name, txStart, txEnd, exonCount, exonStarts, exonEnds 
     FROM ncbiRefSeq 
     WHERE name2=? 
     LIMIT ?, ?`,
    [gene, offset, pageSize],
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
      if (err) {
        console.error(err);
      }
      res.json(result);
    }
  );
});


app.listen(3000);
