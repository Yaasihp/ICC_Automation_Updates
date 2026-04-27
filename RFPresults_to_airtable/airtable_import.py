

from __future__ import annotations
import argparse
import hashlib
import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import requests

try:
    
    from   import 
    INTEGRATIONS_DIR =
except Exception:
    # Fallback if imported outside the full package context
    BASE_DIR =
    FACULTY_DIRS = 
    DATA_DIR =


# =========================
# Airtable configuration
# =========================

def load_airtable_token() -> str:
    return os.getenv("AIRTABLE_TOKEN", "").strip()
    
AIRTABLE_TOKEN = load_airtable_token()
AIRTABLE_BASE_ID = 
AIRTABLE_TABLE_ID =

# Local state file to prevent duplicate imports across runs
STATE_FILE =
MISSING_TABLE_LOG = 
# Airtable API
AIRTABLE_URL = 

# Exact Airtable field names
AIRTABLE_FIELDS = [
    "Funding Agency",
    "Program Name",
    "Focus Area",
    "Award Range",
    "Website Link",
    "Deadline",
]

# Flexible header normalization
HEADER_ALIASES: Dict[str, str] = {
    # Funding Agency
    "funding agency": "Funding Agency",
    "agency": "Funding Agency",
    "funding source": "Funding Agency",
    "sponsor": "Funding Agency",
    "sponsoring agency": "Funding Agency",

    # Program Name
    "program name": "Program Name",
    "program": "Program Name",
    "opportunity": "Program Name",
    "opportunity name": "Program Name",
    "rfp": "Program Name",
    "solicitation": "Program Name",
    "solicitation name": "Program Name",
    "grant program": "Program Name",

    # Focus Area
    "focus area": "Focus Area",
    "research area": "Focus Area",
    "topic area": "Focus Area",
    "area": "Focus Area",
    "program focus": "Focus Area",
    "description": "Focus Area",

    # Award Range
    "award range": "Award Range",
    "award amount": "Award Range",
    "funding amount": "Award Range",
    "budget range": "Award Range",
    "amount": "Award Range",
    "award": "Award Range",

    # Website Link
    "website link": "Website Link",
    "link": "Website Link",
    "url": "Website Link",
    "website": "Website Link",
    "opportunity link": "Website Link",
    "program link": "Website Link",

    # Deadline
    "deadline": "Deadline",
    "due date": "Deadline",
    "submission deadline": "Deadline",
    "closing date": "Deadline",
    "application deadline": "Deadline",
}

def log_missing_table(md_file: Path) -> None:
    ensure_directories()
    with open(MISSING_TABLE_LOG, "a", encoding="utf-8") as f:
        f.write(f"{md_file}\n")

def setup_logging(verbose: bool = False) -> logging.Logger:
    ensure_directories()

    level = logging.DEBUG if verbose else logging.INFO

    logger = logging.getLogger("airtable_import")
    logger.setLevel(level)

    # Clear existing handlers
    logger.handlers = []

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    console_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))

    # File handler
    file_handler.setLevel(level)
    file_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger


logger = setup_logging()


def ensure_directories() -> None:
    LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOCAL_LOGS_DIR.mkdir(parents=True, exist_ok=True)


def load_state() -> Dict[str, bool]:
    ensure_directories()
    if not STATE_FILE.exists():
        return {}
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return {str(k): bool(v) for k, v in data.items()}
    except Exception as exc:
        logger.warning("Could not read state file %s: %s", STATE_FILE, exc)
    return {}


def save_state(state: Dict[str, bool]) -> None:
    ensure_directories()
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, sort_keys=True)


def validate_airtable_config() -> None:
    if not AIRTABLE_TOKEN:
        raise ValueError(
            "AIRTABLE_TOKEN is missing. Set it as an environment variable."
        )
    if not AIRTABLE_BASE_ID:
        raise ValueError("AIRTABLE_BASE_ID is missing.")
    if not AIRTABLE_TABLE_ID:
        raise ValueError("AIRTABLE_TABLE_ID is missing.")


def normalize_header(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip().lower())
    cleaned = cleaned.replace("*", "")
    return HEADER_ALIASES.get(cleaned, text.strip())


def extract_url(value: str) -> str:
    """Extract URL from markdown link or raw text."""
    if not value:
        return ""

    value = value.strip()

    # Markdown link: [text](url)
    md_match = re.search(r"\[[^\]]*\]\((https?://[^)]+)\)", value)
    if md_match:
        return md_match.group(1).strip()

    # Raw URL
    raw_match = re.search(r"https?://\S+", value)
    if raw_match:
        return raw_match.group(0).rstrip(").,;")

    return value


