const fs = require('fs');

const data = fs.readFileSync('./genes.json', 'utf8');
for (let i = 0; i < data.length; i++) {
  if (data[i].variants == []) {
    // remove
    data.slice(i, 1);

  }
}

fs.writeFileSync('./genes0.json', JSON.stringify(data));