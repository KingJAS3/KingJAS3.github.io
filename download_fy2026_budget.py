"""
FY2026 DoD Budget — Machine-Readable File Downloader (All Services)
Downloads all available XML, JSON, and Excel files for FY2026 budget justification.

Sources:
  Army:         https://www.asafm.army.mil/Budget-Materials/
  Air Force:    https://www.saffm.hq.af.mil/FM-Resources/Budget/Air-Force-Presidents-Budget-FY26/
  Defense-Wide: https://comptroller.war.gov/Budget-Materials/FY2026BudgetJustification/
  DoD Summary:  https://comptroller.war.gov/Budget-Materials/Budget2026/

NOTE ON NAVY: The Department of the Navy (secnav.navy.mil) does NOT publish
machine-readable (XML/JSON) J-Books for FY2026. Navy budget justification is
PDF-only. If Navy adds machine-readable files in the future, add them to this script.

Usage:
    python download_fy2026_budget.py

Files will be saved to ./fy2026_budget/<Service>/<Category>/<filename>
"""

import os
import time
import urllib.request
import urllib.error
import urllib.parse

OUTPUT_DIR = "fy2026_budget"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
}


# ═══════════════════════════════════════════════════════════════════════════
# ARMY — from asafm.army.mil
# Base URL pattern:
#   https://www.asafm.army.mil/Portals/72/Documents/BudgetMaterial/2026/
#   Discretionary Budget/<category>/<filename>.<ext>
# ═══════════════════════════════════════════════════════════════════════════
ARMY_BASE = "https://www.asafm.army.mil/Portals/72/Documents/BudgetMaterial/2026/Discretionary%20Budget"

ARMY_FILES = [
    # ── Military Personnel ─────────────────────────────────────────────
    ("Military Personnel", "Military Personnel Army Volume 1",               "xml"),
    ("Military Personnel", "Reserve Personnel Army Volume 1",                "xml"),
    ("Military Personnel", "National Guard Personnel Army Volume 1",         "xml"),

    # ── Operation and Maintenance ──────────────────────────────────────
    ("Operation and Maintenance", "Regular Army Operation and Maintenance Volume 1",  "json"),
    ("Operation and Maintenance", "Regular Army Operation and Maintenance Volume 2",  "json"),
    ("Operation and Maintenance", "Reserve Army Operation and Maintenance Overview",  "xml"),
    ("Operation and Maintenance", "Reserve Army Operation and Maintenance",            "xml"),
    ("Operation and Maintenance", "National Guard Army Operation and Maintenance Overview", "xml"),
    ("Operation and Maintenance", "National Guard Army Operation and Maintenance",    "xml"),

    # ── Procurement ────────────────────────────────────────────────────
    ("Procurement", "Aircraft Procurement Army",                             "xml"),
    ("Procurement", "Missile Procurement Army",                              "xml"),
    ("Procurement", "Other Procurement - BA1 - Tactical & Support Vehicles", "xml"),
    ("Procurement", "Other Procurement - BA2 - Communications & Electronics", "xml"),
    ("Procurement", "Other Procurement - BA 3, 4 & 6 - Other Support Equipment, Initial Spares and Agile Portfolio Management", "xml"),
    ("Procurement", "Procurement of Ammunition",                             "xml"),
    ("Procurement", "Procurement of Weapons and Tracked Combat Vehicles",    "xml"),

    # ── RDTE ───────────────────────────────────────────────────────────
    ("rdte", "RDTE - Vol 1 - Budget Activity 1",  "xml"),
    ("rdte", "RDTE - Vol 1 - Budget Activity 2",  "xml"),
    ("rdte", "RDTE - Vol 1 - Budget Activity 3",  "xml"),
    ("rdte", "RDTE - Vol 2 - Budget Activity 4A", "xml"),
    ("rdte", "RDTE - Vol 2 - Budget Activity 4B", "xml"),
    ("rdte", "RDTE - Vol 3 - Budget Activity 5A", "xml"),
    ("rdte", "RDTE - Vol 3 - Budget Activity 5B", "xml"),
    ("rdte", "RDTE - Vol 3 - Budget Activity 5C", "xml"),
    ("rdte", "RDTE - Vol 3 - Budget Activity 5D", "xml"),
    ("rdte", "RDTE - Vol 4 - Budget Activity 6",  "xml"),
    ("rdte", "RDTE - Vol 4 - Budget Activity 7",  "xml"),
    ("rdte", "RDTE - Vol 4 - Budget Activity 8",  "xml"),
    ("rdte", "RDTE - Vol 4 - Budget Activity 9",  "xml"),

    # ── Military Construction ──────────────────────────────────────────
    ("Military Construction", "Regular Army Military Construction, Army Family Housing and Homeowners Assistance", "xml"),
    ("Military Construction", "Reserve Army Military Construction",          "xml"),
    ("Military Construction", "National Guard Army Military Construction",   "xml"),
    ("Military Construction", "Base Realignment and Closure Account",        "xml"),

    # ── Working Capital Fund ───────────────────────────────────────────
    ("awcf", "Army Working Capital Fund",                                    "xml"),

    # ── Chemical Agents & Munitions Destruction ────────────────────────
    ("camdd", "Chemical Agents and Munitions Destruction, Defense",          "xml"),

    # ── Cemeterial Expenses ────────────────────────────────────────────
    ("U.S. Army Cemeterial Expenses and Construction",
     "U.S. Army Cemeterial Expenses and Construction",                       "xml"),

    # ── Other Funds ────────────────────────────────────────────────────
    ("Other Funds", "Counter-Islamic State of Iraq and Syria Train and Equip Fund", "xml"),
]


