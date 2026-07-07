# Backend capabilities & UI wiring notes

Endpoints added/upgraded during the autonomous backend run. All are live-probed
against the real account (kreisrastatt / student role) — shapes are grounded, not
guessed. UI wiring is left to the design owner; this is the contract.

## Courses — richer data + starred (B1 + B2)

`GET /api/courses` now returns, per course:

```jsonc
{
  "CourseId": 4349,
  "Title": "…",
  "Code": "…",
  "FriendlyName": "…",   // short name, may be null
  "Color": "#rrggbb",     // theme colour, may be null
  "FillColor": "#rrggbb", // secondary colour, may be null
  "TaskCount": 3,          // open tasks, may be null on pre-migration rows
  "IsStarred": true,       // favourite
  "LastVisitedAt": null    // reserved (not yet written)
}
```

- Populated by a full **sync** (`POST /api/sync`) from `courses/v3` + the cards
  endpoints. Courses synced before this change have null enrichment until re-sync.
- **Toggle favourite:** `PUT /api/courses/{itslearningId}/favorite` with body
  `{ "favorite": true|false }` → `{ CourseId, IsStarred }`. Idempotent (reconciles
  to the desired state via the upstream toggle). 401/404/400 handled.
  - Suggested UI: a star button on course cards; sort/section starred first using
    `IsStarred`.

## Notifications (B3 + B4)

- `GET /api/notifications/counts` → `{ unreadNotifications, unseenNotifications,
  unreadMessages }` — bare-integer counts for nav badges.
- `GET /api/notifications` now returns `notifications/v2` items:
  `{ NotificationId, Text, PublishedDate, PublishedBy, Type, Url, ContentUrl,
  IsRead, IsAnonymous }`. Render read/unread styling off `IsRead`.
- `POST /api/notifications/seen` — marks all notifications seen (clears the
  unseen badge). No body. Returns `{ ok: true }`.

## People (C5)

- `GET /api/person` → the signed-in person with **capability flags** the UI can
  use to hide unavailable features:
  `{ PersonId, FullName, ProfileImageUrl, CanAccessCalendar,
  CanAccessMessageSystem, CanAccessInstantMessageSystem, CanAccessCourses, … }`.
- `GET /api/courses/{itslearningId}/participants` → course roster with per-person
  progress: `{ PersonId, FullName, Role, PictureUrl, LastVisited,
  CompletedTasks, TotalTasks, CanHaveTasks, Groups }`. Enrolment-scoped (404 if
  the user is not in the course).

## Messages (D2 — read only)

- `GET /api/messages` → instant-message threads (inbox), `messagethreads/v1`:
  `{ InstantMessageThreadId, Name, Type, Created, CreatedBy, LastMessage,
  Messages, Participants, ParticipantsCount, LastReadInstantMessageId, IsBlocked }`.
  Read-only; empty array if the account can't access instant messages.
  Gate visibility on `person.CanAccessInstantMessageSystem`.

## Bulletins (C2)

- Existing `GET /api/courses/{id}/bulletins` is unchanged at runtime but now
  typed as `LightBulletin[]`:
  `{ LightBulletinId, Text, Pinned, AllowComments, HasResources, ResourcesCount,
  CommentsCount, ActiveFromDate, ActiveToDate, IsSubscribed, PublishedDate,
  PublishedBy }`.

## Intentionally NOT built (dead for a student account — live-probed)

These returned 403/404 for this role; don't wire UI for them:

| Feature | Endpoint | Result |
|---|---|---|
| Workload (C3) | `workload/courses/{id}/v1`, `workload/assignments/…` | 403 |
| Planner (C4) | `planner/v1`, `studentplan/overview/v1` | 404 |
| Progress/objectives (C6) | `studentplan/achievementgoals/active/v1`, `courses/{id}/progressreport/criteria/v1` | 404 |
| Personal drive (D3) | `yourfiles/v1`, `personalfolders/v1` | 404 |
| Task status toggle (C1) | `POST assignments/{elementId}/tasks/status/v1` | 403 — "does not have evaluate permission" (teacher-only) |
| Daily agenda (C1) | `tasklistdailyworkflow/v1` | 200 but empty (Total 0) |
| Follow-up tasks (B6) | `tasks/followuptasks/v1` | 200 but empty (Total 0) |

## Write endpoints implemented but not live-fired

- `POST /api/notifications/seen` (mark all seen) — benign, not exercised against
  the account to avoid clearing the user's real unseen state. Contract is the
  documented `notifications/seenmark/all/v1`.

The favourite toggle (`toggleFavorite/v1`) WAS live-verified (toggled a course and
restored it; account state unchanged).
