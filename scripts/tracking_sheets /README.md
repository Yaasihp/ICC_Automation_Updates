# ICC Proposal Task Template / Checklist Generator

## Overview

This Google Apps Script project automates proposal task tracking for ICC proposal workflows. It reads proposal rows from a configured source Google Sheet, creates a separate proposal spreadsheet for each eligible proposal, builds task checklist and personnel document tabs, fetches MTU internal deadline dates from the MTU Research Deadline Table, and sends one-time subrecipient reminder emails when the source row meets the email criteria.

The main entry point is `runAll()` in `Main.gs`.

## What the System Does

When `runAll()` is executed, the system:

1. Opens the configured source spreadsheet and source sheet.
2. Reads proposal rows that need new proposal spreadsheets.
3. Ensures holiday data exists in the source spreadsheet and retrieves that holiday data.
4. Creates new proposal tracking spreadsheets in the configured destination folder, or in the root Drive folder if no destination folder is configured.
5. Builds the generated spreadsheet tabs:
   - `Task Checklist`
   - `Personnel Docs`
   - `Holidays`
6. Marks the source row as created by setting `Spreadsheet Created` to `TRUE`.
7. Updates holidays in existing spreadsheets.
8. Sends subrecipient deadline reminder emails when applicable.

## Uploaded Script Files

| File | Purpose |
|---|---|
| `config.gs` | Stores project-level configuration constants. |
| `Main.gs` | Contains the main `runAll()` function that coordinates the automation. |
| `ProposalManager.gs` | Reads proposal rows, creates proposal spreadsheets, names files, creates tabs, and marks rows as created. |
| `TemplateBuilder.gs` | Builds the `Task Checklist` and `Personnel Docs` sheets and applies formatting rules. |
| `TaskSection.gs` | Adds task sections, personnel sections, task rows, dropdowns, deadline links, and row grouping. |
| `DeadlineFetcher.gs` | Fetches MTU internal deadline dates from the MTU deadline table endpoint. |
| `SubrecipientEmailer.gs` | Sends one-time subrecipient reminder emails and records email tracking columns in the source sheet. |

## Configuration

The project uses constants defined in `config.gs` make sure to update these values before running the automation:

- `SOURCE_SHEET_ID`: The ID of the source Google Spreadsheet.
- `SOURCE_SHEET_NAME`: The name of the source sheet tab.
- `DESTINATION_FOLDER_ID`: The Google Drive folder ID where generated proposal spreadsheets should be moved. If this value is empty, the script uses the root Drive folder.

## Source Sheet Requirements

The proposal spreadsheet creation workflow expects the source sheet to contain these headers:

- `Principal Investigator (from subject)`
- `Email address`
- `Sponsor`
- `Co-investigators`
- `Official Sponsor Deadline (leave blank for flexible deadlines)`
- `Lead Organization Deadline`
- `Expected Submission Date`
- `Spreadsheet Created`

A row is selected for proposal spreadsheet creation only when:

- The PI field is present.
- At least one deadline field is present:
  - Official Sponsor Deadline
  - Lead Organization Deadline
  - Expected Submission Date
- `Spreadsheet Created` is not already checked or truthy.

## Deadline Priority

The system uses this priority order when choosing the main deadline for file naming:

1. `Lead Organization Deadline`
2. `Official Sponsor Deadline (leave blank for flexible deadlines)`
3. `Expected Submission Date`

The selected deadline is formatted as `MM-DD-YYYY` and included in the generated spreadsheet name.

Generated spreadsheet names follow this pattern:

```text
PI - Sponsor - MM-DD-YYYY
```

If no deadline is available for the name, the fallback pattern is:

```text
PI - Sponsor
```

The PI and sponsor values are truncated to 50 characters and sanitized by replacing invalid spreadsheet filename characters with underscores.

## Generated Spreadsheet Structure

Each created proposal spreadsheet contains three sheets.

### 1. Task Checklist

The `Task Checklist` sheet includes proposal header information and task sections.

Header information includes:

- PI
- Email
- Co-investigators
- Sponsor
- Official Deadline
- Lead Org Deadline
- Expected Submission
- Co-PI placeholder fields

The task table uses these columns:

| Column | Header |
|---|---|
| A | Task |
| B | Status |
| C | Deadline |
| D | Owner |
| E | Notes or Information |

The task sections are:

1. `Full Budget Draft`
2. `Tier 1 Internal and Non-Science Documents`
3. `Tier 2 Science Related and Technical Documents`

