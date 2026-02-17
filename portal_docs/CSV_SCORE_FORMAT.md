# CSV Score Export Format

Guide for bowling center staff exporting score CSVs for import into the SFGGC portal.

## Required Columns

The CSV must include these columns (exact header names):

| Column | Description |
|---|---|
| **Bowler name** | Full name, must match IGBO registration exactly |
| **Scratch** | Scratch score for the game |
| **Game number** | `1`, `2`, or `3` |
| **Team name** | Team name (team event) or lane label (doubles/singles) |
| **Lane number** | Lane number |
| **Game name** | Event identifier with prefix letter (see below) |

Extra columns (HDCP, Strike count, etc.) are ignored and do not need to be removed.

## Game Name Prefix

The **Game name** column must contain a prefix letter that identifies the event type:

| Prefix | Event | Example Game name |
|---|---|---|
| `T` | Team | `02/14 2:30 PM  T1-Teams 1` |
| `D` | Doubles | `02/14 2:30 PM  D1-Doubles 1` |
| `S` | Singles | `02/14 2:30 PM  S1-Singles 1` |

The system reads the first `T`, `D`, or `S` followed by a digit and dash (e.g., `T1-`, `D2-`, `S3-`) to detect the event type. If the prefix doesn't match the event type selected by the admin, the import is blocked with a mismatch error.

## Team Name Column

This column behaves differently by event type:

| Event | Team name value | Example |
|---|---|---|
| **Team** | Actual team name | `Day One Crew` |
| **Doubles** | Lane label | `Lane 7` |
| **Singles** | Lane label | `Lane 7` |

The system recognizes `Lane N` values as lane identifiers and skips team comparison for those rows. This means:

- **Team CSVs**: Team name is used to cross-reference against the database and to disambiguate bowlers with the same name on different teams.
- **Doubles/Singles CSVs**: Team name is ignored for matching. If two bowlers share the same name, they cannot be disambiguated and will appear as "unmatched" in the preview.

## Bowler Name Matching

Names are matched against IGBO registration data. The system tries:

1. `first_name + last_name` (exact, case-insensitive)
2. `nickname + last_name` (if a nickname is on file)

Names that don't match appear in the preview as "unmatched" before import. Common causes:
- Name spelled differently than IGBO registration
- Suffixes like "Jr" or "II" included in one source but not the other
- Compound first names (e.g., "Clint Andrew" vs "Clint")

## File Structure

- One row per bowler per game
- All 3 games can be in one file, or uploaded separately (game 1 first, games 2-3 later)
- The system merges by bowler name -- later imports fill in missing games without overwriting existing scores
- One file per event type (do not mix team and doubles scores in the same file)

## Example

A complete team CSV with 2 bowlers and 3 games has 6 data rows:

```
Bowler name,Scratch,Game number,Team name,Lane number,Game name,...
Ronald Hua,189,1,Day One Crew,4,02/14 2:30 PM  T1-Teams 1,...
Ronald Hua,210,2,Day One Crew,4,02/14 2:30 PM  T2-Teams 2,...
Ronald Hua,175,3,Day One Crew,4,02/14 2:30 PM  T3-Teams 3,...
Kellen Parker,224,1,Day One Crew,4,02/14 2:30 PM  T1-Teams 1,...
Kellen Parker,198,2,Day One Crew,4,02/14 2:30 PM  T2-Teams 2,...
Kellen Parker,211,3,Day One Crew,4,02/14 2:30 PM  T3-Teams 3,...
```

A doubles CSV for game 1 only:

```
Bowler name,Scratch,Game number,Team name,Lane number,Game name,...
Peter Grady,124,1,Lane 7,7,02/14 2:30 PM  D1-Doubles 1,...
Dan Fahy,132,1,Lane 7,7,02/14 2:30 PM  D1-Doubles 1,...
```

---

# Optional Events CSV

Guide for importing optional event opt-in flags into the SFGGC portal.

## Required Columns

The CSV must include these columns (exact header names):

| Column | Description |
|---|---|
| **EID** | IGBO participant ID (maps to `people.pid`) |
| **Last** | Last name (used for fallback matching) |
| **First** | First name (used for fallback matching) |
| **Best 3 of 9** | `1` = opted in, blank or `0` = not opted in |
| **Optional Scratch** | `1` = opted in, blank or `0` = not opted in |
| **All Events Hdcp** | `1` = opted in, blank or `0` = not opted in |

Extra columns are ignored and do not need to be removed.

### Accepted Header Aliases

Some column headers accept alternate names:

| Standard | Also accepted |
|---|---|
| Last | Last name, Last Name |
| First | First name, First Name |
| All Events Hdcp | All Events Handicapped |

## Matching Rules

The system matches CSV rows to participants in this order:

1. **Primary -- EID match:** The CSV `EID` column is compared against `people.pid` in the database
2. **Fallback -- Name match:** If EID is not found, the system normalizes `First` + `Last` and looks for a unique match. If multiple participants share the same name, the row is reported as unmatched

Unmatched rows are shown in the preview and skipped during import.

## Replace-All Semantics

Unlike the score and lane CSV imports (which use null-preservation), the optional events import uses **replace-all** logic:

- Participants in the CSV get their flags set to the CSV values
- Participants **not** in the CSV have all opt-in flags set to `0`

This means the CSV should contain the complete list of opted-in participants each time it is imported.

## Duplicate Handling

- **Identical duplicates** (same EID, same flags): Deduplicated with a warning
- **Conflicting duplicates** (same EID, different flags): Import is blocked with an error

## Example

A CSV with 3 participants, each opting into different events:

```
EID,Last,First,Best 3 of 9,Optional Scratch,All Events Hdcp
12345,Hua,Ronald,1,1,1
12346,Parker,Kellen,1,0,1
12347,Grady,Peter,0,1,0
```

## Import Workflow

1. Go to `/portal/admin/optional-events`
2. Click the import button
3. Select the CSV file
4. Review the preview (matched participants, unmatched rows, warnings)
5. Confirm import

The admin page also provides a visibility toggle to control whether participants can view Optional Events standings.
