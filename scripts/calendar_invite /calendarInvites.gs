/**
 * Calendar Invite Sandbox
 */

const CAL_INVITES_SENT_HEADER = 'Calendar Invites Sent';
const CAL_INVITES_SENT_AT_HEADER = 'Calendar Invites Sent At';

// const FULL_BUDGET_EVENT_ID_HEADER = 'Full Budget Event ID';
// const TIER1_EVENT_ID_HEADER = 'Tier 1 Event ID';
// const TIER2_EVENT_ID_HEADER = 'Tier 2 Event ID';
const EFFECTIVE_DATE = '2026-04-06';



const SECONDARY_CALENDAR_ID = 'SECONDARY_CALENDAR_ID'

function sendProposalCalendarInvitesSandbox() {
  const runTag = `CALENDAR_SANDBOX ${new Date().toISOString()}`;
  console.log(`[${runTag}] Starting...`);

  const ss = SpreadsheetApp.openById(SOURCE_SHEET_ID);
  const sheet = ss.getSheetByName(SOURCE_SHEET_NAME);

  if (!sheet) {
    console.log(`[${runTag}] ERROR: Source sheet not found.`);
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    console.log(`[${runTag}] No rows to process.`);
    return;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const ensured = ensureCalendarColumns_(sheet, headers);
  const col = buildHeaderIndex_(ensured.headers);

  const required = [
    'Date',
    'Sponsor',
    'Email address',
    'Spreadsheet Created'
  ];

  const missing = required.filter(h => !col[h]);
  if (missing.length) {
    console.log(`[${runTag}] ERROR missing headers: ${missing.join(' | ')}`);
    return;
  }



  const calendar = ICC_CALENDAR_ID === 'primary'
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(ICC_CALENDAR_ID);

  if (!calendar) {
    console.log(`[${runTag}] ERROR: calendar not found for ID ${ICC_CALENDAR_ID}`);
    return;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  let created = 0;
  let skipped = 0;

  values.forEach((row, idx0) => {
    const rowNumber = idx0 + 2;
    console.log(`Row ${rowNumber} START ----------------`); 

    const rowDate = normalizeDate_(row[col['Date'] - 1]);
    console.log(`Row ${rowNumber} rowDate=${rowDate}`);

    if (!rowDate) {
      console.log(`Row ${rowNumber} SKIP: invalid or blank Date`);
      skipped++;
      return;
    }

    if (rowDate < EFFECTIVE_DATE) {
      console.log(`Row ${rowNumber} SKIP: before effective date ${EFFECTIVE_DATE}`);
      skipped++;
      return;
    }

    const spreadsheetCreated = !!row[col['Spreadsheet Created'] - 1];
    console.log(`Row ${rowNumber} spreadsheetCreated=${spreadsheetCreated}`);
    if (!spreadsheetCreated) {
      console.log(`Row ${rowNumber} SKIP: spreadsheet not created`);
      skipped++;
      return;
    }

    const alreadySent = String(row[(col[CAL_INVITES_SENT_HEADER] || 0) - 1] || '').toLowerCase() === 'true';
    if (alreadySent) {
      console.log(`Row ${rowNumber} alreadySent=${alreadySent}`);
      console.log(`Row ${rowNumber} SKIP: already sent`);
      skipped++;
      return;
    }

    const recipientEmail = extractEmail_(row[col['Email address'] - 1]);
    console.log(`Row ${rowNumber} email=${recipientEmail}`);
    if (!recipientEmail) {
      console.log(`[${runTag}] Row ${rowNumber}: SKIP no valid email`);
      skipped++;
      return;
    }


    const sponsor = String(row[col['Sponsor'] - 1] || '').trim() || 'Sponsor';
    const piName = getPiNameFromRow_(row, col);
    const iccLead = getIccLeadFromRow_(row, col) || 'ICC Proposals Team';
    console.log(`Row ${rowNumber} iccLead=${iccLead}`);

    const anchorDate = pickAnchorDateStrFromRow_(row, col);
    console.log(`Row ${rowNumber} anchorDate=${anchorDate}`);
    if (!anchorDate) {
      console.log(`[${runTag}] Row ${rowNumber}: SKIP no anchor date`);
      skipped++;
      return;
    }

    const mtuDates = fetchMTUInternalDeadlines(anchorDate);
    console.log(`Row ${rowNumber} mtuDates=${JSON.stringify(mtuDates)}`);
    if (!mtuDates.fullBudget && !mtuDates.tier1 && !mtuDates.tier2) {
      console.log(`Row ${rowNumber} SKIP: no internal deadlines returned`);
      skipped++;
      return;
    }

    try {
      // let fullBudgetEventId = '';
      // let tier1EventId = '';
      // let tier2EventId = '';

      if (mtuDates.fullBudget) {
        createDeadlineEvent_(
          calendar,
          `${piName} ${sponsor} Budget Deadline`,
          buildBudgetDeadlineDescription_(iccLead),
          recipientEmail,
          mtuDates.fullBudget
        );
      }

      if (mtuDates.tier1) {
        createDeadlineEvent_(
          calendar,
          `${piName} ${sponsor} Tier 1 Deadline`,
          buildTier1DeadlineDescription_(iccLead),
          recipientEmail,
          mtuDates.tier1
        );
      }

      if (mtuDates.tier2) {
        createDeadlineEvent_(
          calendar,
          `${piName} ${sponsor} Tier 2 Deadline`,
          buildTier2DeadlineDescription_(iccLead),
          recipientEmail,
          mtuDates.tier2
        );
      }

      if (col[CAL_INVITES_SENT_HEADER]) {
        sheet.getRange(rowNumber, col[CAL_INVITES_SENT_HEADER]).setValue(true);
      }
      if (col[CAL_INVITES_SENT_AT_HEADER]) {
        sheet.getRange(rowNumber, col[CAL_INVITES_SENT_AT_HEADER])
          .setValue(new Date())
          .setNumberFormat('yyyy-MM-dd HH:mm:ss');
      }
      // if (col[FULL_BUDGET_EVENT_ID_HEADER]) {
      //   sheet.getRange(rowNumber, col[FULL_BUDGET_EVENT_ID_HEADER]).setValue(fullBudgetEventId);
      // }
      // if (col[TIER1_EVENT_ID_HEADER]) {
      //   sheet.getRange(rowNumber, col[TIER1_EVENT_ID_HEADER]).setValue(tier1EventId);
      // }
      // if (col[TIER2_EVENT_ID_HEADER]) {
      //   sheet.getRange(rowNumber, col[TIER2_EVENT_ID_HEADER]).setValue(tier2EventId);
      // }

      created++;
      console.log(`[${runTag}] Row ${rowNumber}: DONE: invites created for ${recipientEmail}`);
    } catch (e) {
      console.log(`[${runTag}] Row ${rowNumber}: ERROR ${e.message}`);
      skipped++;
    }
  });

  console.log(`[${runTag}] Done. Created=${created}, Skipped=${skipped}`);
}

// function createDeadlineEvent_(calendar, title, description, guestEmail, dateStr) {
//   const start = buildDateAtHour_(dateStr, EVENT_HOUR);
//   const end = new Date(start.getTime() + EVENT_DURATION_HOURS * 60 * 60 * 1000);

//   const event = calendar.createEvent(title, start, end, {
//     description: description,
//     guests: guestEmail,
//     sendInvites: true
//   });

//   event.addPopupReminder(30);
//   event.addEmailReminder(24 * 60);

//   return event.getId();
// }

function createDeadlineEvent_(calendar, title, description, guestEmail, dateStr) {
  const logTag = `[EVENT ${title}]`;

  try {
    const start = buildDateAtHour_(dateStr, EVENT_HOUR);
    const end = new Date(start.getTime() + EVENT_DURATION_HOURS * 60 * 60 * 1000);

    console.log(`${logTag} Creating PRIMARY event on calendar...`);

    // PRIMARY EVENT (sends invite)
    const primaryEvent = calendar.createEvent(title, start, end, {
      description: description,
      guests: guestEmail,
      sendInvites: true
    });

    console.log(`${logTag} Primary event created. ID=${primaryEvent.getId()}`);

    primaryEvent.addPopupReminder(30);
    primaryEvent.addEmailReminder(24 * 60);

    // SECONDARY CALENDAR
    if (SECONDARY_CALENDAR_ID) {
      let secondaryCalendar;

      try {
        secondaryCalendar = CalendarApp.getCalendarById(SECONDARY_CALENDAR_ID);
      } catch (err) {
        console.log(`${logTag} Secondary calendar lookup failed: ${err.message}`);
        return primaryEvent.getId();
      }

      if (!secondaryCalendar) {
        console.log(`${logTag} Secondary calendar NOT FOUND. Check ID or permissions.`);
        return primaryEvent.getId();
      }

      console.log(`${logTag} Secondary calendar found: ${secondaryCalendar.getName()}`);

      try {
        const secondaryEvent = secondaryCalendar.createEvent(title, start, end, {
          description: description
        });

        console.log(`${logTag} Secondary event created. ID=${secondaryEvent.getId()}`);
      } catch (err) {
        console.log(`${logTag} ERROR creating event on secondary calendar: ${err.message}`);
      }
    }

    return primaryEvent.getId();

  } catch (err) {
    console.log(`${logTag} FATAL ERROR: ${err.message}`);
    throw err; // keeps your outer try/catch working
  }
}


function buildEventDescription_(iccLead, docLabel, dueDate) {
  return [
    `Your ICC lead for this proposal is: ${iccLead}`,
    '',
    `* ${docLabel} Deadline`,
    `* Not a meeting, just a calendar reminder *`,
    '',
    `${docLabel} are due to SPO by 7:00 AM Eastern on ${dueDate}.`,
    '',
    `ICC proposal preparation resources: [insert ICC link here]`,
    `For more information on the documents required for the SPO tiered submission system: https://www.mtu.edu/research/project/route-submit/deadlines/`
  ].join('\n');
}


function buildBudgetDeadlineDescription_(iccLead) {
  return [
    `Your ICC lead for this proposal is: ${iccLead}`,
    '',
    'Budget Deadline',
    '',
    'Not a meeting, just a calendar reminder',
    '',
    'Budget deadline: Your budget worksheet and justification are due to your SPO analyst by 7:00am today. A Cayuse number, draft SOW and an abstract are also due today.',
    '',
    'Please remember to give SPO & ICC personnel admin access and AOR access to submit your proposal!',
    'SPO & ICC personnel: [Internal SPO & ICC personnel access link]',
    'AOR access: [Internal AOR access link]',
    '',
    'ICC proposal preparation resources:',
    '[Internal ICC proposal preparation resources link]',
    '',
    'For more information on the documents required for the SPO tiered submission system:',
    'https://www.mtu.edu/research/project/route-submit/deadlines/'
  ].join('\n');
}


function buildTier1DeadlineDescription_(iccLead) {
  return [
    `Your ICC lead for this proposal is: ${iccLead}`,
    '',
    'Tier 1 Documents Deadline',
    '',
    'Not a meeting, just a calendar reminder',
    '',
    'Tier 1 (non-science/technical documents) are due to SPO by 7:00am today for submission by the sponsor deadline. This includes a completed and approved Cayuse proposal, a completed and approved budget, and (if applicable) completed cost share forms in Banweb.',
    '',
    'Please remember to give SPO & ICC personnel admin access and AOR access to submit your proposal!',
    'SPO & ICC personnel: [Internal SPO & ICC personnel access link]',
    'AOR access: [Internal AOR access link]',
    '',
    'ICC proposal preparation resources:',
    '[Internal ICC proposal preparation resources link]',
    '',
    'For more information on the documents required for the SPO tiered submission system:',
    'https://www.mtu.edu/research/project/route-submit/deadlines/'
  ].join('\n');
}

function buildTier2DeadlineDescription_(iccLead) {
  return [
    `Your ICC lead for this proposal is: ${iccLead}`,
    '',
    'Tier 2 Documents Deadline',
    '',
    'Not a meeting, just a calendar reminder',
    '',
    'Tier 2 (science/technical documents) are due to SPO by 7:00am today for submission by the sponsor deadline.',
    '',
    'ICC proposal preparation resources:',
    '[Internal ICC proposal preparation resources link]',
    '',
    'For more information on the documents required for the SPO tiered submission system:',
    'https://www.mtu.edu/research/project/route-submit/deadlines/'
  ].join('\n');
}

function buildDateAtHour_(mmddyyyy, hour24) {
  const parts = String(mmddyyyy).split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${mmddyyyy}`);
  }

  const month = Number(parts[0]) - 1;
  const day = Number(parts[1]);
  const year = Number(parts[2]);

  return new Date(year, month, day, hour24, 0, 0);
}

function ensureCalendarColumns_(sheet, headers) {
  let updatedHeaders = headers.slice();
  let added = false;

  [
    CAL_INVITES_SENT_HEADER,
    CAL_INVITES_SENT_AT_HEADER,
    // FULL_BUDGET_EVENT_ID_HEADER,
    // TIER1_EVENT_ID_HEADER,
    // TIER2_EVENT_ID_HEADER
  ].forEach(h => {
    if (updatedHeaders.indexOf(h) === -1) {
      updatedHeaders.push(h);
      added = true;
    }
  });

  if (added) {
    sheet.getRange(1, 1, 1, updatedHeaders.length).setValues([updatedHeaders]);
    sheet.getRange(1, 1, 1, updatedHeaders.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return { headers: updatedHeaders };
}

function buildHeaderIndex_(headers) {
  const out = {};
  headers.forEach((h, i) => {
    const key = String(h || '').trim();
    if (key) out[key] = i + 1;
  });
  return out;
}

function getPiNameFromRow_(row, col) {
  const candidates = [
    'Michigan Tech Point of Contact / Principal Investigator',
    'Principal Investigator (from subject)'
  ];

  for (const h of candidates) {
    if (col[h]) {
      const value = String(row[col[h] - 1] || '').trim();
      if (value) return value;
    }
  }

  return 'PI';
}

function getIccLeadFromRow_(row, col) {
  const candidates = [
    'ICC Lead',
    'ICC Proposal Lead',
    'Your ICC lead for this proposal is'
  ];

  for (const h of candidates) {
    if (col[h]) {
      const value = String(row[col[h] - 1] || '').trim();
      if (value) return value;
    }
  }

  return '';
}

function extractEmail_(text) {
  const s = String(text || '');
  const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

function coerceToDate_(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  const s = String(val).trim();
  if (!s) return null;

  const d = new Date(s);
  if (d instanceof Date && !isNaN(d.getTime())) return d;

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d2 = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(d2.getTime())) return d2;
  }

  return null;
}

function normalizeDate_(val) {
  const d = coerceToDate_(val);
  if (!d) return null;

  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function pickAnchorDateStrFromRow_(row, col) {
  const leadOrg = row[((col['Lead organization deadline (leave blank if Michigan Tech is the lead organization)'] || 0) - 1)];
  const official = row[((col['Official Sponsor Deadline (leave blank for flexible deadlines)'] || 0) - 1)];
  const expected = row[((col['Expected Submission Date'] || 0) - 1)];

  const picked = leadOrg || official || expected;
  const d = coerceToDate_(picked);
  if (!d) return null;

  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
