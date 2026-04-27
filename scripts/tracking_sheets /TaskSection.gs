
/**
 * **** start OF addSectionWithNotes UPDATES***
*/

function addSectionWithNotes(sheet, startRow, sectionTitle, tasksWithNotes, fetchedDate) {
    // formula logic is replaced with the direct date from fetcher
    sheet.getRange(startRow, 1).setValue(sectionTitle);
    const dateVal = fetchedDate ? new Date(fetchedDate) : null;
    sheet.getRange(startRow, 3).setValue(dateVal || "Date Not Found");
    if (dateVal) sheet.getRange(startRow, 3).setNumberFormat('MM/dd/yyyy');

  //NEW changed from 3 to 4
    sheet.getRange(startRow, 1, 1, 4)
        .setFontWeight('bold')
        .setBackground('#d9d9d9');

    const sectionHeaderRow = startRow;
    startRow++;

    const firstTaskRow = startRow;

    const taskNames = Object.keys(tasksWithNotes);
    taskNames.forEach(task => {
        sheet.getRange(startRow, 1).setValue(task);

        const statusRule = SpreadsheetApp.newDataValidation()
            .requireValueInList(['Not Started', 'In Progress', 'Completed', 'Not Applicable'], true)
            .setAllowInvalid(false)
            .build();
        const statusCell = sheet.getRange(startRow, 2);
        statusCell.setDataValidation(statusRule);
        statusCell.setValue('Not Started');

        // This keeps the sub-tasks linked to the main section date
        sheet.getRange(startRow, 3).setFormula(`=C${sectionHeaderRow}`);
        sheet.getRange(startRow, 3).setNumberFormat('MM/dd/yyyy');
    
     // changed 4 to 5 UPDATES***
     
        const note = tasksWithNotes[task];
        if (note) {
            sheet.getRange(startRow, 5).setValue(note);
        }


      //Owner dropdown in column 4***
     
        const ownerRule = SpreadsheetApp.newDataValidation()
          .requireValueInList(['Not Stated', 'SPO', 'PI', 'Institute', 'Other'], true)
          .setAllowInvalid(false)
          .build();

        const ownerCell = sheet.getRange(startRow, 4);
        ownerCell.setDataValidation(ownerRule);
        ownerCell.setValue('Not Stated');

        startRow++;
    });


/**
 * **** END OF addSectionWithNotes UPDATES***
 * */

    const lastTaskRow = startRow - 1;
    if (lastTaskRow >= firstTaskRow) {
        sheet.getRange(firstTaskRow, 1, lastTaskRow - firstTaskRow + 1, 1).shiftRowGroupDepth(1);
    }

    startRow++;
    return startRow;
}


/**
 * **** start OF addSection UPDATES***
 * */

