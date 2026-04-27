# ICC Calendar Invite Automation

## Overview

This Google Apps Script automation creates calendar reminders for ICC proposal deadlines based on proposal data stored in the `Intent to Submit with ICC` Google Sheet.

The script reads proposal rows, calculates internal MTU deadline dates, creates calendar events, sends calendar invitations to the PI/contact, and marks rows as processed so duplicate invites are not sent.

## What This Script Does

The automation:

- Reads proposal records from the source Google Sheet
- Checks whether the proposal spreadsheet has already been created
- Skips rows before the configured effective date
- Skips rows where calendar invites were already sent
- Extracts the PI/contact email address
- Selects the anchor deadline using this priority:
  1. Lead organization deadline
  2. Official sponsor deadline
  3. Expected submission date
- Fetches MTU internal deadline dates from the MTU Research deadline table
- Creates calendar reminders for:
  - Budget Deadline
  - Tier 1 Documents Deadline
  - Tier 2 Documents Deadline
- Sends calendar invites to the proposal contact
- Adds matching events to a secondary ICC calendar, if configured
- Updates the source sheet with:
  - `Calendar Invites Sent`
  - `Calendar Invites Sent At`

## Files

| File | Purpose |
|---|---|
| `Code.gs` | Stores global configuration values such as source sheet ID, sheet name, calendar settings, timezone, event hour, and event duration. |
| `calendarInvites.gs` | Main automation logic for reading proposal rows, creating calendar events, building event descriptions, and updating tracking columns. |
| `deadlinefetcher.gs` | Fetches and parses MTU internal proposal deadline dates from the MTU Research deadline table. |

## Main Function

Run this function to create proposal deadline calendar invites:

```javascript
sendProposalCalendarInvitesSandbox()
```

## License
This project is maintained by the Institute of Computing and Cybersystems at Michigan Tech.
