const fs = require('fs');



var remaining = []

function generateMatrix(gene) {
  const compareByOrder = (a, b) => a - b;
  const exonStarts = gene.variants.flatMap((variant) => variant.exonStarts);
  const exonEnds = gene.variants.flatMap((variant) => variant.exonEnds);

  // combine all start points and end points
  const exonPoints = exonStarts.concat(exonEnds).sort(compareByOrder);
  const points = new Set(exonPoints);

  // exclude last point
  points.delete(Math.max(...points));

  return gene.variants.map((variant) =>
    Array.from(points, (point) => {
      for (let i = 0; i < variant.exonCount; i++) {
        const start = variant.exonStarts[i];
        const end = variant.exonEnds[i];

        if (start <= point && point < end) {
          return 1;
        }
      }
      return 0;
    })
  );
}




async function fetchGenes() {
  try {
    const response = await fetch(
      'http://localhost:3000/species/hg38/genes?minVariantCount=2&maxVariantCount=8'
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    } else {
      const genes = await response.json();
      return genes.map((item) => ({ name: item.name }));
    }
  } catch (error) {
    console.log(error);
    return [];
  }
}

async function fetchVariants(gene) {
  try {
    const response = await fetch(
      `http://localhost:3000/species/hg38/genes/${gene.name}/variants`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    } else {
      return response.json();
    }
  } catch (error) {
    console.log(error);
    return [];
  }
}

async function populateGeneVariants(genes) {
  for (let i = 0; i < genes.length; i++) {
    // await new Promise((resolve) => setTimeout(resolve, 500));
    genes[i].variants = await fetchVariants(genes[i]);
    genes[i].matrix = await generateMatrix(genes[i]);
    const ML = await genes[i].matrix[0].length;
    if (ML >= 2 || ML <= 8 || genes[i].variants != null) {
        remaining.push(genes[i]);
    }
    console.log(remaining.length);
    fs.writeFileSync('genes.json', JSON.stringify(remaining));
    
  }
}

async function getGenesAndVariants() {
  let genes = await fetchGenes();
  await populateGeneVariants(genes);
  fs.writeFileSync('genes.json', JSON.stringify(remaining));
  console.log(genes);
}

getGenesAndVariants();
