# Security Specification - Study Cove Portal S1 MPAI

This specification defines the security architecture and constraints for the Firestore database of Study Cove.

## Data Invariants

1. **Announcements (`/announcements/{id}`)**:
   - Must contain a title, content, writer, and createdAt timestamp.
   - Read: Allowed for any signed-in user.
   - Write: Allowed only for Admin users.

2. **Schedules (`/schedules/{id}`)**:
   - Must contain day, subject, time, lecturer, and room.
   - Read: Allowed for any signed-in user.
   - Write: Allowed only for Admin users.

3. **Treasury (`/treasury/{id}`)**:
   - Class Treasury logs tracking payments.
   - Read: Allowed for any signed-in user (transparency).
   - Write: Allowed only for Admin users.

4. **Library (`/library/{id}`)**:
   - Reference books or articles.
   - Read: Allowed for any signed-in user.
   - Write: Allowed only for Admin users.

5. **Groups (`/groups/{id}`)**:
   - Study/Project groups.
   - Read: Allowed for any signed-in user.
   - Write: Allowed only for Admin users.

6. **Assignments Submissions (`/assignments/{id}`)**:
   - Task submissions tracking and reports.
   - Read: Allowed for all signed-in users for academic transparency.
   - Create: Allowed for any authenticated student. The payload author details must be authenticated.
   - Delete/Update: Allowed only for Admin users or the original submitter.

---

## The "Dirty Dozen" Malicious Payloads

The following payloads attempt to violate security boundaries and must be rejected:

1. **Unauthenticated Announcement Write**: Write to `/announcements/123` with no header.
2. **Student Announcement Spoofing**: Signed-in non-admin student attempts to write an announcement.
3. **Admin Self-Elevation**: Normal user attempts to write to `/admins/{uid}` to elevate themselves.
4. **Invalid Announcement Key Size**: Ghost fields injection (`{ title: "Hello", content: "content", ghost: "attack", writer: "Admin" }`).
5. **Timestamp Hijack on Creation**: Attempting to supply a spoofed historic timestamp for `createdAt` instead of using the server's `request.time`.
6. **Incorrect ID Injection**: Attacker injects a 1MB corrupted string as an Assignment ID or Schedule ID.
7. **Bypassing Schedule Write**: Non-admin attempts to clean schedules or insert custom schedules.
8. **Malicious Group Update**: Student attempts to edit Group details (e.g. changing members or name) despite Groups being read-only.
9. **Fake Group Deletion**: regular user attempting to delete an Academic Group card.
10. **Treasury Tampering**: normal student updates treasury items to log themselves as "Lunas" (Paid) with a custom payment nominal.
11. **Library Resource Poisoning**: Non-admin writes an arbitrary malicious bookmark to `/library/{id}` files.
12. **Assignment Deletion on Sibling**: User A attempts to delete or alter User B's assignment submission.

---

## Production Security Rules Configuration

These principles will be fully applied in `/firestore.rules`.
