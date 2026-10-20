# Security Specification: Yayasan Al Ikhlas Sembilan Satu

## 1. Data Invariants
- `members`:
  - Contains records of applicants and registered foundation members.
  - Public registration (`create`) is permitted with status set to `'menunggu'`.
  - Approved status changes or member deletion are governed by administrators or authenticated member updates to their allowed fields.
  - Document IDs must conform to alphanumeric formatting (`isValidId`).
  - Strict key checks and length limits on all text fields prevent injection attacks.
- `notifications`:
  - System and admin real-time broadcasts for registrations and approvals.
  - Created on status update or registration. Read status can be updated.

## 2. Dirty Dozen Threat Payloads (Targeting Vulnerabilities)
1. **Payload 1: Privilege Escalation on Register**: Attempting to insert a new member directly with `status: 'disetujui'`. Must be blocked.
2. **Payload 2: ID Poisoning**: Member document with 10KB string ID. Must be rejected by `isValidId()`.
3. **Payload 3: Ghost Field Injection**: Registering member with shadow boolean `isAdmin: true`. Must be rejected by strict schema validation.
4. **Payload 4: Empty NIK**: Submitting member without 16-character NIK. Must be rejected.
5. **Payload 5: Giant String DoS Attack**: Submitting 50MB payload in `nama` or `alamat`. Must be rejected by `.size() <= MAX` boundary checks.
6. **Payload 6: Unauthorized Role Spoofing**: Setting `peranKeluarga` to `'superadmin'`. Must be rejected by enum validation.
7. **Payload 7: Invalid Notification Type**: Creating notification with type `'hacked_system'`. Must be rejected.
8. **Payload 8: Non-boolean Read Status**: Updating notification `read` field to string `'yes'`. Must be rejected.
9. **Payload 9: Path Traversal ID**: Creating member with id `../../evil`. Must be blocked by `isValidId`.
10. **Payload 10: Deletion of members by unauthorized users**: Deleting member without proper authorization. Must fail.
11. **Payload 11: Missing Required Fields**: Adding member without `noKk` or `peranKeluarga`. Must be rejected.
12. **Payload 12: Notification Timestamp Tampering**: Injecting excessive or invalid timestamp strings. Must be rejected.