function addSection(sheet, startRow, sectionTitle, tasks, fetchedDate) {
    sheet.getRange(startRow, 1).setValue(sectionTitle);
    const dateVal = fetchedDate ? new Date(fetchedDate) : null;
    sheet.getRange(startRow, 3).setValue(dateVal || "Date Not Found");
    if (dateVal) sheet.getRange(startRow, 3).setNumberFormat('MM/dd/yyyy');

 //NEW changed from 3 to 4
    sheet.getRange(startRow, 1, 1, 4)
        .setFontWeight('bold')
        .setBackground('#d9d9d9');

    const sectionHeaderRow = startRow;
    startRow++;

/**
 * ****NEW END OF addSection UPDATES***
 * */  
    const firstTaskRow = startRow;

    let subrecipientStartRow = null;
    let inSubrecipientGroup = false;

    tasks.forEach((task, index) => {
        sheet.getRange(startRow, 1).setValue(task);

        if (task.includes('Subrecipient Paperwork')) {
            sheet.getRange(startRow, 1).setFontWeight('bold');
            subrecipientStartRow = startRow + 1;
            inSubrecipientGroup = true;
        } else {
            const statusRule = SpreadsheetApp.newDataValidation()
                .requireValueInList(['Not Started', 'In Progress', 'Completed', 'Not Applicable'], true)
                .setAllowInvalid(false)
                .build();
            const statusCell = sheet.getRange(startRow, 2);
            statusCell.setDataValidation(statusRule);
            statusCell.setValue('Not Started');

            sheet.getRange(startRow, 3).setFormula(`=C${sectionHeaderRow}`);
            sheet.getRange(startRow, 3).setNumberFormat('MM/dd/yyyy');
             // Owner dropdown + default UPDATE
            const ownerRule = SpreadsheetApp.newDataValidation()
              .requireValueInList(['Not Stated', 'SPO', 'PI', 'Institute', 'Other'], true)
              .setAllowInvalid(false)
              .build();

            const ownerCell = sheet.getRange(startRow, 4);
            ownerCell.setDataValidation(ownerRule);
            ownerCell.setValue('Not Stated');
           

        }


        

        if (inSubrecipientGroup && index < tasks.length - 1) {
            const nextTask = tasks[index + 1];
            if (!nextTask.startsWith('  ')) {
                if (subrecipientStartRow && startRow >= subrecipientStartRow) {
                    const group = sheet.getRowGroup(subrecipientStartRow, 1);
                    if (!group) {
                        sheet.getRange(subrecipientStartRow, 1, startRow - subrecipientStartRow + 1, 1).shiftRowGroupDepth(1);
                    }
                }
                inSubrecipientGroup = false;
                subrecipientStartRow = null;
            }
        }

        startRow++;
    });

    if (inSubrecipientGroup && subrecipientStartRow) {
        sheet.getRange(subrecipientStartRow, 1, startRow - subrecipientStartRow, 1).shiftRowGroupDepth(1);
    }

    const lastTaskRow = startRow - 1;
    if (lastTaskRow >= firstTaskRow) {
        sheet.getRange(firstTaskRow, 1, lastTaskRow - firstTaskRow + 1, 1).shiftRowGroupDepth(1);
    }

    startRow++;
    return startRow;
}

/**
 * ****addPersonnelSection UPDATES***
 */
function addPersonnelSection(sheet, startRow, label, tasksWithNotes, fetchedDate) {
    sheet.getRange(startRow, 1).setValue(label);
    const dateVal = fetchedDate ? new Date(fetchedDate) : null;
    sheet.getRange(startRow, 3).setValue(dateVal || "Date Not Found");
    if (dateVal) sheet.getRange(startRow, 3).setNumberFormat('MM/dd/yyyy');

/**
 * **** END OF addPersonnelSection UPDATES***
 */



    sheet.getRange(startRow, 1, 1, 3)
        .setFontWeight('bold')
        .setBackground('#d9d9d9');

    const sectionHeaderRow = startRow;
    startRow++;

    const firstTaskRow = startRow;

    const taskNames = Object.keys(tasksWithNotes);
    taskNames.forEach(task => {
        sheet.getRange(startRow, 1).setValue(task);

        const statusRule = SpreadsheetApp.newDataValidation()
            .requireValueInList(['Not Started', 'In Progress', 'Completed', 'Not Applicable'], true)
            .setAllowInvalid(false)
            .build();
        const statusCell = sheet.getRange(startRow, 2);
        statusCell.setDataValidation(statusRule);
        statusCell.setValue('Not Started');

        sheet.getRange(startRow, 3).setFormula(`=C${sectionHeaderRow}`);
        sheet.getRange(startRow, 3).setNumberFormat('MM/dd/yyyy');

        // Add note if provided
        const note = tasksWithNotes[task];
        if (note) {
            sheet.getRange(startRow, 4).setValue(note);
        }

        startRow++;
    });

    const lastTaskRow = startRow - 1;
    if (lastTaskRow >= firstTaskRow) {
        sheet.getRange(firstTaskRow, 1, lastTaskRow - firstTaskRow + 1, 1).shiftRowGroupDepth(1);
    }

    startRow++;
    return startRow;
}
