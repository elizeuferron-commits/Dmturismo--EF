# Security Specification - Gestão DM Turismo

## Data Invariants
1. A **Trip** must have a valid `vehicleId`, `driverId`, and `status`. Only managers can create/delete trips. Drivers can only update status/notes of their assigned trips.
2. **Financial Transactions** must have a valid `type`, `amount`, and `status`. Revisions are only allowed for managers.
3. **Users** can self-register as 'driver' but cannot escalate their own role to 'manager' or 'admin'.
4. **Vehicles** can be updated by drivers for odometer/status changes, but only managers can change core plate/model info.

## The Dirty Dozen Payloads (Target: Access Control & Integrity)

1. **Self-Escalation**: Driver attempts to update their own role to 'admin'.
2. **Ghost Trip**: Unauthorized user attempts to create a trip document.
3. **Orphaned Transaction**: User attempts to create a financial transaction without required fields.
4. **Identity Spoofing**: User A attempts to update a trip assigned to User B.
5. **Unauthorized Trip Deletion**: Authenticated user (non-manager) attempts to delete a trip. (This is what we are fixing).
6. **Price Tampering**: Driver attempts to update the 'amount' field of a financial transaction.
7. **Plate Sabotage**: Driver attempts to update the license plate of a vehicle.
8. **Invalid Status Injection**: User attempts to set a trip status to 'invalid_status'.
9. **Bypassing Terminal State**: Manager attempts to update a completed maintenance log (unless admin).
10. **Shadow Field Injection**: User attempts to add a 'isVerified: true' field to their user profile.
11. **Resource Exhaustion**: User attempts to use a 1MB string for a plate number.
12. **Unauthorized Message Deletion**: Non-manager attempts to delete a dashboard message.

## Test Runner Logic
Expected result for all the above: `PERMISSION_DENIED`.
Specifically for #5: `deleteDoc(doc(db, 'trips', 'some-id'))` by a non-manager should fail.
And #5 for a MANAGER should succeed (the fix).
