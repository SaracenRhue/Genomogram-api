var genome = 'Human';
var geneIndex = 0;

var db;
var gene;
var variants;
fetch('http://localhost:3000/species')
  .then((response) => {
    return response.json();
  })
  .then((json) => {
    for (let i = 0; i < json.length; i++) {
      if (json[i].name === genome) {
        db = json[i].db;
        console.log(db);
        break;
      }
    }
  });

fetch(`http://localhost:3000/species/${db}/genes`)
  .then((response) => {
    return response.json();
  })
  .then((json) => {
    for (let i = 0; i < json.length; i++) {
      if (i === geneIndex) {
        gene = json[i].name;
        break;
      }
    }
  });

fetch(`http://localhost:3000/species/${db}/genes/${gene}/variants`)
  .then((response) => {
    return response.json();
  })
  .then((json) => {
    variants = json;
  });

console.log(variants);
