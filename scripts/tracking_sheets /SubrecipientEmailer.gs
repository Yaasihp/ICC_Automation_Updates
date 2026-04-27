/**
 * Subrecipient Emailer
 * Sends a one-time reminder email to PI when 
 * "Will any of the sponsored funds be used for payment to individuals or organizations outside of Michigan Tech (e.g. sub-recipients, service providers/vendors, or consultants)?"
 * is Yes/Maybe
 * and Spreadsheet Created is TRUE and row Date >= go-live and Full Budget deadline exists.
 *a new "Subrecipient Email Sent" column created on demand.
 */

// Go-live date (row Date must be >= this)
const SUBRECIPIENT_EMAIL_GO_LIVE = new Date('2026-02-26'); 

// Exact column header
const SUBRECIPIENT_QUESTION_HEADER =
  'Will any of the sponsored funds be used for payment to individuals or organizations outside of Michigan Tech (e.g. sub-recipients, service providers/vendors, or consultants)?';

// New tracking columns we will add if missing
const SUBRECIPIENT_SENT_HEADER = 'Subrecipient Email Sent';
const SUBRECIPIENT_SENT_AT_HEADER = 'Subrecipient Email Sent At';


/**
 * Entry point (called by runAll)
 */
function sendSubrecipientDeadlineEmails() {
  const runTag = `SUBRECIPIENT_EMAILER ${new Date().toISOString()}`;
  console.log(`[${runTag}] Starting...`);

  const ss = SpreadsheetApp.openById(SOURCE_SHEET_ID);
  const sheet = ss.getSheetByName(SOURCE_SHEET_NAME);
  if (!sheet) {
    console.log(`[${runTag}] ERROR: Source sheet not found: ${SOURCE_SHEET_NAME}`);
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) {
    console.log(`[${runTag}] No data rows to process.`);
    return;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const col = buildHeaderIndex_(headers);

  // Ensure required columns exist (and refresh header map if we added columns)
  const ensured = ensureSubrecipientColumns_(sheet, headers);
  const headers2 = ensured.headers;
  const col2 = buildHeaderIndex_(headers2);

  // Required inputs
  const required = [
    'Date',
    'Sponsor',
    'Email address',
    'Michigan Tech Point of Contact / Principal Investigator',
    'Spreadsheet Created',
    SUBRECIPIENT_QUESTION_HEADER,
    SUBRECIPIENT_SENT_HEADER
  ];
  const missing = required.filter(h => !col2[h]);
  if (missing.length) {
    console.log(`[${runTag}] ERROR: Missing required headers: ${missing.join(' | ')}`);
    return;
  }

  const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const values = dataRange.getValues();

  let sentCount = 0;
  let skippedCount = 0;

  values.forEach((row, idx0) => {
    const rowNumber = idx0 + 2;

    const rowDateVal = row[col2['Date'] - 1];
    const rowDateObj = coerceToDate_(rowDateVal);
    if (!rowDateObj) {
      console.log(`[${runTag}] Row ${rowNumber}: SKIP (no valid Date). Value="${rowDateVal}"`);
      skippedCount++;
      return;
    }

    if (rowDateObj < SUBRECIPIENT_EMAIL_GO_LIVE) {
      // Not live yet for this row
      skippedCount++;
      return;
    }

    const spreadsheetCreated = !!row[col2['Spreadsheet Created'] - 1];
    if (!spreadsheetCreated) {
      skippedCount++;
      return;
    }

    const sentAlready = String(row[col2[SUBRECIPIENT_SENT_HEADER] - 1] || '').toLowerCase() === 'true';
    if (sentAlready) {
      skippedCount++;
      return;
    }

    const subAnsRaw = String(row[col2[SUBRECIPIENT_QUESTION_HEADER] - 1] || '').trim();
    const subAns = normalizeYesMaybeNo_(subAnsRaw);
    if (!(subAns === 'yes' || subAns === 'maybe')) {
      skippedCount++;
      return;
    }

    // Determine PI + recipient email
    const piName = String(row[col2['Michigan Tech Point of Contact / Principal Investigator'] - 1] || '').trim()
      || 'there';

    const sponsor = String(row[col2['Sponsor'] - 1] || '').trim() || 'the sponsor';

    // Primary recipient rule:
    // 1) If "Email address" looks like an email -> send there 
    // 2) Else try extracting an email from the PI field if it contains one(MIGHT CHANGE)

    const emailAddressField = String(row[col2['Email address'] - 1] || '').trim();
    const recipientEmail = pickRecipientEmail_(emailAddressField, piName);
    if (!recipientEmail) {
      console.log(`[${runTag}] Row ${rowNumber}: SKIP (Yes/Maybe but no valid recipient email found). Email address="${emailAddressField}" PI field="${piName}"`);
      skippedCount++;
      return;
    }

    // Anchor date logic for MTU deadline fetch:
    // Use Lead Org > Official > Expected Submission (same priority as spreadsheet naming)
    const anchor = pickAnchorDateStrFromRow_(row, col2);
    if (!anchor) {
      console.log(`[${runTag}] Row ${rowNumber}: SKIP (Yes/Maybe but no anchor date available for MTU fetch).`);
      skippedCount++;
      return;
    }

    const mtuDates = fetchMTUInternalDeadlines(anchor);
    const fullBudget = mtuDates && mtuDates.fullBudget ? String(mtuDates.fullBudget).trim() : '';

    if (!fullBudget) {
      console.log(`[${runTag}] Row ${rowNumber}: SKIP (Yes/Maybe but no Full Budget deadline returned). anchor="${anchor}"`);
      skippedCount++;
      return;
    }

    // // Compose email
    const subject = `Subrecipient Form Deadline for Proposal to ${sponsor}`;

    const plainBody =
    `Hello ${piName},

    You have notified us that you anticipate having subrecipients on this proposal. 
    Please conduct the following tasks:

      • As Soon As Possible:
        Send Subrecipient contact information to your SPO Analyst and ICC Lead.

      • Due ${fullBudget}:
        Complete the Subrecipient Commitment Form and submit to your SPO Analyst and ICC Lead.
        Link: https://example.edu/forms/external-partner-form.pdf. Please note that the form must be opened in Adobe Acrobat for editing.

      • Due ${fullBudget}:
        Complete the Subrecipient Paperwork (Scope of Work, Budget, F&A Rate Agreement, etc.)
        and submit to your SPO Analyst and ICC Lead.

      • Due ${fullBudget}:
        If there is a consultant involved, send the completed Independent Contractor Questionnaire
        to Human Resources.
        Link: https://example.edu/forms/contractor-questionnaire.pdf

    Note that a contractor vs. vendor questionnaire is no longer required. 
    We are only using the Subrecipient Tab in Cayuse to log contact information about the subrecipient.

    Please let us know if you have any questions.

    Thanks,
    ICC Admin Team`;

    const htmlBody = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">

      <p>Hello ${piName},</p>

      <p>
        You have notified us that you anticipate having subrecipients on this proposal.
        Please conduct the following tasks:
      </p>

      <ul style="margin-left: 10px; padding-left: 10px;">

        <li style="margin-bottom: 10px;">
          <strong>As Soon As Possible:</strong>
          Send Subrecipient contact information to your SPO Analyst and ICC Lead.
        </li>

        <li style="margin-bottom: 10px;">
          <strong>Due ${fullBudget}:</strong>
          Complete the 
          <a href="https://example.edu/forms/external-partner-form.pdf" target="_blank">
            Subrecipient Commitment Form
          </a> 
          and submit to your SPO Analyst and ICC Lead. Please note that the form must be opened in Adobe Acrobat for editing.
        </li>

        <li style="margin-bottom: 10px;">
          <strong>Due ${fullBudget}:</strong>
          Complete the Subrecipient Paperwork (Scope of Work, Budget, F&A Rate Agreement, etc.)
          and submit to your SPO Analyst and ICC Lead.
        </li>

        <li style="margin-bottom: 10px;">
          <strong>Due ${fullBudget}:</strong>
          If there is a consultant involved, send the completed 
          <a href="https://example.edu/forms/contractor-questionnaire.pdf" target="_blank">
            Independent Contractor Questionnaire
          </a> 
          to Human Resources.
        </li>

      </ul>

      <p>
        Note that a contractor vs. vendor questionnaire is no longer required.
        We are only using the Subrecipient Tab in Cayuse to log contact information about the subrecipient.
      </p>

      <p>Please let us know if you have any questions.</p>

      <p>
        Thanks,<br>
        <strong>ICC Admin Team</strong>
      </p>

    </div>
    `;
  
  
    // Send + mark as sent
    try {
      GmailApp.sendEmail(recipientEmail, subject, plainBody, {htmlBody: htmlBody});

      // Mark sent in-sheet (write back to only those 3 cells)
      const sentCol = col2[SUBRECIPIENT_SENT_HEADER];
      const sentAtCol = col2[SUBRECIPIENT_SENT_AT_HEADER];

      sheet.getRange(rowNumber, sentCol).setValue(true);

      const sentAtCell = sheet.getRange(rowNumber, sentAtCol);
      sentAtCell.setValue(new Date());
      sentAtCell.setNumberFormat('yyyy-MM-dd');

      sentCount++;
      console.log(`[${runTag}] Row ${rowNumber}: SENT to ${recipientEmail}. fullBudget="${fullBudget}" sponsor="${sponsor}"`);
    } catch (e) {
      console.log(`[${runTag}] Row ${rowNumber}: ERROR sending email: ${e.message}`);
      skippedCount++;
    }
  });

  console.log(`[${runTag}] Done. Sent=${sentCount}, Skipped=${skippedCount}`);
}

/**
 * Ensures the "sent" columns exist. Adds them to the end if missing.
 * Returns {headers: string[]} updated header row.
 */
function ensureSubrecipientColumns_(sheet, headers) {
  let updatedHeaders = headers.slice();
  let added = false;

  function ensure(headerName) {
    if (updatedHeaders.indexOf(headerName) === -1) {
      updatedHeaders.push(headerName);
      added = true;
    }
  }

  ensure(SUBRECIPIENT_SENT_HEADER);
  ensure(SUBRECIPIENT_SENT_AT_HEADER);

  if (!added) return { headers: updatedHeaders };

  // Write updated header row
  sheet.getRange(1, 1, 1, updatedHeaders.length).setValues([updatedHeaders]);
  sheet.getRange(1, 1, 1, updatedHeaders.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  console.log(`[SubrecipientEmailer] Added missing columns: ${SUBRECIPIENT_SENT_HEADER}, ${SUBRECIPIENT_SENT_AT_HEADER}`);
  return { headers: updatedHeaders };
}

/**
 * Builds map header -> 1-based column index
 */
function buildHeaderIndex_(headers) {
  const out = {};
  headers.forEach((h, i) => {
    const key = String(h || '').trim();
    if (key) out[key] = i + 1;
  });
  return out;
}

/**
 * Converts various sheet date formats into Date object, or null
 */
function coerceToDate_(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  const s = String(val).trim();
  if (!s) return null;

  // Try native parse
  const d = new Date(s);
  if (d instanceof Date && !isNaN(d.getTime())) return d;

  // Try yyyy-MM-dd manually
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d2 = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(d2.getTime())) return d2;
  }

  return null;
}

/**
 * Normalizes subrecipient answer to 'yes'|'maybe'|'no'|'' with forgiving parsing.
 */
function normalizeYesMaybeNo_(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  if (s.startsWith('yes')) return 'yes';
  if (s.startsWith('maybe')) return 'maybe';
  if (s.startsWith('no')) return 'no';
  return s; // unknown
}

/**
 * Picks best recipient email, with minimal assumptions.
 */
function pickRecipientEmail_(emailAddressField, piField) {
  const e1 = extractEmail_(emailAddressField);
  if (e1) return e1;

  const e2 = extractEmail_(piField);
  if (e2) return e2;

  return null;
}

function extractEmail_(text) {
  const s = String(text || '');
  const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

/**
 * Anchor date: Lead Org Deadline > Official Sponsor Deadline > Expected Submission Date.
 * Returns YYYY-MM-DD or null.
 */
function pickAnchorDateStrFromRow_(row, col) {
  // These header names must match your Intent sheet exactly
  const leadOrg = row[(col['Lead organization deadline (leave blank if Michigan Tech is the lead organization)'] || 0) - 1];
  const official = row[(col['Official Sponsor Deadline (leave blank for flexible deadlines)'] || 0) - 1];
  const expected = row[(col['Expected Submission Date'] || 0) - 1];

  const picked = leadOrg || official || expected;
  const d = coerceToDate_(picked);
  if (!d) return null;

  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