# ═══════════════════════════════════════════════════════════════════════════
# AIR FORCE & SPACE FORCE — from saffm.hq.af.mil
# All files are XML. URL pattern:
#   https://www.saffm.hq.af.mil/Portals/84/documents/FY26/<filename>.xml
# ═══════════════════════════════════════════════════════════════════════════
AF_BASE = "https://www.saffm.hq.af.mil/Portals/84/documents/FY26"

AF_FILES = [
    # ── BRAC ───────────────────────────────────────────────────────────
    ("BRAC", "FY26 Base Realignment and Closure", "xml"),

    # ── Military Construction ──────────────────────────────────────────
    ("MILCON", "FY26 Air Force MILCON",              "xml"),
    ("MILCON", "FY26 Air National Guard MILCON",     "xml"),
    ("MILCON", "FY26 Air Force Reserve MILCON",      "xml"),

    # ── Military Personnel ─────────────────────────────────────────────
    ("MILPERS", "FY26 Air Force MILPERS",            "xml"),
    ("MILPERS", "FY26 Air National Guard MILPERS",   "xml"),
    ("MILPERS", "FY26 Air Force Reserves MILPERS",   "xml"),
    ("MILPERS", "FY26 Space Force MILPERS",          "xml"),

    # ── Operation & Maintenance ────────────────────────────────────────
    ("O&M", "FY26 Air Force Operations and Maintenance Vol I",              "xml"),
    ("O&M", "FY26 Air Force Operations and Maintenance Vol II",             "xml"),
    ("O&M", "FY26 Air National Guard Operation and Maintenance Vol I",      "xml"),
    ("O&M", "FY26 Air National Guard Operation and Maintenance Vol II",     "xml"),
    ("O&M", "FY26 Air Force Reserve Operations and Maintenance Vol I",      "xml"),
    ("O&M", "FY26 Air Force Reserve Operations and Maintenance Vol II",     "xml"),
    ("O&M", "FY26 Space Force Operations and Maintenance Vol I",            "xml"),
    ("O&M", "FY26 Space Force Operations and Maintenance Vol II",           "xml"),

    # ── Procurement ────────────────────────────────────────────────────
    ("Procurement", "FY26 Air Force Aircraft Procurement Vol I",     "xml"),
    ("Procurement", "FY26 Air Force Aircraft Procurement Vol II",    "xml"),
    ("Procurement", "FY26 Air Force Ammunition Procurement",         "xml"),
    ("Procurement", "FY26 Air Force Missile Procurement",            "xml"),
    ("Procurement", "FY26 Air Force Other Procurement",              "xml"),
    ("Procurement", "FY26 Space Force Procurement",                  "xml"),

    # ── RDTE ───────────────────────────────────────────────────────────
    ("RDTE", "FY26 Air Force Research and Development Test and Evaluation Vol I",   "xml"),
    ("RDTE", "FY26 Air Force Research and Development Test and Evaluation Vol II",  "xml"),
    ("RDTE", "FY26 Air Force Research and Development Test and Evaluation Vol III", "xml"),
    ("RDTE", "FY26 Space Force Research and Development Test and Evaluation Vol I",  "xml"),
    ("RDTE", "FY26 Space Force Research and Development Test and Evaluation Vol II", "xml"),
]


