# The MInd of Nox

Using 11ty, netlfiy functions (if necessary).

## Case Files/Blog Posts

Posts are stored in `www/posts` in the following format

`[year]-[month]-[day]-[case_id].md`

where:

- year is the 4 digit year: 2026
- month is a 2 digit represetitation: 04
- day is a 2 digit representation: 08
- case_id is slugified

The case id is in the following format: `[year][type]-[case_number].[session_number]`

where

- year is a 2 digit representation: 26
- type is one of 8 possible case types
  - GEN - general topics (not case files)
  - EXT - extraction cases
  - NEU - neutralization cases
  - TRC - trace and surveilance cases
  - REC - recovery cases
  - SAN - sanitation cases
  - VET - vetting cases
  - CON - containment cases
- case number is a 3 digit value representing how many cases of the type we've taken on starting at 001
- session number is a 3 digit value representing how many 'posts' are made for the given case starting at 000 for session 0 notes.

The permalink of the post is defined in the post on the yaml data as follows:

`permalink: "field-notes/{{ slug }}/{{ session_num | padSuffix }}/index.html"`

## Categories

- Example (GEN-001)
- Announcement (GEN-000)
- Off Topic (GEN-002)
- Field Notes (Session Notes)
- Surveillance (Recorded Actual Plays)
- Incident Reports (Short Stories)
