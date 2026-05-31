# Sample Site Twins

These files are browser-served sample `SecurityScene` payloads used for import demos and upload validation.

- `jewelry-store-site-twin.json` is intentionally preserved as the public jewelry-store upload sample.
- The Create Site Twin import panel links this jewelry-store sample alongside `/sample-security-scene-import.json`; both files must remain valid JSON draft-review inputs.
- `/sentineltwin_upload_test_jewelry_store.json` at the repo root is a legacy manual-upload copy of the same payload. Keep the two files byte-for-byte identical until the legacy root artifact is explicitly retired.
- `apps/studio/src/fixtures/sentineltwin_upload_test_jewelry_store.json` is a separate parser fixture with fixture-specific provenance and should not be treated as the same artifact.

The mirror contract is covered by `apps/studio/src/schema/__tests__/sample-site-twin-upload.test.ts`.