# ═══════════════════════════════════════════════════════════════════════════
# DEFENSE-WIDE — from comptroller.war.gov (JSON format)
# These are individual agency OP-5 exhibits plus volume-level compilations
# URL base:
#   https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/
#   budget_justification/pdfs/<section>/<subsection>/<filename>.json
# ═══════════════════════════════════════════════════════════════════════════
DW_BASE = "https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/budget_justification/pdfs"

DW_FILES = [
    # ── O&M Volume compilations ────────────────────────────────────────
    ("O&M", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "OM_Volume1_Part1",       "json"),
    ("O&M", "01_Operation_and_Maintenance/O_M_VOL_1_PART_2", "OM_Volume1_Part_2",      "json"),
    ("O&M", "01_Operation_and_Maintenance/O_M_VOL_2",        "Volume_2",               "json"),

    # ── O&M Volume 1 Part 1 — Individual Agency OP-5 exhibits ─────────
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "Overview_(Part_1)",          "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "Summary_by_Agency_(Part_1)", "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "O-1_Summary_(Part_1)",       "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "OP-32A_Summary_(Part_1)",    "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "CMP_OP-5",                   "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "CYBERCOM_OP-5",              "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "CYBERCOM_Headquarters_OP-5", "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "Cyberspace_Operations_OP-5", "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DAU_OP-5",                   "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DCAA_Cyber_OP-5",            "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DCAA_OP-5",                  "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DCMA_Cyber_OP-5",            "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DCMA_OP-5",                  "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DCSA_Cyber_OP-5",            "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DCSA_OP-5",                  "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DHRA_Cyber_OP-5",            "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DHRA_OP-5",                  "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DISA_Cyber_OP-5",            "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DISA_OP-5",                  "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DLA_OP-5",                   "json"),
    ("O&M_Agencies", "01_Operation_and_Maintenance/O_M_VOL_1_PART_1", "DLSA_OP-5",                  "json"),

    # ── BRAC ───────────────────────────────────────────────────────────
    ("BRAC", "05_BRAC", "FY2026_BRAC_Overview", "xml"),
]


# ═══════════════════════════════════════════════════════════════════════════
# DOD SUMMARY — Excel & JSON from comptroller.war.gov top level
# ═══════════════════════════════════════════════════════════════════════════
DOD_SUMMARY = [
    # Excel summary display files
    ("https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/m1_display.xlsx",
     "DoD_Summary", "FY2026_M1_Military_Personnel.xlsx"),
    ("https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/o1_display.xlsx",
     "DoD_Summary", "FY2026_O1_Operation_Maintenance.xlsx"),
    ("https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/rf1_display.xlsx",
     "DoD_Summary", "FY2026_RF1_Revolving_Management_Fund.xlsx"),
    ("https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/p1_display.xlsx",
     "DoD_Summary", "FY2026_P1_Procurement.xlsx"),
    ("https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/p1r_display.xlsx",
     "DoD_Summary", "FY2026_P1R_Procurement_Reserve.xlsx"),
    ("https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/r1_display.xlsx",
     "DoD_Summary", "FY2026_R1_RDTE.xlsx"),
    ("https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/c1.xlsx",
     "DoD_Summary", "FY2026_C1_MilCon_FamilyHousing_BRAC.xlsx"),

    # JSON initiative files
    ("https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/FY2026_Pacific_Deterrence_Initiative.json",
     "DoD_Summary", "FY2026_Pacific_Deterrence_Initiative.json"),
    ("https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/FY2026_Drug_Interdiction_and_Counter-Drug_Activities.json",
     "DoD_Summary", "FY2026_Drug_Interdiction_Counter_Drug.json"),
]


# ═══════════════════════════════════════════════════════════════════════════
# Helper functions
# ═══════════════════════════════════════════════════════════════════════════

def safe_filename(name):
    """Strip characters that are illegal in file/folder names on most OSes."""
    for ch in r'\/:*?"<>|':
        name = name.replace(ch, "_")
    return name


