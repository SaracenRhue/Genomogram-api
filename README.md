# Genomegram API

Express Genomegram API is a RESTful API built with Node.js and Express, providing access to the USCS Genome Browser data.

## Features

- Access to species data.
- Access to gene data based on species.
- Access to gene variant data.
- Request throttling.
- CORS enabled.
- Logging and rotating logs.

## Installation

```bash
docker run -p 3000:3000 saracenrhue/genomogram-api
```

## Usage

All endpoints return a JSON object. Here are the available endpoints:

- Get a list of species:
  - `GET http://localhost:3000/species`
  - Optional query parameters: `name`, `db`, `page`, `pageSize`
  
  This endpoint retrieves species data. You can filter the results by providing `name` or `db` as query parameters. The `page` and `pageSize` parameters control the pagination, and by default, it returns the first 100 species.

- Get a list of genes for a specific species:
  - `GET http://localhost:3000/species/:species/genes`
  - Optional query parameters: `name`, `variantCount`, `page`, `pageSize`
  
  This endpoint retrieves genes of the specified species. The results can be filtered by `name` or `variantCount`. Use the `page` and `pageSize` parameters to control the pagination. By default, it returns the first 100 genes.

- Get a list of variants for a specific gene in a species:
  - `GET http://localhost:3000/species/:species/genes/:gene/variants`
  - Optional query parameters: `name`, `exonCount`, `page`, `pageSize`
  
  This endpoint retrieves variants of a specific gene in a species. You can filter the results by `name` or `exonCount`. The `page` and `pageSize` parameters control the pagination. By default, it returns the first 100 variants.

### Query Parameters

- `name`: filter the results by the name of the species, gene, or variant.
- `db`: filter the species by database name.
- `variantCount`: filter the genes by the count of variants.
- `minVariantCount`: filter the genes by the minimum count of variants.
- `maxVariantCount`: filter the genes by the maximum count of variants.
- `exonCount`: filter the variants by exon count.
- `page`: the page number for pagination (default is 1).
- `pageSize`: the number of results per page (default is 100 and max is 100).

All filters are optional, and multiple filters can be combined.

For example, to get the second page of genes for the db `hg38` (Human) with a variant count of at least 10, you could make a GET request to `http://localhost:3000/species/hg38/genes?variantCount=10&page=2`.

## Rate Limiting

The API is configured with rate limiting for all requests to prevent abuse. Currently, it's set to a maximum of 1000 requests per minute per IP.

## Log Access

Logs are accessible via the `/log` endpoint and are kept for the last 5000 lines.
