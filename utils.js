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

function createMatrix(variants) {
  // Determine the earliest start and the latest end among the variants
  let earliestStart = Math.min(...variants.map((variant) => variant.txStart));
  let latestEnd = Math.max(...variants.map((variant) => variant.txEnd));

  // Determine the length of the matrix
  let matrixLength = latestEnd - earliestStart;

  // Create the matrix
  let matrix = variants.map((variant) => {
    // Initialize an array filled with zeros
    let variantArray = Array(matrixLength).fill(0);

    for (let i = 0; i < variant.exonStarts.length; i++) {
      // Adjust the start and end points by the earliest start point
      let exonStart = variant.exonStarts[i] - earliestStart;
      let exonEnd = variant.exonEnds[i] - earliestStart;

      // Fill the corresponding region with ones
      variantArray.fill(1, exonStart, exonEnd);
    }

    // Adjust the array length by adding leading and trailing zeros
    let leadingZeros = Array(variant.txStart - earliestStart).fill(0);
    let trailingZeros = Array(latestEnd - variant.txEnd).fill(0);
    variantArray = leadingZeros.concat(variantArray).concat(trailingZeros);

    return variantArray;
  });

  return matrix;
}

function cleanData(data) {
  // Remove unnecessary fields from the data
  for (var gene of data) {
    for (var variant of gene.variants) {
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
  // Sort data by exonCount
  data.sort((a, b) => a.variants[0].exonCount - b.variants[0].exonCount);
  return data;
}

function filterData(data) {
  // Filter genes so that all variants have a length between 10,000 and 19,999
  let filteredData = data.filter((gene) => {
    return gene.variants.every((variant) => {
      let length = variant.txEnd - variant.txStart;
      return length >= 10000 && length <= 19999;
    });
  });
  return filteredData;
}


async function getGenomeFile(GENOME) {
  const startTime = Date.now();
  const db = (await findTablesFor(GENOME))[0]; // genome
  const connection = await connectToDB(db);
  const genomeTables = await getTableNames(connection);
  const table = genomeTables.indexOf('ncbiRefSeq'); // track
  const genome = await getTable(genomeTables[table], connection); // get genome data
  const formattedGenome = genome.map((gene) => formatGene(gene)); // format genome data for json

  // Group the genes by name2
  let data = [];
  formattedGenome.forEach((gene) => {
    const index = data.findIndex((element) => element.name === gene.name2);
    if (index !== -1) {
      data[index].variants.push(gene);
    } else {
      data.push({
        name: gene.name2,
        variants: [gene],
      });
    }
  });

  // Close the database connections
  connection.end();
  const endTime = Date.now();
  console.log(`Time taken: ${Math.floor((endTime - startTime) / 1000)}s`);

  data = cleanData(data); // remove unneeded data
  data = sortData(data); // sort data by exon count
  data = filterData(data); // filter data by length
  // data.forEach((gene) => {
  //   gene.matrix = createMatrix(gene.variants);
  // });
  return data;
} 

module.exports = {
  connectToDB,
  getTableNames,
  toJSON,
  getTable,
  findTablesFor,
  formatGene,
  createMatrix,
  cleanData,
  sortData,
  getGenomeFile,
};