The task checklist uses MTU fetched deadline dates instead of the older commented-out WORKDAY formula logic.

### Task Checklist Deadline Logic

`buildProposalTemplate()` uses the generated sheet's official deadline cell as the anchor date. If the official deadline is a valid date, it is formatted as `yyyy-MM-dd` and passed to `fetchMTUInternalDeadlines()`.

The returned MTU dates are used as follows:

| Section | Deadline Source |
|---|---|
| Full Budget Draft | `mtuDates.fullBudget` |
| Tier 1 Internal and Non-Science Documents | `mtuDates.tier1` |
| Tier 2 Science Related and Technical Documents | `mtuDates.tier2` |

If a fetched date is missing, the section deadline cell displays `Date Not Found`.

Each task row under a section links its deadline cell to the section header deadline cell.

### Task Status Dropdown

Task rows use a status dropdown with these values:

- `Not Started`
- `In Progress`
- `Completed`
- `Not Applicable`

Conditional formatting is applied to the status column:

| Status | Formatting |
|---|---|
| Not Started | Red background, white text |
| In Progress | Yellow background, black text |
| Completed | Green background, white text |
| Not Applicable | Dark gray background, white text |

### Owner Dropdown

The `Task Checklist` sheet includes an `Owner` column. Task rows use an owner dropdown with these values:

- `Not Stated`
- `SPO`
- `PI`
- `Institute`
- `Other`

The default owner value is `Not Stated`.

Conditional formatting is applied to the owner column for `Not Stated` using a red background and white text.

### Notes and Resource Links

Some Tier 1 tasks include resource links in the `Notes or Information` column, including links for:

- Budget Justification
- Data Management Plan
- Facilities, Equipment, and Other Resources
- Mentoring Plan

### Row Grouping

Task rows are grouped under their section headers. The subrecipient paperwork tasks inside the `Full Budget Draft` section are also grouped as a nested task group.

### 2. Personnel Docs

The `Personnel Docs` sheet includes proposal header information and personnel document sections.

The personnel task table uses these columns:

| Column | Header |
|---|---|
| A | Task |
| B | Status |
| C | Deadline |
| D | Notes or Information |

Personnel document sections are created for:

- `PI:`
- Five `Co-PI:` sections

Each section includes these tasks:

- Biographical Sketch
- Current and Pending Support Form
- Collaborators and Other Affiliations
- Synergistic Activities

The `Synergistic Activities` task includes a template link in the notes column.

### Personnel Docs Deadline Logic

`buildPersonnelDocsSheet()` uses the official deadline cell as the anchor date, fetches MTU internal deadlines, and uses the Tier 1 date for PI and Co-PI personnel document sections.

If the MTU Tier 1 deadline is missing, the section deadline cell displays `Date Not Found`.

### 3. Holidays

The created spreadsheet includes a `Holidays` sheet. If holiday data is available, the script writes it into this sheet and bolds the first row.

Important: the uploaded files call these holiday-related functions, but their implementations were not included in the uploaded files:

- `ensureSourceHolidaysSheet(sourceSpreadsheet)`
- `getHolidayDataFromSource(sourceSpreadsheet)`
- `updateHolidaysInExistingSpreadsheets()`

Because these functions are not included in the uploaded files, this README only documents that they are called by `runAll()` and that holiday data is written into the generated `Holidays` sheet when returned.

## MTU Internal Deadline Fetching

`DeadlineFetcher.gs` contains the deadline-fetching logic.

The function `fetchMTUInternalDeadlines(dateStr)` sends a POST request to:

```text
https://www.mtu.edu/mtu_resources/php/research/deadline-table/index.php
```

It sends the selected anchor date as:

```javascript
payload: { selected_date: dateStr }
```

The expected input date format is:

```text
yyyy-MM-dd
```

The function parses the returned HTML table and extracts dates for:

- Full Budget Draft
- Tier 1
- Tier 2

It returns an object with this structure:

```javascript
{
  fullBudget: "MM/DD/YYYY" or null,
  tier1: "MM/DD/YYYY" or null,
  tier2: "MM/DD/YYYY" or null
}
```

If fetching fails, the function logs the error and returns all three values as `null`.

`DeadlineFetcher.gs` also includes a `testDeadlineFetcher()` helper function that tests the fetcher using the date `2026-03-12`.

## Subrecipient Deadline Reminder Emails

`SubrecipientEmailer.gs` sends one-time reminder emails to PIs when subrecipient-related conditions are met.

