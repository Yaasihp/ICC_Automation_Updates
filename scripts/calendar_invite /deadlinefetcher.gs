/**
 * Fetches internal deadlines from the MTU Research Deadline Table
 * @param {string} dateStr - The anchor date in YYYY-MM-DD format
 * @return {Object} { fullBudget, tier1, tier2 } in MM/DD/YYYY or null
 */

function fetchMTUInternalDeadlines(dateStr) {
  const endpoint = "https://www.mtu.edu/mtu_resources/php/research/deadline-table/index.php";

  const options = {
    method: "post",
    payload: { selected_date: dateStr },
    muteHttpExceptions: true
  };

  try {
    const resp = UrlFetchApp.fetch(endpoint, options);
    const html = resp.getContentText();

    const parsed = parseDeadlineTable_(html);

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

function parseDeadlineTable_(html) {
  const out = { fullBudget: null, tier1: null, tier2: null };
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
  let m;

  while ((m = rowRegex.exec(html)) !== null) {
    const row = m[1];
    const tdRegex = /<td>([\s\S]*?)<\/td>/g;
    const td1 = tdRegex.exec(row);
    const td2 = tdRegex.exec(row);

    if (!td1 || !td2) continue;

    const deadlineText = stripTags_(td1[1]).trim();
    const docText = stripTags_(td2[1]).trim();

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
