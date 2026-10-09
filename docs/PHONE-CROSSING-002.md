# GrO × TRANSPORT-COMPOSITION-002 — Two Phones, First Real Crossing

**Status:** experimental native Android source. Hardware delivery is **not proven** until two physical phones execute this exact build, and the Android CI must compile it before distribution.

This is GrO's first deliberately **phone-native** surface. GrO's existing JS/TENET game engine is retained unchanged. The Android companion is a separate Gradle project at `android/`.

## Hardware/API requirements

- Two Android phones running Android 8+ with Bluetooth LE; BLE advertiser support is optional on some phones.
- Both phones must support Android **Wi-Fi Direct (Wi-Fi P2P)** for the payload path. Wi-Fi Direct does not require internet, but it requires permissions and may require device Location services enabled for discovery, even on newer Android.
- Android 12+ prompts for Bluetooth scan/advertise/connect permissions.
- Android 13+ prompts for `NEARBY_WIFI_DEVICES`. Android 12 and below require fine location permission for Wi-Fi Direct discovery. Permission refusal means no radio work.
- Foreground-only demonstration: no background service, no hidden scanning, no auto-pairing or auto-execution.
- Android framework APIs used: `BluetoothLeAdvertiser`, `BluetoothLeScanner`, `WifiP2pManager`, `ServerSocket`/`Socket`, and a user-selected document picker.

## Build and install

CI: `GrO Android Crossing 002` builds `app-debug.apk` and runs Android JVM verifier tests. Its successful run attaches the **gro-crossing-002-debug-apk** artifact. The app is a debug/development build, not a Play Store or release-signed application.

Alternatively, using JDK 17, Android SDK 35 and Gradle 8.13:

```bash
cd android
gradle :app:assembleDebug :app:testDebugUnitTest
adb install app/build/outputs/apk/debug/app-debug.apk
```

If you have a standard Gradle wrapper locally, it can be used instead; this experiment does not commit the wrapper JAR. The GitHub Actions workflow provisions Gradle itself.

## First field test

1. On a computer, create a demo **genuinely signed** reLATTE CrossingEnvelope v0. This tiny ASCII-only exporter is meant for fixture creation, **not** a replacement for reLATTE's normative canonicalization library:

   ```bash
   node examples/phone-crossing-002.mjs > phone-crossing.json
   ```

2. Make `phone-crossing.json` accessible to Phone A via USB, the device Files app or a trusted transfer. The private source key is **not exported** by the script. Repeat with any genuine signed JSON crossing produced by reLATTE itself once available.
3. Install and open the app on **both** phones; grant nearby-device permissions. Turn on Wi-Fi, Bluetooth and device Location services as applicable.
4. Tap *Advertise GrO Bluetooth beacon* on Phone B, then *Scan Bluetooth GrO beacons* on Phone A. If the hardware supports advertising, Phone A should report seeing the GrO service UUID `8fbdefa1-0dc1-4614-962b-21bf0a31d926`. **This does not automatically pair or authenticate the peer**.
5. On both phones tap *Discover Wi-Fi Direct peers*. Tap the correct peer on one phone and approve Android's P2P connection request. The connected **group owner** runs the receiving TCP server (port 38842).
6. On the connected **non-owner** phone (Phone A or B, whichever Android chooses), select `phone-crossing.json` through the document picker, confirm its signature and crossing ID are verified, then tap *Send crossing to connected group owner*.
7. The receiving phone checks the magic/version, byte length, SHA-256 integrity, canonical signing body, reLATTE crossing identity, and WebCrypto-compatible P-256 signature, **before** writing the unchanged JSON to its local private app inbox.
8. The sender displays delivery success only after the receiver acknowledges storage. Both phones should explicitly state that the crossing is **not admitted**. If any validation fails, there is no success acknowledgment.

*Actual BLE/Wi-Fi device behavior is phone-specific.* This needs real-device observation before claims about interoperability, performance, timeout recovery or network reliability.

## Security and legal boundaries

The phone sends an *already signed* `relatte.crossing-envelope/v0`. The Android verifier checks:

- 256 KiB maximum input;
- UTF-8, RFC 8785/JCS canonical identity body, schema and known fields;
- exact `crossing_id` SHA-256 domain separation;
- P-256 public key coordinates from a public JWK;
- ECDSA SHA-256 signature over the original reLATTE crossing signing domain;
- Node/WebCrypto's raw 64-byte `r || s` signature translated to Java's DER ECDSA representation;
- packet-level length, version and SHA-256 commitment.

The app **does not** identify or trust the *person* behind the valid signature. It proves only that the crossing signature matches the embedded key. There is **no key enrollment or independent peer-fingerprint pinning** in this first phone app. Its Wi-Fi Direct socket is an unauthenticated transport carrying signed bytes, **not end-to-end encrypted application networking**. Nearby attackers may create nuisance connections, attempt denial of service, or infer traffic metadata. Do not transfer private payloads or privileged VM-004 execution grants in this prototype.

The local Android inbox is not an R3 `LocalReceiver`, an authority store, an auto-admission layer or a signed route-observation reporter. Neither the BLE beacon nor the Wi-Fi Direct socket confers application permissions. Stored JSON stays under the app's private files; future GrO integration must **explicitly propose** it into locality-specific HOLD/ADMIT/REFUSE decisions.

The first experiment currently transfers one bounded JSON crossing as one Wi-Fi Direct framed message (BLE carries discovery only). It does **not** implement multi-carrier fragment migration, durable resume across failed phone links, multihop Wi-Fi mesh, modem audio, cellular SMS, LoRa, ham radio, or a native Android radio scheduler. TRANSPORT-COMPOSITION-001 in reLATTE supplies the separate executable **simulation** of eight transport roads; this native 002 is the first hardware-facing adapter.

## Tests

- Existing GrO Node/TENET tests run untouched.
- Android JVM unit tests independently generate valid ECDSA/P256 signed crossings, verify identity and signature, and deny tampering, bogus JSON and oversize payloads.
- CI also generates a crossing using **Node's own P-256 signing**; Android JVM verifies those exact bytes, preventing Java-only self-confirmation.
- Android APK compile confirms API symbols, permissions and Kotlin compatibility, but cannot prove that BLE advertising, P2P pairing, Wi-Fi socket delivery or permissions will work on a specific pair of handsets.
- Real field proof requires two device logs with identities, carrier observations, matching crossing IDs, failure tests, and explicit owner-local non-admission.

## Next slice: PHYSICAL-003

Implement a real Bluetooth packet data carrier in addition to Wi-Fi Direct, persist numbered chunks and separately signed per-transport observations, enable disconnected resumption of the *same* canonical crossing, and connect the verified inbox to GrO's local TENET admission interface without granting transport authority. Only a real test will establish mixed-physical-route reconstruction.
