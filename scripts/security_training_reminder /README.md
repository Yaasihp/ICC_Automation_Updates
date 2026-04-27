# Security Training Reminder Automation

## Overview

This Google Apps Script automation sends email reminders to individuals who are missing or have expired Research Security Training, based on records stored in a Google Sheet.

The script is designed to run on a scheduled trigger (on the 1st of each month) and automatically identifies which users need to be contacted.

## What This Script Does

The automation:

- Reads training records from a Google Sheet
- Identifies required columns:
  - Name
  - Email
  - Completion Date
  - Expiration Date
- Checks each row to determine:
  - If training has **never been completed**
  - If training has **expired**
- Sends reminder emails using Gmail:
  - Different message for **missing training**
  - Different message for **expired training**
- Logs all actions for traceability

## Main Function

Run (or trigger) this function:

```javascript
sendResearchSecurityTrainingReminders()
```
## License
This project is maintained by the Institute of Computing and Cybersystems at Michigan Tech.
