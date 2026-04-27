
function sendResearchSecurityTrainingReminders() {
  const SPREADSHEET_ID = 'REPLACE_WITH_YOUR_SPREADSHEET_ID';
=
  const SHEET_NAME = 'Sheet1';

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found in spreadsheet.`);
  }

  const data = sheet.getDataRange().getValues();
  Logger.log(`Raw data row count: ${data.length}`);

  if (data.length < 2) {
    Logger.log('No data rows found.');
    return;
  }

  const headers = data[0].map(h => String(h).trim());
  Logger.log('Normalized headers: ' + JSON.stringify(headers));

  const nameCol = headers.indexOf('Name');
  const emailCol = headers.indexOf('Email');
  const completionCol = headers.indexOf('Completion Date');
  const expirationCol = headers.indexOf('Expiration Date');

  Logger.log(`Column indexes => Name: ${nameCol}, Email: ${emailCol}, Completion: ${completionCol}, Expiration: ${expirationCol}`);

  if ([nameCol, emailCol, completionCol, expirationCol].includes(-1)) {
    throw new Error('Required columns not found. Expected: Name, Email, Completion Date, Expiration Date');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  Logger.log(`Today: ${today}`);

  const subject = 'Research Security Training Required';

  const htmlBodyMissing = `
    <p>
      If you are receiving this message, it's because ICC
      <u>does not have confirmation</u>
      that you have completed Research Security Training in accordance with Federal Research Requirements.
      SPO now requires that the AOR certify your completion of this training prior to submitting a proposal for federal funding.
    </p>

    <p>
      The CITI training website is
      <a href="https://about.citiprogram.org/">HERE</a>,
      and you can register under Michigan Tech if you have not already done so.
      This is specifically for the <b>Research Security Training (Combined)</b>.
      The training has not been added as "required" so you will need to add it manually.
      Instructions for doing this may be found
      <a href="[Internal training instructions link]">HERE</a>.
    </p>

    <p>
      <span style="color:red; font-weight:bold;">After completing the training</span>,
      download the completion certificate(s) from citiprogram.org, and email the certificate
      to <a href="mailto:research-training@university.edu">research-training@university.edu</a>
      and <a href="mailto:admin-team@university.edu">admin-team@university.edu</a>.
      Please reach out to us at
      <a href="mailto:admin-team@university.edu">admin-team@university.edu</a>
      if you have any questions or concerns.
    </p>

    <p>
      Thank you!<br>
      ICC Admin Team
    </p>
  `;

  const plainBodyMissing = `
If you are receiving this message, it's because ICC does not have confirmation that you have completed Research Security Training in accordance with Federal Research Requirements. SPO now requires that the AOR certify your completion of this training prior to submitting a proposal for federal funding.

The CITI training website is HERE:
https://about.citiprogram.org/

You can register under Michigan Tech if you have not already done so. This is specifically for the Research Security Training (Combined). The training has not been added as "required" so you will need to add it manually. Instructions for doing this may be found HERE:
[Internal training instructions link]?tab=t.0

After completing the training, download the completion certificate(s) from citiprogram.org, and email the certificate to research-training@university.edu and admin-team@university.edu. Please reach out to us at admin-team@university.edu if you have any questions or concerns.

Thank you!
ICC Admin Team
  `;

  // ADDED: separate email body for expired training
  const htmlBodyExpired = `
    <p>
      If you are receiving this message, it's because your <u>annual</u> Research Security Training in accordance with Federal Research Requirements has <b>expired</b> according to ICC records.
      SPO now requires that the AOR certify your completion of this training annually prior to submitting a proposal for federal funding.
    </p>

    <p>
      The CITI training website is
      <a href="https://about.citiprogram.org/">HERE</a>,
      and you can register under Michigan Tech if you have not already done so.
      This is specifically for the <b>Research Security Training (Combined)</b>.
      The training has not been added as "required" so you will need to add it manually.
      Instructions for doing this may be found
      <a href="[Internal training instructions link]?tab=t.0">HERE</a>.
    </p>

    <p>
      <span style="color:red; font-weight:bold;">After completing the training</span>,
      download the completion certificate(s) from citiprogram.org, and email the certificate
      to <a href="mailto:researchsecurity@your-org.edu">researchsecurity@your-org.edu</a>
      and <a href="mailto:admin-team@university.edu">admin@your-org.edu</a>.
      Please reach out to us at
      <a href="mailto:admin-team@university.edu">admin-team@university.edu</a>
      if you have any questions or concerns.
    </p>

    <p>
      Thank you!<br>
      ICC Admin
    </p>
  `;

  // ADDED: separate plain text body for expired training
  const plainBodyExpired = `
If you are receiving this message, it's because your annual Research Security Training in accordance with Federal Research Requirements has expired according to ICC records. SPO now requires that the AOR certify your completion of this training annually prior to submitting a proposal for federal funding.

The CITI training website is HERE:
https://about.citiprogram.org/

You can register under Michigan Tech if you have not already done so. This is specifically for the Research Security Training (Combined). The training has not been added as "required" so you will need to add it manually. Instructions for doing this may be found HERE:
https://docs.google.com/document/d/example-training-instructions/edit

After completing the training, download the completion certificate(s) from citiprogram.org, and email the certificate to research-training@university.edu and admin-team@university.edu. Please reach out to us at admin-team@university.edu if you have any questions or concerns.

Thank you!
ICC Admin
  `;

  let sentCount = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const name = String(row[nameCol] || '').trim();
    const email = String(row[emailCol] || '').trim();
    const completionDate = row[completionCol];
    const expirationDate = row[expirationCol];

    const rowLabel = `Row ${i + 1}${name ? ` (${name})` : ''}`;

    if (!email) {
      Logger.log(`${rowLabel}: skipped because email is blank`);
      continue;
    }

    // CHANGED: split needsReminder (old) into separate flags
    let isMissing = false;
    let isExpired = false;
    const reasons = [];

    if (!completionDate || String(completionDate).trim() === '') {
      isMissing = true;
      reasons.push('missing completion date');
    }

    if (isValidDate(expirationDate)) {
      const exp = new Date(expirationDate);
      exp.setHours(0, 0, 0, 0);

      if (exp < today) {
        isExpired = true;
        reasons.push('expired training');
      }
    } else if (expirationDate && String(expirationDate).trim() !== '') {
      Logger.log(`${rowLabel}: expiration date exists but is NOT a valid Date object`);
    }

    // checks both flags
    if (!isMissing && !isExpired) {
      continue;
    }

    //chooses email body based on whether training is expired
    let finalPlainBody;
    let finalHtmlBody;

    if (isExpired) {
      finalPlainBody = plainBodyExpired;
      finalHtmlBody = htmlBodyExpired;
    } else {
      finalPlainBody = plainBodyMissing;
      finalHtmlBody = htmlBodyMissing;
    }

    Logger.log(`${rowLabel}: sending email because ${reasons.join(', ')}`);

    // CHANGED: sends selected email body instead of one fixed body
    GmailApp.sendEmail(email, subject, finalPlainBody, {
      htmlBody: finalHtmlBody,
      name: 'ICC Admin Team',
      cc: 'admin-team@university.edu'
    });
    sentCount++;
    Logger.log(`Email sent to: ${email}`);
  }

  Logger.log(`Total emails sent: ${sentCount}`);

  if (sentCount === 0) {
    Logger.log('No reminder emails were sent.');
  }
}

function isValidDate(value) {
  return Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime());
}
