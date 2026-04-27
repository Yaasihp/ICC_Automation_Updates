/**
 * Fetches internal deadlines from the MTU Research Deadline Table
 * @param {string} dateStr - The anchor date in YYYY-MM-DD format
 * @return {Object} Object containing cleaned dates for Full Budget, Tier 1, and Tier 2
 */
function fetchMTUInternalDeadlines(dateStr) {
  const endpoint = "https://example.edu/path/to/deadline-table-endpoint";
  
  const options = {
    method: "post",                
    payload: { selected_date: dateStr },
    muteHttpExceptions: true
  };

  try {
    const resp = UrlFetchApp.fetch(endpoint, options);
    const html = resp.getContentText();
    const parsed = parseDeadlineTable_(html);
    
    // Clean the dates, only returns MM/DD/YYYY
    return {
      fullBudget: parsed.fullBudget ? parsed.fullBudget.split(' ')[0] : null,
      tier1: parsed.tier1 ? parsed.tier1.split(' ')[0] : null,
      tier2: parsed.tier2 ? parsed.tier2.split(' ')[0] : null
    };
  } catch (e) {
    console.error("Fetch failed: " + e.message);
    return { fullBudget: null, tier1: null, tier2: null };
  }
}

/**
 * HTML parser using regex
 */
function parseDeadlineTable_(html) {
  var out = { fullBudget: null, tier1: null, tier2: null };
  var rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
  var m;

  while ((m = rowRegex.exec(html)) !== null) {
    var row = m[1];
    var tdRegex = /<td>([\s\S]*?)<\/td>/g;
    var td1 = tdRegex.exec(row);
    var td2 = tdRegex.exec(row);

    if (!td1 || !td2) continue;

    var deadlineText = stripTags_(td1[1]).trim();
    var docText = stripTags_(td2[1]).trim();

    if (docText.indexOf("Full Budget Draft") !== -1) {
      out.fullBudget = deadlineText;
    } else if (docText.indexOf("Tier 1") !== -1) {
      out.tier1 = deadlineText;
    } else if (docText.indexOf("Tier 2") !== -1) {
      out.tier2 = deadlineText;
    }
  }
  return out;
}

function stripTags_(s) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}
function testDeadlineFetcher() {
 
  const testDate = "2026-03-12";
  console.log("Testing API fetch for date: " + testDate);
  
  const results = fetchMTUInternalDeadlines(testDate);
  
  if (results) {
    console.log("--- TEST RESULTS ---");
    console.log("Full Budget Date: " + (results.fullBudget || "NOT FOUND"));
    console.log("Tier 1 Date: " + (results.tier1 || "NOT FOUND"));
    console.log("Tier 2 Date: " + (results.tier2 || "NOT FOUND"));
    
    
    if (results.fullBudget === "02/25/2026") console.log("Full Budget matches!");
    if (results.tier1 === "03/04/2026") console.log("Tier 1 matches!");
    if (results.tier2 === "03/10/2026") console.log("Tier 2 matches!");
  } else {
    console.log("Test failed: No data returned.");
  }
}
