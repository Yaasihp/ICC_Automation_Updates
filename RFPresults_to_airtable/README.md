# Airtable Markdown Importer

This script parses markdown files containing funding opportunity tables and uploads the data to Airtable.

## What it does

* Scans a directory of `.md` files
* Extracts markdown tables with funding data
* Normalizes column headers to match an Airtable schema
* Uploads records to Airtable in batches
* Tracks imported rows locally to avoid duplicates

## Required Airtable fields

* Funding Agency
* Program Name
* Focus Area
* Award Range
* Website Link
* Deadline

## Setup

Set the following environment variables:

```
AIRTABLE_TOKEN=your_api_token
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_TABLE_ID=your_table_id
```

## Usage

Run the script:

```
python script.py
```

Optional flags:

```
--dry-run        Preview records without uploading  
--reimport-all   Ignore saved state and re-import everything  
--verbose        Enable debug logging  
```

## Notes

* Local state is stored to prevent duplicate uploads.
* Logs and state files should be excluded from version control.

## Disclaimer

This version has been sanitized to remove sensitive paths, IDs, and credentials. 
