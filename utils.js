const mysql = require('mysql');

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

module.exports = {
  connectToDB,
};
