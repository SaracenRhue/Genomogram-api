const mysql = require('mysql');
const fs = require('fs');

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

function getTableNames(connection) {
  // Get a list of table names in the current database
  const sql = 'SHOW TABLES';
  return new Promise((resolve, reject) => {
    connection.query(sql, (error, results) => {
      if (error) reject(error);
      const tables = results.map((result) => Object.values(result)[0]);
      console.log(`Found ${tables.length} tables for this genome`);
      resolve(tables);
    });
  });
}

function toJSON(table, connection) {
  // Convert a table to JSON
  const sql = `SELECT * FROM ${table}`;
  return new Promise((resolve, reject) => {
    connection.query(sql, (error, results) => {
      if (error) reject(error);
      const data = results.map((result) => Object.assign({}, result));
      const json = JSON.stringify(data, null, 2);
      fs.writeFile(`${table}.json`, json, (error) => {
        if (error) reject(error);
        resolve();
      });
    });
  });
}

function getTable(table, connection) {
  // Get the data from a table
  const sql = `SELECT * FROM ${table}`;
  return new Promise((resolve, reject) => {
    connection.query(sql, (error, results) => {
      if (error) reject(error);
      const data = results.map((result) => Object.assign({}, result));
      resolve(data);
    });
  });
}

function findTablesFor(organism) {
  // Find a table for a specific genome e.g. "Human" in the current database
  const connection = connectToDB('hgcentral');
  return getTable('dbDb', connection)
    .then((db) => {
      const geneTables = db
        .filter(
          (item) =>
            item.organism &&
            item.organism.toLowerCase() === organism.toLowerCase()
        )
        .map((item) => item.name);
      console.log(
        `Found ${geneTables.length} tables for ${organism}: ${geneTables}`
      );
      return geneTables;
    })
    .finally(() => {
      connection.end();
    });
}

function formatGene(gene) {
  // Format a gene object to fit the JSON schema
  for (const key in gene) {
    switch (key) {
      case 'name':
      case 'name2':
        break;
      default:
        gene[key] = String(gene[key]).replace(/b'|,'/g, '');
        if (gene[key].includes(',')) {
          gene[key] = gene[key].split(',').map((value) => parseInt(value, 10));
        } else {
          gene[key] = parseInt(gene[key], 10);
        }
    }
  }

  if (gene.exonStarts) {
    gene.exonStarts.pop();
  }
  if (gene.exonEnds) {
    gene.exonEnds.pop();
  }

  return gene;
}

function getArray(variant) {
  // Convert a variant from starts and lengths to binary list
  const variantStart = variant.txStart;
  const variantEnd = variant.txEnd;
  let exonStarts = variant.exonStarts;
  let exonEnds = variant.exonEnds;

  if (typeof exonStarts === 'number') {
    exonStarts = [exonStarts];
  }

  if (typeof exonEnds === 'number') {
    exonEnds = [exonEnds];
  }

  const exonLengths = exonEnds.map((end, i) => end - exonStarts[i]);

  const variantLength = variantEnd - variantStart;
  const variantArray = Array(variantLength).fill(0);

  exonStarts.forEach((exonStart, index) => {
    const exonLength = exonLengths[index];

    for (let i = exonStart; i < exonStart + exonLength; i++) {
      if (variantStart <= i && i < variantEnd) {
        variantArray[i - variantStart] = 1;
      }
    }
  });

  return variantArray;
}

function getMatrix(gene) {
  // Get a matrix of variants for a gene
  const geneMatrix = gene.map((variant) => getArray(variant));
  return geneMatrix;
}

function cleanData(data) {
  // Remove unnecessary fields from the data
  for (var gene in data) {
    for (var variant of data[gene]) {
      delete variant.bin;
      delete variant.chrom;
      delete variant.strand;
      delete variant.cdsStart;
      delete variant.cdsEnd;
      delete variant.score;
      delete variant.name2;
      delete variant.cdsStartStat;
      delete variant.cdsEndStat;
      delete variant.exonFrames;
    }
  }
  return data;
}

function sortData(data) {
  // sort data by exonCount
  data = Object.entries(data).sort(
    (a, b) => a[1][0].exonCount - b[1][0].exonCount
  );
  data = Object.fromEntries(data);
  return data;
}

async function getGenomeFile(GENOME) {
  let data = {};
  const startTime = Date.now();
  const db = (await findTablesFor(GENOME))[0]; // genome
  const connection = await connectToDB(db);
  const genomeTables = await getTableNames(connection);
  const table = genomeTables.indexOf('ncbiRefSeq'); // track
  const genome = await getTable(genomeTables[table], connection); // get genome data
  const formattedGenome = genome.map((gene) => formatGene(gene)); // format genome data for json

  // Group the genes by name2
  formattedGenome.forEach((gene) => {
    if (!data[gene.name2]) {
      data[gene.name2] = [];
    }
    data[gene.name2].push(gene);
  });

  // Close the database connections
  connection.end();
  const endTime = Date.now();
  console.log(`Time taken: ${Math.floor((endTime - startTime) / 1000)}s`);

  data = cleanData(data); // remove unneeded data
  data = sortData(data); // sort data by exon count
  return data
}

async function getGenomeData(genome, SERVER) {
  const startTime = Date.now();
  const dataToSend = genome;

  const response = await fetch(`${SERVER}/process-data`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ data: dataToSend }),
  });
  console.log(await response.text()); 
  
  const processedData = await response.json();
  const endTime = Date.now();
  console.log(`Time taken: ${Math.floor((endTime - startTime) / 1000)}s`);
  return processedData;
}




module.exports = {
  connectToDB,
  getTableNames,
  toJSON,
  getTable,
  findTablesFor,
  formatGene,
  getArray,
  getMatrix,
  cleanData,
  sortData,
  getGenomeFile,
  getGenomeData
};