The entry point is:

```javascript
sendSubrecipientDeadlineEmails()
```

This function is called automatically at the end of `runAll()`.

### Subrecipient Email Required Headers

The email workflow expects these source sheet headers:

- `Date`
- `Sponsor`
- `Email address`
- `Michigan Tech Point of Contact / Principal Investigator`
- `Spreadsheet Created`
- `Will any of the sponsored funds be used for payment to individuals or organizations outside of Michigan Tech (e.g. sub-recipients, service providers/vendors, or consultants)?`
- `Subrecipient Email Sent`

The script also creates these tracking columns if they are missing:

- `Subrecipient Email Sent`
- `Subrecipient Email Sent At`

### Subrecipient Email Criteria

An email is sent only when all of these are true:

1. The row has a valid `Date`.
2. The row date is on or after the go-live date: `2026-02-26`.
3. `Spreadsheet Created` is truthy.
4. `Subrecipient Email Sent` is not already `TRUE`.
5. The subrecipient question is answered `Yes` or `Maybe`.
6. A valid recipient email can be found.
7. An anchor date can be determined.
8. The MTU deadline fetcher returns a Full Budget deadline.

### Recipient Selection

The recipient email is chosen using this order:

1. Extract an email from the `Email address` field.
2. If no valid email is found there, extract an email from the PI field.

If no valid email is found, the row is skipped and logged.

### Subrecipient Email Deadline Logic

The email workflow chooses the anchor date using this priority order:

1. `Lead organization deadline (leave blank if Michigan Tech is the lead organization)`
2. `Official Sponsor Deadline (leave blank for flexible deadlines)`
3. `Expected Submission Date`

The anchor date is sent to `fetchMTUInternalDeadlines()`. The email uses the returned `fullBudget` date as the due date for subrecipient-related tasks.

### Email Content

The email subject follows this pattern:

```text
Subrecipient Form Deadline for Proposal to [Sponsor]
```

The email tells the PI that they indicated anticipated subrecipients and asks them to complete tasks related to:

- Sending subrecipient contact information to the SPO Analyst and ICC Lead as soon as possible.
- Completing the Subrecipient Commitment Form by the Full Budget deadline.
- Completing subrecipient paperwork by the Full Budget deadline.
- Sending the Independent Contractor Questionnaire to Human Resources by the Full Budget deadline if a consultant is involved.

The email is sent using `GmailApp.sendEmail()` with both plain-text and HTML content.

After a successful send, the script writes:

- `TRUE` in `Subrecipient Email Sent`
- The current date in `Subrecipient Email Sent At`, formatted as `yyyy-MM-dd`

## Main Workflow

The full `runAll()` workflow is:

```text
Open configured source spreadsheet
↓
Read proposal rows using getProposals()
↓
Ensure and retrieve holiday data
↓
Create proposal spreadsheets for eligible rows
↓
Update holidays in existing spreadsheets
↓
Send subrecipient deadline emails
↓
Log completion
```

## Duplicate Prevention

The spreadsheet creation workflow prevents duplicate files by checking the destination folder for an existing file with the exact generated spreadsheet name. If a matching file already exists, that proposal spreadsheet is skipped.

The source row is marked as created only after a new spreadsheet is created.

## Logging

The scripts use `console.log()` and `console.error()` for runtime logging.

Logged events include:

- Number of created spreadsheets.
- Existing spreadsheet skip messages.
- Created spreadsheet names.
- Errors while marking rows as created.
- Subrecipient email run start and completion.
- Subrecipient row skip reasons.
- Subrecipient email send success or send errors.
- MTU deadline fetch failures.

## Permissions Needed

Based on the uploaded code, the script uses Google Apps Script services that require authorization for:

- Reading and editing Google Sheets through `SpreadsheetApp`.
- Creating and moving files in Google Drive through `DriveApp`.
- Fetching the MTU deadline webpage through `UrlFetchApp`.
- Sending email through `GmailApp`.

## Notes

- The old WORKDAY-based deadline calculation logic is still present as commented-out code, but the active workflow uses fetched MTU deadline dates.
- If the official deadline is missing in the generated task or personnel sheet, the MTU deadline fetch is not performed for those generated sheet sections, and deadline cells may display `Date Not Found`.
- The subrecipient emailer sends email only after `Spreadsheet Created` is true.

## License
This project is maintained by the Institute of Computing and Cybersystems at Michigan Tech.
