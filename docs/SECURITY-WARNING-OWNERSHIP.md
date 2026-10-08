# Security warning ownership plan

Approved by Joe Melendez on October 8, 2026, for documentation. This covers the 37 open package warnings, which all sit in build and test tools.

| Group | Technical owner | Risk / tracking owner | Review | Fix target |
|---|---|---|---|---|
| Critical and high build/test warnings | Project maintainer | Joe Melendez | Oct 8, 2026 | Oct 14, 2026 |
| Moderate and low build/test warnings | Project maintainer | Joe Melendez | Oct 8, 2026 | Oct 21, 2026 |
| Platform-managed warnings without an upstream fix | Lovable | Joe Melendez | First review Oct 14, 2026, then weekly | Nov 4, 2026 |

Exposure: these packages run only during builds, previews, tests and CI. They never run in the browser or on the live server.

Repository action: not authorized. Production: BLOCKED.
