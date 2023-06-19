const fs = require('fs');

const input = fs.readFileSync('genes.json');
const genes = JSON.parse(input);
console.log(genes.length);

var squared = [];
for (let i = 0; i < genes.length; i++) {
    if (genes[i].matrix.length === genes[i].matrix[0].length) {
        squared.push(genes[i]);
    }
}


fs.writeFileSync('squared.json', JSON.stringify(squared));