def clean_cell(value: str) -> str:
    if value is None:
        return ""
    value = value.strip()
    value = re.sub(r"<br\s*/?>", "; ", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def split_md_row(line: str) -> List[str]:
    """
    Basic markdown table splitter.
    Assumes regular markdown tables without escaped pipes inside cells.
    """
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip() for cell in stripped.split("|")]


def is_separator_row(cells: List[str]) -> bool:
    if not cells:
        return False
    return all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells)


def find_table_blocks(content: str) -> List[List[str]]:
    """
    Return blocks of consecutive pipe-prefixed lines.
    """
    lines = content.splitlines()
    blocks: List[List[str]] = []
    current: List[str] = []

    for line in lines:
        if line.strip().startswith("|"):
            current.append(line)
        else:
            if current:
                blocks.append(current)
                current = []

    if current:
        blocks.append(current)

    return blocks


def choose_best_table_block(blocks: List[List[str]]) -> Optional[List[str]]:
    """
    Prefer the first block whose header matches any expected funding-table-like columns.
    """
    best_block: Optional[List[str]] = None
    best_score = -1

    for block in blocks:
        if len(block) < 2:
            continue

        header_cells = split_md_row(block[0])
        normalized = [normalize_header(cell) for cell in header_cells]

        score = sum(1 for h in normalized if h in AIRTABLE_FIELDS)
        if score > best_score:
            best_score = score
            best_block = block

    return best_block if best_score >= 2 else None


def parse_markdown_table(content: str) -> Tuple[List[Dict[str, str]], Optional[List[str]]]:
    """
    Parse the most relevant markdown table from content.
    Returns:
      - list of normalized Airtable-row dicts
      - original normalized header list used
    """
    if "<think>" in content and "</think>" in content:
        content = content.split("</think>")[-1]

    blocks = find_table_blocks(content)
    if not blocks:
        return [], None

    block = choose_best_table_block(blocks)
    if not block:
        return [], None

    rows = [split_md_row(line) for line in block if line.strip()]
    if len(rows) < 2:
        return [], None

    header = [normalize_header(h) for h in rows[0]]

    data_start_index = 1
    if len(rows) > 1 and is_separator_row(rows[1]):
        data_start_index = 2

    normalized_rows: List[Dict[str, str]] = []

    for row_cells in rows[data_start_index:]:
        if len(row_cells) == 0:
            continue

        # Pad or trim row length to header length
        if len(row_cells) < len(header):
            row_cells += [""] * (len(header) - len(row_cells))
        elif len(row_cells) > len(header):
            row_cells = row_cells[:len(header)]

        raw_row = {
            header[i]: clean_cell(row_cells[i])
            for i in range(len(header))
        }

        mapped = {
            "Funding Agency": clean_cell(raw_row.get("Funding Agency", "")),
            "Program Name": clean_cell(raw_row.get("Program Name", "")),
            "Focus Area": clean_cell(raw_row.get("Focus Area", "")),
            "Award Range": clean_cell(raw_row.get("Award Range", "")),
            "Website Link": extract_url(raw_row.get("Website Link", "")),
            "Deadline": clean_cell(raw_row.get("Deadline", "")),
        }

        # Skip blank rows
        if not any(mapped.values()):
            continue

        # Require at least a minimally useful record
        if not mapped["Program Name"] and not mapped["Funding Agency"]:
            continue

        normalized_rows.append(mapped)

    return normalized_rows, header