def download_file(url, dest_path):
    """Download a single file with browser-like headers. Returns (success, message)."""
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
        with open(dest_path, "wb") as f:
            f.write(data)
        size_kb = len(data) / 1024
        return True, f"{size_kb:.1f} KB"
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except urllib.error.URLError as e:
        return False, str(e.reason)
    except Exception as e:
        return False, str(e)


def print_result(label, ok, msg):
    status = "OK" if ok else "FAIL"
    print(f"  [{status:4s}]  {label[:72]:<72}  {msg}")


# ═══════════════════════════════════════════════════════════════════════════
# Main download logic
# ═══════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 80)
    print("FY2026 DoD Budget — Machine-Readable File Downloader")
    print("Covers: Army, Air Force, Space Force, Defense-Wide, DoD Summary")
    print("Note:   Navy is PDF-only and not included")
    print("=" * 80)

    success_count = 0
    fail_count = 0
    failures = []

    # ── 1. Army XML/JSON ──────────────────────────────────────────────
    print(f"\n[1/4] Army ({len(ARMY_FILES)} files)...")
    for category, filename, ext in ARMY_FILES:
        encoded = urllib.parse.quote(f"{category}/{filename}.{ext}")
        url = f"{ARMY_BASE}/{encoded}"
        out_path = os.path.join(OUTPUT_DIR, "Army", safe_filename(category),
                                safe_filename(filename) + "." + ext)
        ok, msg = download_file(url, out_path)
        label = f"Army/{category}/{filename}.{ext}"
        print_result(label, ok, msg)
        if ok:
            success_count += 1
        else:
            fail_count += 1
            failures.append((label, url, msg))
        time.sleep(0.3)

    # ── 2. Air Force & Space Force XML ────────────────────────────────
    print(f"\n[2/4] Air Force & Space Force ({len(AF_FILES)} files)...")
    for category, filename, ext in AF_FILES:
        encoded_name = urllib.parse.quote(f"{filename}.{ext}")
        url = f"{AF_BASE}/{encoded_name}"
        out_path = os.path.join(OUTPUT_DIR, "AirForce", safe_filename(category),
                                safe_filename(filename) + "." + ext)
        ok, msg = download_file(url, out_path)
        label = f"AF/{category}/{filename}.{ext}"
        print_result(label, ok, msg)
        if ok:
            success_count += 1
        else:
            fail_count += 1
            failures.append((label, url, msg))
        time.sleep(0.3)

    # ── 3. Defense-Wide JSON/XML ──────────────────────────────────────
    print(f"\n[3/4] Defense-Wide ({len(DW_FILES)} files)...")
    for item in DW_FILES:
        category, path, filename, ext = item
        url = f"{DW_BASE}/{path}/{filename}.{ext}"
        out_path = os.path.join(OUTPUT_DIR, "DefenseWide", safe_filename(category),
                                safe_filename(filename) + "." + ext)
        ok, msg = download_file(url, out_path)
        label = f"DW/{category}/{filename}.{ext}"
        print_result(label, ok, msg)
        if ok:
            success_count += 1
        else:
            fail_count += 1
            failures.append((label, url, msg))
        time.sleep(0.3)

    # ── 4. DoD Summary Excel & JSON ───────────────────────────────────
    print(f"\n[4/4] DoD Summary ({len(DOD_SUMMARY)} files)...")
    for url, subfolder, fname in DOD_SUMMARY:
        out_path = os.path.join(OUTPUT_DIR, subfolder, fname)
        ok, msg = download_file(url, out_path)
        print_result(fname, ok, msg)
        if ok:
            success_count += 1
        else:
            fail_count += 1
            failures.append((fname, url, msg))
        time.sleep(0.3)

    # ── Summary ───────────────────────────────────────────────────────
    total = success_count + fail_count
    print("\n" + "=" * 80)
    print(f"Done. {success_count}/{total} files downloaded.")
    print(f"Output directory: {os.path.abspath(OUTPUT_DIR)}/")

    if failures:
        print(f"\nFailed ({fail_count}):")
        for label, url, msg in failures:
            print(f"  FAIL  {label}")
            print(f"        URL: {url}")
            print(f"        Reason: {msg}")
    else:
        print("\nAll files downloaded successfully!")


if __name__ == "__main__":
    main()
