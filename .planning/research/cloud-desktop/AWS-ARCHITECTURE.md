# AWS Re-Architecture — Cloud Desktop (E5) on AWS + Amazon DCV

> **Status:** DECISION DOC — overrides RFC.md §2 (provisioning) and §3 (streaming transport).
> Keeps RFC §1 (product shape), §4 (in-app component), §5 (lifecycle capabilities), §6 (tenancy/security) intact
> and re-expresses them on AWS. Feeds `/gsd:new-milestone` exactly like the RFC: the §"Revised Phase Plan"
> below is written in ROADMAP.md house style so it lifts directly.
> **Researched:** 2026-07-20. Live sources cited inline. Pricing is us-east-1 / eu-central-1 on-demand as of
> mid-2026 — re-verify at CD-1 planning (this space churns).
> **The override in one sentence:** the user mandates AWS, least tooling, no new subscriptions, and realtime
> feel; **Amazon DCV** (AWS's own remote-display protocol) satisfies all four at once where the RFC's
> Hetzner + Selkies + Cloudflare Calls stack needed three vendors and a community-maintained transport.

---

## 0. The decision, up front

| Question | RFC answer (overridden) | This doc's answer |
|---|---|---|
| Where does the VM run | Hetzner Cloud | **AWS EC2** (user hard constraint; existing IaC) |
| Streaming protocol | Selkies-GStreamer (WebRTC) | **Amazon DCV** (AWS-native, free on EC2) |
| Client transport | WebRTC data/media | **DCV Web Client SDK** (WSS/WebSocket + WebCodecs decode) |
| NAT traversal | Cloudflare Calls TURN | **None** — direct Elastic IP + security group |
| Default OS | Ubuntu (Selkies is Linux-native) | **Ubuntu 24.04** (native Docker; Windows available) |
| GPU/NVENC | software x264 now | software now, **g4dn/g6 NVENC** as a same-day shape swap |
| Vendors in the path | AWS-not-used + Hetzner + Selkies + Cloudflare | **AWS only** |

**Streaming pick:** Amazon DCV — because it is the *one* protocol that is AWS-native (free on EC2, zero
extra vendors), ships an official browser Web Client SDK **and** iframe embedding, auto-accelerates with
NVENC on GPU shapes, runs on both Ubuntu and Windows, and whose external `authToken` model drops straight
into the RFC's short-lived session-token handoff.

---

## 1. Streaming protocol — the core decision + scorecard

Scored against the user's verbatim constraints: AWS-native, least latency, least tooling, no new
subscriptions, in-app (must render inside a Next.js surface — iframe or canvas), Windows+Linux, GPU/NVENC.

| Axis | **Amazon DCV** | Sunshine + Moonlight | Raw WebRTC + GStreamer | Selkies-GStreamer (RFC) |
|---|---|---|---|---|
| **Latency (same-region)** | Excellent. Native client uses QUIC/UDP; browser client is WSS/TCP + WebCodecs HW decode — sub-frame same-region. [S1][S6] | **Best raw** (sub-30 ms, UDP-first, NVENC). [RFC FRONTIER-B] | Excellent potential (UDP/WebRTC) | Good (WebRTC) but WS is the *default* — must opt into WebRTC [RFC §3.1] |
| **Browser-embeddable (hard req)** | **Yes, first-class.** Official Web Client SDK (JS/TS, ES6) → first-party canvas client, no iframe; OR iframe with two config headers. [S2][S3] | **No.** Moonlight is a native client; browser ports (moonlight-wasm) are experimental, not production. **Disqualifying for in-app.** | Yes (you build the client) | Yes (HTML5 client) |
| **Cost on AWS** | **Free on EC2.** Server auto-detects EC2, checks license via S3 endpoint — no per-seat charge, no license server. [S1] | Free (OSS) | Free (OSS) | Free (OSS) |
| **Windows + Linux server** | **Both, first-class** (Windows + Ubuntu/AL2023/RHEL). [S1] | Both host, but Linux host needs a live X session | Both (you wire it) | Linux-only in practice |
| **GPU / NVENC** | **Automatic** on GPU instances; software encode with no GPU. [S7] | NVENC-first (needs GPU) | You wire NVENC | GStreamer nvenc plugin |
| **Maintenance burden** | **Lowest** — AWS-owned, versioned, documented; NICE→Amazon DCV rebrand 2024.0 shows active investment. [S5] | Community (LizardByte) — healthy but yours to track | **Highest** — you own signaling, encode, input, clipboard, auth | Community/academic — the RFC itself flagged this as an open risk [RFC §9.3] |
| **Extra vendors/tools** | **Zero** (all AWS: EC2 + S3 license + Route53/ACM) | 0 vendor, but a native client wrapper you must ship | 0 vendor, maximal build | +Cloudflare Calls (TURN) = **new subscription surface** [RFC §3.3] |
| **In-app verdict** | ✅ **WIN** | ❌ native client kills in-app | ⚠️ violates "less different stuff" | ⚠️ extra vendor + WS-default footgun + maintenance risk |

### Decision: **Amazon DCV.** Decisively.

It is the only option that is simultaneously (a) AWS-native and free-on-EC2, (b) browser-renderable via a
supported SDK, (c) NVENC-capable by config flip, and (d) single-vendor. It collapses the RFC's three-vendor
transport (Selkies + Cloudflare + not-AWS) into one thing the user already pays for.

### The one honest caveat (and why it doesn't change the pick)

The DCV **web browser client uses WebSocket/TCP, not QUIC/UDP** — QUIC is native-client only. [S6] On a
lossy/high-latency last mile (hotel Wi-Fi), a UDP protocol like Sunshine would degrade more gracefully.
Three reasons this loses to DCV for *this* product anyway:

1. **In-app is a hard requirement**, and Sunshine has no production browser client. A protocol we can't render
   inside polytoken scores zero regardless of transport.
2. **We control the server network** (AWS VPC + Elastic IP, §3) → direct same-region path, no relay hop. The
   RTT the RFC budgeted a TURN relay for (§3.3) mostly evaporates.
3. **Escape hatch exists in-family:** power users can attach the DCV *native* client (QUIC/UDP) to the same
   session for the lowest-possible-latency case — same vendor, same server, zero new tooling. So the "raw
   latency" crown Sunshine holds is reachable inside DCV without leaving AWS.

**The "significant motive" test:** nothing beats DCV enough for this use case to justify leaving AWS or adding
a vendor. Sunshine wins only on a raw-UDP metric that (a) we can't render in-app and (b) DCV's own native
client recovers when it matters. **No motive to change.** Ship DCV.

---

## 2. EC2 instance shapes + OS

### 2.1 CPU dev-desktop baseline (the default) — **m7i.2xlarge**, Ubuntu 24.04

| | Default: **m7i.2xlarge** | Floor: **m7i.xlarge** | Compute-lean alt: c7i.2xlarge |
|---|---|---|---|
| vCPU / RAM | 8 vCPU / 32 GiB | 4 vCPU / 16 GiB | 8 vCPU / 16 GiB |
| On-demand | **~$0.4032/h** (us-east-1) [S8] | ~$0.20/h | ~$0.357/h [S8] |
| Monthly 24/7 | ~$290 (but we never run 24/7 — §4 caps) | ~$145 | ~$257 |
| Fits | dev stack (Node + Supabase containers + browser + **software DCV encode ≈ 1–2 vCPU**) | light desktop, no full stack | dev stack, tighter RAM |

**Why m7i, not m8g (Graviton4):** Graviton is 10–20% cheaper [S9], but the dogfood clones and runs the
*polytoken* dev stack, whose container images and tooling are x86-first; an ARM desktop invites
arch-mismatch friction on the exact acceptance scenario. Default x86 (m7i); offer m8g as a cheaper shape for
ARM-native workloads later. **32 GiB not 16:** the RFC established the dev stack once killed an
under-resourced box (Docker + Supabase + dev server [RFC §1]); 32 GiB leaves headroom for stack + browser +
software encode. Software DCV encode costs ~1–2 vCPU at 1080p [S7], budgeted inside 8 vCPU.

### 2.2 GPU shape (only when NVENC/accelerated streaming is needed) — **g4dn.xlarge** entry, **g6.xlarge** for AV1

| | **g4dn.xlarge** (entry NVENC) | **g6.xlarge** (modern, AV1) | g6e.xlarge (heavy ML) |
|---|---|---|---|
| GPU | NVIDIA T4 (NVENC H.264/H.265) | NVIDIA L4 (2 encoders, **AV1** HW) | NVIDIA L40S (48 GB) |
| vCPU / RAM | 4 / 16 GiB | 4 / 16 GiB | 4 / 32 GiB |
| On-demand | **~$0.526/h** [S10] | **~$0.805/h** [S11] | ~$1.861/h [S12] |
| Use | free up CPU for the workload; smooth 1080p60 | AV1 = ~40% less bandwidth same quality [S13] | GPU compute, not just streaming |

DCV auto-selects NVENC on any of these — no pipeline change, just a bigger shape in `desktop.spawn`'s
`shape` field. **Recommendation:** ship CPU-default; keep g4dn.xlarge as the documented "make it buttery"
escape hatch and g6.xlarge when AV1 bandwidth savings matter. GPU is *not* on the critical path to the
dogfood (dev desktops are text/UI deltas, not 4K gaming — RFC §3.2 holds).

### 2.3 OS: **Ubuntu 24.04 default; Windows available**

The dogfood needs **real Docker** (local Supabase = containers [RFC §1]).

- **Ubuntu:** Docker runs **natively** — containers share the host kernel, **zero nested virtualization**.
  Lowest overhead, best "realtime feel", simplest cloud-init. DCV runs a **virtual (headless) session** —
  no physical GPU/monitor needed. **This is the default.**
- **Windows:** now *possible* — **EC2 added nested virtualization to non-metal instances in Feb 2026**
  (M7i/C7i/M8i/R8i etc., via the `NestedVirtualization` CPU option), so Docker Desktop/WSL2 finally works on
  a normal Windows EC2 instance without paying for a `.metal` host. [S14] But it carries the WSL2 tax
  (a Linux VM inside your Windows VM inside EC2) — more overhead for the *same* Docker outcome Ubuntu gives
  natively. Offer Windows as a `shape`/`os` choice for users who want a Windows desktop; **never** the
  dogfood default.

**Verdict:** Ubuntu 24.04 + native Docker + DCV virtual session is the least-overhead realtime path.

---

## 3. Networking / NAT — direct Elastic IP, no relay

We own the VPC, so the RFC's client-side NAT problem (which drove Cloudflare Calls TURN) **dissolves**:

- **The DCV server has a public Elastic IP.** The browser client opens **WSS directly to `EIP:8443`**
  (DCV's default TCP/WebSocket port [S6]). There is no peer-to-peer NAT negotiation to relay — it's a plain
  client→server TLS connection, like hitting any HTTPS endpoint. **TURN is not just optional, it's
  structurally absent.** Drop Cloudflare Calls entirely.
- **Security group = default-deny inbound**, allow only **8443/TCP** (and 8443/UDP if we later enable QUIC
  for native-client power users), sourced from our front door (see below), plus egress for the S3 license
  check.
- **TLS + per-session hostname:** WSS needs a valid cert. Use **one ACM wildcard cert** `*.desk.polytoken…`
  + a **Route53 A record per session** → that session's EIP. All AWS, one vendor, no Cloudflare.
- **Lowest-latency path:** user → same-region EIP, direct. Put the desktop in the region nearest the user
  (**eu-central-1 / Frankfurt** for the current user; the RFC's 20 ms RTT budget stands or improves).
- **DCV Connection Gateway** (AWS's optional reverse proxy that fronts many sessions behind one host [S6])
  is **deferred** — it earns its keep at multi-tenant density (hide instance IPs behind one domain), which
  is the same "future populate" tier the RFC assigned to container-desktops. For 1 VM = 1 owner, direct
  EIP + per-session DNS is simpler and lower-latency (one fewer hop).

**Revised latency budget (same-region, direct — measured in CD-2, not assumed):**

| Segment | Budget |
|---|---|
| capture + encode (software x264 1080p, or NVENC on GPU shape) | ≤ 15 ms |
| WSS RTT (user ↔ same-region EIP, direct) | ≤ 30 ms |
| WebCodecs HW decode + render in browser | ≤ 10 ms |
| **glass-to-glass (direct, browser/WSS)** | **≤ 55 ms** — "feels like a computer" |
| DCV native client (QUIC/UDP) escape hatch | lower still (sub-30 ms class) [RFC FRONTIER-B] |

---

## 4. Provisioning — `DesktopProvider` (AWS) implementation sketch

The substrate port already exists and is unchanged: `packages/capabilities/src/desktop.ts` defines
`DesktopProvider { spawn, attach, hibernate, destroy }`, the `failClosedDesktopProvider` default (every verb
throws until a real provider is bound), and the four `defineCapability()` descriptors — with
`reversibility: "irreversible"` **already shipped** on `desktop.spawn`/`desktop.destroy`. So the §5.2
"Risk-enum collision" the RFC carried as an open question is **already resolved in substrate**: the additive
optional `reversibility` field exists; the frozen R-04 `Risk` enum was not widened. CD-1 inherits this, it
does not re-litigate it.

The control plane (api-client) binds **`AwsDesktopProvider`**, closing over the AWS IAM role, the DCV token
signing key, and the owner principal. Substrate sees none of these (INV-11).

```ts
// apps/web (control plane) — NOT substrate. Closes over creds; substrate stays pure.
class AwsDesktopProvider implements DesktopProvider {
  // ctor: EC2Client (IAM role), Route53Client, ACM wildcard cert arn, dcvTokenSigner, ownerPrincipal, db

  async spawn({ provider, region, shape }: DesktopShape) {
    // 1. RunInstances: shape=m7i.2xlarge, Ubuntu 24.04 AMI, EbsEncrypted gp3 root (encryption also
    //    unlocks EC2 Hibernation), SG=default-deny+8443, UserData=cloud-init (§ below),
    //    NestedVirtualization only if os=windows.
    // 2. Allocate + associate an Elastic IP; upsert Route53 A record <opaque>.desk.polytoken → EIP.
    // 3. Insert desktop_sessions row (owner principal, ec2InstanceId, eip, dnsName) — sessionId is our
    //    OPAQUE row id, never the EC2 id (INV-11). Return { sessionId, status: "provisioning" }.
  }

  async attach({ sessionId }) {
    // ownership assert on the row via ownership.ts (INV-8/11) — DB assert, never parse the hostname.
    // DescribeInstances → if running: mint a short-lived (≤60 s) one-time DCV authToken signed by the
    // control plane, audience = this session's dcv-session-id. Return { sessionId, status,
    // gatewayUrl: `https://<dnsName>:8443` }. The token is delivered to the client out-of-band
    // (SDK auth() call / URL fragment), validated by the desktop's DCV external authenticator (§ auth).
  }

  async hibernate({ sessionId }) {
    // StopInstances (Hibernate=true where the shape/RAM supports it — Linux <150 GiB RAM [S15];
    // else plain Stop). EBS root persists = the machine. Disassociate+release the EIP (kill idle-EIP
    // charge); keep the DNS name reserved. Billing → EBS storage only. Return { status: "hibernated" }.
  }

  async destroy({ sessionId }) {
    // ownership assert. TerminateInstances + delete EBS + release EIP + delete Route53 record.
    // Return { status: "destroyed" }. The only data-losing verb (reversibility:"irreversible").
  }
}
```

**cloud-init (user-data) — Ubuntu path:** install DCV server + a lightweight GNOME/XFCE + Docker (native) +
create a DCV **virtual session** bound to the login user; install the **DCV external authenticator** config
pointing `auth-token-verifier` at the control plane's token-verify endpoint (a small Lambda/API that checks
our signature + audience + a DB ownership assert — the desktop itself holds **no** signing key, only the
URL of the verifier); set the two iframe-embed headers if the iframe client path is used (§ below); open
only 8443. **No AWS credentials ever land on the desktop.**

**How `attach` mints access (auth handoff):** DCV's own model is `authToken` in the connection URL —
`https://host:8443/?authToken=<token>#<dcv-session-id>` — validated by the server's external authenticator
via HTTP POST. [S3][S4] This maps 1:1 onto RFC §4.3: the control plane mints the short-lived token
(audience-scoped, minutes), the client presents it, the desktop's authenticator POSTs it to our verifier,
which does the DB ownership assert (INV-11) and approves. Using the **Web Client SDK** we pass the token via
the SDK's `auth()` call rather than the URL, so it never hits a query string or a log — the RFC's
"fragment-not-query" concern is satisfied by construction.

**Hibernate mapping (both options, pick per shape):**
- **Plain Stop + EBS** (default, universal): RAM lost, **disk = the machine** persists, resume re-boots the
  OS with clone/containers/files intact. Simplest, works on every shape. This is the RFC's "the VM's disk IS
  the machine" (RFC §2.2) realized on EBS.
- **EC2 Hibernation** (suspend-to-disk, where supported): also preserves **RAM** — resume restores running
  processes exactly. Requires encrypted root (we encrypt anyway), Linux <150 GiB RAM [S15]. Nicer UX;
  narrower instance support. Offer it opportunistically, fall back to plain Stop.

---

## 5. Security / tenancy — RFC §6 posture, on AWS

Unchanged invariants; here's the AWS realization:

- **INV-8 user-as-tenant / INV-11 opaque-key authz:** `sessionId` is our opaque `desktop_sessions` row id.
  `ec2InstanceId`, `eip`, `dnsName` are **data on the owned row**, never parsed for authz. All scope
  resolution through `ownership.ts`. One EC2 instance = one owner — no shared-host cross-tenant surface.
- **INV-9 RLS as second wall:** `desktop_sessions` + the runtime-hours ledger ship **both**
  `deny_all_*_anon` (RESTRICTIVE) and `*_owner_authenticated` (PERMISSIVE) policies in one migration.
- **Creds live only in the control plane:** the **AWS IAM role** and the **DCV token signing key** exist
  only in api-client. The desktop holds neither — only the *URL* of the control-plane token verifier. A
  compromised desktop cannot call EC2, cannot mint tokens, cannot reach another tenant.
- **Default-deny inbound** except 8443 (DCV) from our front door; egress limited to the S3 license endpoint
  (+ whatever the user's own workload needs). Root EBS **encrypted** (security + hibernation prerequisite).
- **The desktop is untrusted, always** (user runs arbitrary software) — same posture as the jailed iframe,
  applied at the network layer.
- **Audit / cost ceiling (RFC §5.3, unchanged):** every lifecycle transition is a ledger row carrying the
  owner principal (INV-13); the three-layer cap (spawn ceiling + idle reaper→hibernate + monthly budget,
  fail-closed) is enforced by the control plane, never the desktop.

---

## 6. Revised phase plan (ROADMAP.md house style — lifts into `/gsd:new-milestone`)

Five phases, AWS + DCV. Numbers assigned at milestone creation. Fails-closed-until-credentials discipline
preserved: **every phase before AWS creds are wired is fully buildable and testable against the
`failClosedDesktopProvider` floor** — the provider port throws until bound, and CD-1 SC-1 asserts that.

### Phase CD-1: Desktop Control Plane & AWS Provisioning Spine

**Goal**: Polytoken creates and destroys a real EC2 VM through the existing `DesktopProvider` port
(`AwsDesktopProvider` implementation), with `desktop.spawn`/`desktop.destroy` resolving as registry
capabilities whose risk/reversibility/cost/ceilings are declared as data, and a `desktop_sessions` table
that satisfies the tenancy invariants.
**Depends on**: v2.0 capability registry + daemon job envelope.
**Success Criteria** (what must be TRUE):
  1. `desktop.spawn`/`desktop.destroy` resolve by registry id; an unregistered/unprovisioned desktop
     capability fails closed from every consumer (`failClosedDesktopProvider` is the proven default).
  2. The substrate `reversibility` field (already shipped on `desktop.ts`) drives the confirm widget for
     spawn/destroy with cost + data-loss language; NO desktop code implements its own confirm flow (INV-4).
  3. `desktop_sessions` ships both RLS policies in one migration (INV-9); all access resolves through
     `ownership.ts` (INV-8); EC2 instance id / EIP / hostname are never parsed for authz (INV-11).
  4. A spawn call produces a running EC2 instance (encrypted gp3 root, Elastic IP, default-deny SG,
     per-session Route53 record) via `RunInstances`; destroy terminates it and releases EIP + DNS —
     verified against the real EC2 API; **AWS creds exist only in the control plane, never on the desktop**.
  5. Spawn fails closed at the declared concurrent-desktop and monthly-budget caps (Q5).

### Phase CD-2: DCV Streaming Path — End-to-End on Ubuntu

**Goal**: A spawned Ubuntu desktop runs Amazon DCV over a direct Elastic IP with an authenticated WSS
stream and native Docker, at a measured glass-to-glass latency inside budget — **no TURN, no Cloudflare**.
**Depends on**: CD-1.
**Success Criteria** (what must be TRUE):
  1. cloud-init brings the VM up with DCV server + GNOME/XFCE + native Docker + a DCV **virtual session**;
     the stream is DCV over WSS to `EIP:8443` (verified), with the DCV external authenticator configured to
     the control-plane verifier.
  2. The desktop rejects unauthenticated access; a short-lived, audience-scoped `authToken` minted against a
     **DB ownership assert** is the only way in (§4 auth handoff).
  3. The direct EIP path connects from a public network with **no relay**; the security group is default-deny
     except 8443; the S3 license check passes (DCV is free-on-EC2, no license server).
  4. Measured same-region glass-to-glass latency ≤ 55 ms direct (§3), recorded in the phase summary with
     methodology (cross-checked against ≥2 measurements).
  5. Software encode at 1080p leaves the dev-stack workload (Docker + Supabase + dev server) responsive —
     measured, not asserted; GPU/NVENC shape swap documented as the escape hatch.

### Phase CD-3: The In-App Desktop Surface

**Goal**: The desktop renders inside polytoken — a canvas `desktop` node with an expand-to-fullscreen state
— via the DCV Web Client SDK (first-party canvas client) or a jailed iframe with the minimum grant set, and
mouse/keyboard/clipboard work like a local computer.
**Depends on**: CD-2.
**Success Criteria** (what must be TRUE):
  1. A `desktop` canvas node type exists in the panel-as-node registry; `desktop.attach` from chat or canvas
     opens it. The client is the **DCV Web Client SDK** embedded natively (preferred, token via SDK `auth()`,
     no URL leakage) OR an iframe with DCV's `web-x-frame-options` + `web-extra-http-headers`
     (`frame-ancestors` CSP) configured server-side and the minimum `sandbox`/`allow` set [S2][S3].
  2. When the iframe path is used, a CSP `frame-src`/`frame-ancestors` allowlist pins the session's gateway
     origin; nothing in the app origin is reachable from the frame.
  3. Expand-to-fullscreen keeps the same DCV session (no reconnect); keyboard capture holds desktop shortcuts
     while focused, releases on blur/escape.
  4. Two-way clipboard works behind an explicit browser permission prompt — never silently.
  5. Node chrome shows live session state: running/hibernated, uptime, burn rate (§5 surfacing).

### Phase CD-4: Lifecycle & Cost Hardening

**Goal**: The desktop behaves like a computer you own — Stop+EBS (or EC2 Hibernation where supported)
hibernate/resume, EIP lifecycle, idle reaping, max-lifetime auto-hibernate, and a per-owner metered ledger:
the full Q5 three-layer cap live.
**Depends on**: CD-3 (enforcement is testable without CD-3's UI; sequence flexibly).
**Success Criteria** (what must be TRUE):
  1. `desktop.hibernate` stops the instance with EBS root persisting (Hibernate=true where the shape
     supports it); resume restores the same machine state (clone, installed software, container images on
     disk) — verified by writing a file, hibernating, resuming, reading it. EIP is released on hibernate and
     re-associated on resume with the DNS name updated.
  2. The idle reaper hibernates (never destroys) an unattached session after the window; max-lifetime
     auto-hibernate fires; both leave ledger rows carrying the owner principal (INV-13).
  3. Every runtime hour is metered; the monthly cap blocks new spawns fails-closed and the UI says why.
  4. `desktop.destroy` is the ONLY path that deletes data, only through the irreversible-class confirm
     widget (INV-4), and it releases EIP + Route53 record + EBS.

### Phase CD-5: Dogfood Gate — Polytoken Develops Polytoken (HUMAN GATE)

**Goal**: The acceptance scenario (RFC §8) passes end-to-end, performed live by the user — the epoch's
live-UAT gate.
**Depends on**: CD-1..4.
**Success Criteria** (what must be TRUE):
  1. Every step of RFC §8's checklist passes in one continuous session, driven entirely from within
     polytoken (spawn Ubuntu desktop → fullscreen terminal feels local → `git clone` polytoken → `docker` +
     `supabase start` + dev server on the desktop's own `localhost:3000` → operate the inner polytoken →
     hibernate + resume with state intact → settle the bill).
  2. The session's total cost is visible in-app afterward and matches the AWS invoice to within rounding
     (INV-13 / Q5 surfacing).
  3. The user signs off in the phase UAT — human gate by design (house precedent: Phase 58).

---

## 7. What the user must provide (everything else is buildable fails-closed)

The `failClosedDesktopProvider` floor means **CD-1 through CD-3 are fully buildable and testable without any
of the below** — the port throws until AWS creds are bound, and that's an asserted success criterion, not a
gap. The user provides these only when we're ready to hit the real EC2 API (end of CD-1 onward):

1. **AWS account + a scoped IAM role** for the control plane — permissions for `ec2:RunInstances`/
   `TerminateInstances`/`Describe*`/`StopInstances`, `ec2:AllocateAddress`/`AssociateAddress`,
   `route53:ChangeResourceRecordSets` on the desktop zone, and read on the ACM wildcard cert. (Fits the
   user's existing AWS IaC.)
2. **A budget ceiling** — max hourly rate, max concurrent desktops (default 1), max lifetime (default 8 h),
   monthly per-owner cap. Drives the fail-closed caps; nothing spawns above it.
3. **A region** — recommend **eu-central-1 (Frankfurt)** for the current user (lowest RTT); the streaming
   path targets same-region.

Optional, all AWS (no new vendor): a Route53 hosted zone + ACM wildcard cert for per-session hostnames
(`*.desk.polytoken…`). No Cloudflare, no Hetzner, no Selkies, no separate license — **AWS only**.

---

## Sources

- [S1] Amazon DCV — What Is DCV / free-on-EC2 licensing (S3 endpoint verification, no license server):
  https://docs.aws.amazon.com/dcv/latest/adminguide/setting-up-license.html ,
  https://docs.aws.amazon.com/dcv/latest/userguide/what-is-dcv.html — **HIGH**
- [S2] Amazon DCV Web Client SDK (JS/TS ES6, build first-party client):
  https://docs.aws.amazon.com/dcv/latest/websdkguide/what-is.html — **HIGH**
- [S3] Embed the DCV web browser client inside an iFrame (`web-x-frame-options`, `web-extra-http-headers`,
  `frame-ancestors` CSP): https://docs.aws.amazon.com/dcv/latest/adminguide/embed-in-iframe.html — **HIGH**
- [S4] DCV external authentication / `authToken` URL + HTTP-POST verifier:
  https://docs.aws.amazon.com/dcv/latest/adminguide/external-authentication.html — **HIGH**
- [S5] NICE DCV → Amazon DCV with 2024.0 (active AWS investment, QUIC default):
  https://aws.amazon.com/blogs/aws/nice-desktop-cloud-visualization-dcv-is-now-amazon-dcv/ — **HIGH**
- [S6] DCV ports / QUIC-UDP vs WebSocket-TCP (web client is WSS/TCP; QUIC native-client only):
  https://docs.aws.amazon.com/dcv/latest/adminguide/manage-port-addr.html ,
  https://docs.aws.amazon.com/dcv/latest/adminguide/disable-quic.html — **HIGH**
- [S7] DCV encoding: NVENC auto on GPU, software encode with no GPU:
  https://docs.aws.amazon.com/dcv/latest/adminguide/manage-gpu.html , NI SP DCV performance guide — **HIGH**
- [S8] m7i.2xlarge (~$0.4032/h) / c7i.2xlarge (~$0.357/h) us-east-1 on-demand:
  https://instances.vantage.sh/aws/ec2/m7i.2xlarge — **MEDIUM** (aggregator; re-verify at planning)
- [S9] M8g / Graviton4 price-performance (10–20% cheaper, x86 arch caveat for the dogfood):
  https://aws.amazon.com/ec2/instance-types/m8g/ — **HIGH**
- [S10] g4dn.xlarge (T4, NVENC) ~$0.526/h: https://instances.vantage.sh/aws/ec2/g4dn.xlarge — **MEDIUM**
- [S11] g6.xlarge (L4, AV1) ~$0.805/h: https://instances.vantage.sh/aws/ec2/g6.xlarge — **MEDIUM**
- [S12] g6e.xlarge (L40S) ~$1.861/h: https://instances.vantage.sh/aws/ec2/g6e.xlarge — **MEDIUM**
- [S13] NVIDIA L4/Ada AV1 (~40% bitrate savings vs H.264):
  https://developer.nvidia.com/blog/improving-video-quality-and-performance-with-av1-and-nvidia-ada-lovelace-architecture/ — **HIGH**
- [S14] EC2 nested virtualization on non-metal instances (Feb 2026; M7i/C7i/M8i etc.; Windows Docker/WSL2):
  https://aws.amazon.com/about-aws/whats-new/2026/02/amazon-ec2-nested-virtualization-on-virtual/ ,
  https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/amazon-ec2-nested-virtualization.html — **HIGH**
- [S15] EC2 Hibernation (suspend-to-disk to encrypted EBS; Linux <150 GiB RAM; supported shapes):
  https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Hibernate.html ,
  https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/hibernating-prerequisites.html — **HIGH**
</content>
</invoke>