def build_row_key(md_file: Path, row: Dict[str, str]) -> str:
    """
    Stable local key used for dedupe across runs.
    Includes file path + core row values.
    """
    raw = json.dumps(
        {
            "file": md_file.name,
            "funding_agency": row.get("Funding Agency", ""),
            "program_name": row.get("Program Name", ""),
            "focus_area": row.get("Focus Area", ""),
            "award_range": row.get("Award Range", ""),
            "website_link": row.get("Website Link", ""),
            "deadline": row.get("Deadline", ""),
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def discover_markdown_files(root: Path) -> List[Path]:
    if not root.exists():
        logger.warning("Faculty directory does not exist: %s", root)
        return []
    return sorted(root.rglob("*.md"))


def rows_from_markdown_file(md_file: Path) -> Tuple[List[Dict[str, str]], Dict[str, str]]:
    """
    Parse one markdown file and attach source metadata for logging.
    """
    try:
        content = md_file.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        logger.error("Failed to read file")
        return [], {"file": str(md_file), "error": str(exc)}

    rows, headers = parse_markdown_table(content)

    if not rows:
        logger.warning("No markdown funding table found in file: %s", md_file.name)

    meta = {
        "file": str(md_file),
        "headers_detected": ", ".join(headers) if headers else "",
        "row_count": str(len(rows)),
    }
    return rows, meta


def make_airtable_records(rows: List[Dict[str, str]]) -> List[Dict]:
    records = []
    for row in rows:
        fields = {field: str(row.get(field, "") or "") for field in AIRTABLE_FIELDS}
        records.append({"fields": fields})
    return records


def upload_records(records: List[Dict], dry_run: bool = False) -> Tuple[int, int]:
    """
    Upload records to Airtable in batches of 10.
    Returns: (uploaded_count, failed_count)
    """
    if not records:
        return 0, 0

    if dry_run:
        logger.info("DRY RUN: would upload %d records", len(records))
        return len(records), 0

    headers = {
        "Authorization": f"Bearer {AIRTABLE_TOKEN}",
        "Content-Type": "application/json",
    }

    uploaded = 0
    failed = 0

    for i in range(0, len(records), 10):
        batch = records[i:i + 10]
        payload = {"records": batch}

        try:
            response = requests.post(AIRTABLE_URL, headers=headers, json=payload, timeout=60)
        except requests.RequestException as exc:
            logger.error("Network error uploading batch %d: %s", (i // 10) + 1, exc)
            failed += len(batch)
            continue

        if response.status_code in (200, 201):
            uploaded += len(batch)
            logger.info("Uploaded batch %d successfully (%d records)", (i // 10) + 1, len(batch))
        else:
            failed += len(batch)
            logger.error(
                "Batch %d failed with status %s",
                (i // 10) + 1,
                response.status_code,
            )
    return uploaded, failed


def collect_new_rows(
    faculty_dir: Path,
    state: Dict[str, bool],
    reimport_all: bool = False,
) -> Tuple[List[Dict[str, str]], Dict[str, Dict[str, str]]]:
    """
    Scan markdowns and return rows not already imported.
    """
    markdown_files = discover_markdown_files(faculty_dir)

    all_new_rows: List[Dict[str, str]] = []
    file_summaries: Dict[str, Dict[str, str]] = {}

    for md_file in markdown_files:
        rows, meta = rows_from_markdown_file(md_file)
        file_summaries[str(md_file)] = meta

        if not rows:
            logger.warning("No usable table rows found in %s", md_file.name)
            log_missing_table(md_file)
            continue

        for row in rows:
            row_key = build_row_key(md_file, row)
            if not reimport_all and state.get(row_key):
                continue

            row_with_meta = dict(row)
            row_with_meta["_state_key"] = row_key
            row_with_meta["_source_file"] = md_file.name
            all_new_rows.append(row_with_meta)

    return all_new_rows, file_summaries


def run_import(dry_run: bool = False, reimport_all: bool = False) -> int:
    validate_airtable_config()
    ensure_directories()

    state = load_state()
    logger.info("Using input directory")
    logger.info("Using Airtable table")

    rows, summaries = collect_new_rows(FACULTY_DIRS, state, reimport_all=reimport_all)

    if summaries:
        logger.info("Scanned %d markdown files", len(summaries))

    if not rows:
        logger.info("No new rows to import.")
        return 0

    logger.info("Found %d new row(s) to import", len(rows))

    # Prepare Airtable payload
    clean_rows = []
    imported_state_keys = []

    for row in rows:
        clean_rows.append({
            "Funding Agency": row["Funding Agency"],
            "Program Name": row["Program Name"],
            "Focus Area": row["Focus Area"],
            "Award Range": row["Award Range"],
            "Website Link": row["Website Link"],
            "Deadline": row["Deadline"],
        })
        imported_state_keys.append(row["_state_key"])

    records = make_airtable_records(clean_rows)
    uploaded, failed = upload_records(records, dry_run=dry_run)

    if failed == 0:
        for key in imported_state_keys:
            state[key] = True
        save_state(state)
        logger.info("Import complete. Uploaded %d record(s).", uploaded)
        return 0

    # Partial success handling:
    # only mark all as imported if there were no failures.
    logger.warning(
        "Import finished with some failures. Uploaded=%d Failed=%d. "
        "State file was not fully advanced for safety.",
        uploaded,
        failed,
    )
    return 1


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import faculty markdown RFP tables into Airtable.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse files and report what would be uploaded without sending to Airtable.",
    )
    parser.add_argument(
        "--reimport-all",
        action="store_true",
        help="Ignore local state and re-import all discovered markdown rows.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug logging.",
    )
    return parser


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()

    global logger
    logger = setup_logging(verbose=args.verbose)

    try:
        return run_import(dry_run=args.dry_run, reimport_all=args.reimport_all)
    except Exception as exc:
        logger.exception("Airtable import failed: %s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
