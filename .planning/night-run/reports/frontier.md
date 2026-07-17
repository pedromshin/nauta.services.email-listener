# Frontier Research: Autonomous Tool Registries + Low-Latency Remote Desktop for a Personal Cloud PC

Researched 2026-07-17 via WebSearch (post-cutoff developments; not covered well by base training data).

---

## A. Ontology/Registry of Discoverable, Installable, Runnable Tools for Agents

### State of the art (mid-2026)

The MCP ecosystem now has multiple competing/complementary registries, at very different scales and trust levels:

- **Official MCP Registry** (`registry.modelcontextprotocol.io`) — backed by Anthropic/GitHub/Microsoft. ~8,400 verified servers as of May 2026. This is the closest thing to a canonical "index of indexes" — other registries increasingly sync into/from it.
- **Smithery** (`smithery.ai`) — ~7,000 servers, install locally via CLI or run hosted/remote. Ships **Toolbox**, a *meta-MCP* that dynamically routes an agent to the right server on the registry at runtime — i.e., an agent doesn't need to know the tool ahead of time, it queries Toolbox and gets routed. This is the single most relevant building block for "agent discovers + installs + uses tools autonomously" — it's effectively a package manager + dynamic dispatcher in one.
- **mcp.so** — broadest, community-submitted, ~20,000 servers indexed (April 2026). Good for breadth/discovery UI, weaker on curation/trust.
- **Glama** — ~37,000 servers, tiered into "Official" (publisher-verified) vs "Claimed" (author-verified ownership) — a useful trust-tiering model worth copying regardless of which registry you pull from.
- **Context7** (Upstash) — not a tool registry per se, but a documentation-retrieval MCP: pulls version-pinned, up-to-date library docs/code examples directly into the agent's context at call time. Solves the "agent's training data is stale on library X" problem specifically, complementary to tool registries.
- **GitMCP** — turns any public GitHub repo into an ad hoc MCP server by reading `llms.txt`/`llms-full.txt`/README and exposing smart search over it — zero-config repo-to-tool bridge, useful as a fallback when no registry entry exists yet for a given repo.

**Claude Code plugin/skill ecosystem** (adjacent, and now cross-vendor):
- `claudemarketplaces.com` indexes 2,500+ marketplaces. One large open-source aggregator (`jeremylongshore/claude-code-plugins-plus-skills`) ships 425 plugins / 2,810 skills / 200 agents with a `ccpi` CLI package manager — i.e., someone has already built the "apt-get for Claude Code skills" tool.
- **agentskills.io** is emerging as the open cross-vendor standard — skills portable across ~40 agent products (Claude Code, Cursor, Copilot, Codex, Gemini CLI, etc.) as of June 2026.
- **Quality/security is the unsolved half**: SkillsBench audited 47,150 public skills, average quality 6.2/12; a separate audit of 22,511 skills found 140,963 issues; Snyk's "ToxicSkills" research found prompt injection in 36% of skills tested. Curated libraries raised agent pass rates 16.2pp over uncurated. **This is the load-bearing finding**: raw registry access is necessary but not sufficient — an autonomous-install pipeline needs a curation/vetting gate, not blind `install`.

### Adopt vs. build

- **Adopt**: Official MCP Registry as the trust root; Smithery's Toolbox pattern (dynamic runtime routing rather than static config) as the dispatch model; Context7 for docs-freshness; GitMCP as the zero-config fallback for repos without registry entries.
- **Build**: a thin internal "vetting gate" layer — pull candidates from registries, run them through a cheap automated check (provenance/tier from Glama-style trust tiers + a lightweight injection/quality scan modeled on SkillsBench/ToxicSkills' method) before an agent is allowed to auto-install and execute. Nix-style reproducible provisioning did not surface as an existing agent-specific product in this search (no mature "nix for MCP tools" project found) — this is a plausible gap the project could fill or should re-check next cycle, not something to build blind now.

### Recommended bet

Treat the **Official MCP Registry + Smithery Toolbox** as the default discovery/dispatch substrate (don't build a custom tool-discovery protocol), but do not let agents auto-install directly from raw registry results — insert a cheap, cacheable vetting step (trust tier + static scan) between "discovered" and "installable," because the ecosystem-wide data says curation is currently the differentiator, not access.

---

## B. Lowest-Latency Browser-Accessible Remote Desktop for a Personal Cloud Dev/Production PC

### State of the art (mid-2026)

- **Sunshine + Moonlight** (self-hosted, open source) is the strongest overall pick for "near-physical latency" on a personal cloud PC: hardware-encoded H.264/H.265 over UDP, GPU-accelerated (NVIDIA/AMD/Intel), reports of sub-30ms and 4K@60 (up to 4K120 with HDR support). Multiple 2026 comparisons rate it as lower-latency and less artifact-prone than Parsec in direct tests, at zero subscription cost. Ships a **web UI for configuration/pairing**, but the actual video stream is a native Moonlight client (desktop/mobile/embedded), not a pure browser tab — this matters if "browser-accessible" is a hard requirement.
- **Parsec**: optimizes for automatic NAT traversal/connectivity over raw latency; comparable codec/latency profile to Moonlight in principle, but user testing in 2026 still shows Sunshine+Moonlight edging it out on latency and artifacts. Freemium, $9.99/mo+ for advanced tiers. Worth keeping as the "just works through firewalls" fallback.
- **Selkies** (WebRTC, GStreamer-based, Google-origin, now community/academic-maintained): purpose-built for **pure browser access** (HTML5, no client install) to Linux containers/Kubernetes/cloud/HPC. Defaults to plain WebSockets, WebRTC is opt-in — check this default before assuming WebRTC-grade latency out of the box. This is the strongest candidate if the hard requirement is "opens in a browser tab, no app install."
- **neko**: Dockerized, WebRTC-based virtual browser/desktop — smoother than noVNC because it streams real video over WebRTC rather than image diffs over WebSockets. Good for a narrowly-scoped "browser inside a browser" use case (e.g., giving a remote agent a sandboxed browser), less suited as a full desktop replacement.
- **Cloudflare Tunnel + noVNC**: noVNC is image-diff-over-WebSocket, not video-over-WebRTC — meaningfully higher latency and worse motion quality than Selkies/neko/Sunshine. Cloudflare's relevance here is actually **Cloudflare Calls TURN** — a free geodistributed TURN relay (1000GB/mo free tier) that solves the NAT-traversal problem for self-hosted WebRTC stacks (Selkies/neko) without paying for a dedicated TURN server; note a TURN relay hop adds latency/stutter vs. a direct P2P WebRTC path, so it's a fallback path, not the primary path.

### Adopt vs. build

- **Adopt, don't build**: none of these need to be built from scratch. The decision is composition, not construction.
- Two real architectural options: (1) **Sunshine+Moonlight** for the actual latency-critical interactive/production PC session (best latency, GPU-encoded, but needs a native Moonlight client — Android/iOS/desktop/some browsers via WASM ports exist but are not first-class); (2) **Selkies** if "opens in a plain browser URL, zero install, works on any device" is non-negotiable, accepting it's architected for containerized/cloud Linux desktops rather than a bare-metal Windows dev box.
- **Composes with long-running Claude Code agents + browser automation from anywhere**: this is actually two separable problems that the search results show are being solved on different tracks. Claude Code's own 2026 features — **Remote Control** (turn any browser/mobile app into a viewport onto a live local session) and **Routines** (fully cloud-hosted scheduled agent runs, no local process) — already give "run Claude Code from anywhere" without needing a remote-desktop stack at all for the *agent* half. The remote-desktop stack (Sunshine/Selkies) is only needed for the *human* to get GUI-level, near-physical-latency access to the same box (e.g., to visually inspect a UI, drive Figma, watch a browser-automation run live). Playwright-MCP (or `vercel-labs/agent-browser`) is the standard way to give the *agent itself* headless browser control without a remote-desktop layer in the loop at all.

### Recommended bet

For a personal cloud dev/production PC: run **Sunshine on the box** as the primary interactive-latency path (Moonlight client on whatever device is at hand), and stand up **Selkies (WebRTC) behind Cloudflare Tunnel + Cloudflare Calls TURN** as the pure-browser fallback for devices that can't install Moonlight (e.g., a locked-down work laptop) — accepting the modest latency tax of the TURN relay hop in that fallback path. Keep the agent's own browser automation on Playwright-MCP / agent-browser, entirely separate from the human's remote-desktop path — they solve different problems and conflating them adds latency and fragility to both. Do not build a bespoke streaming stack; this space is dense with mature, actively-maintained open source in 2026.

---

## C. Research Practice to Keep Finding Post-Cutoff Developments

Findings above (Smithery Toolbox, agentskills.io, Claude Code Routines/Remote Control, Cloudflare Calls TURN, SkillsBench/ToxicSkills audits) are all 2026-dated and would not reliably surface from model memory alone — confirming the premise that this class of infrastructure churns faster than training-data refresh cycles.

**Recommended cadence, driven by the `deep-research` skill already in this setup:**

- **Weekly, lightweight** (WebSearch only, ~10 min): a standing query set — "MCP registry [current month/year]", "Claude Code plugin marketplace [current month/year]", "[specific stack component] latency 2026" — run as a quick pulse-check, not a full report. Catches naming/product churn (e.g., a registry consolidating, a new Anthropic feature ship) before it becomes a blocker mid-build.
- **Per-milestone, deep** (`/deep-research`, the harness itself, at each new milestone's kickoff or whenever a phase depends on an external ecosystem component): fan-out + adversarial verification before committing an architectural bet on a specific tool/registry/protocol. This report is itself the shape of that output — use it as the template.
- **Sources to prioritize, in order of signal density observed in this session**: (1) official project GitHub repos/READMEs directly (ground truth on capability, e.g., Selkies' README clarifying WebSocket-default/WebRTC-opt-in — a detail that would be missed from a summary blog post); (2) Anthropic's own docs/changelog for Claude Code (`code.claude.com/docs`) since that product ships fastest; (3) security/quality audit reports (SkillsBench, Snyk-style) over marketing blogs, since they're the only source that will tell you what's *actually safe to auto-install* rather than what's *popular*; (4) dated comparison/benchmark posts (the "vs" articles) treated as directionally useful but not authoritative — cross-check numbers against at least two independent tests before trusting a specific latency figure.
- **Trigger, not just cadence**: any time a plan/phase proposes adopting an external tool/registry/protocol as an architectural dependency, that's an automatic trigger for a `/deep-research` pass on that specific component before locking it in — the cost of a stale assumption compounds once code is built on top of it.

---

## Sources

- [Official MCP Registry](https://registry.modelcontextprotocol.io/)
- [Best MCP Registries in 2026 — TrueFoundry](https://www.truefoundry.com/blog/best-mcp-registries)
- [Top 10 MCP Server Directories & Registries (2026) — explainx.ai](https://www.explainx.ai/blog/top-10-mcp-server-directories-2026)
- [Smithery Review (2026) — tooldirectory.ai](https://tooldirectory.ai/tools/smithery)
- [MCP Registries in 2026 — RoxyAPI](https://roxyapi.com/blogs/mcp-registries-where-to-list-your-server)
- [Claude Code Plugins Directory — claudemarketplaces.com](https://claudemarketplaces.com/)
- [jeremylongshore/claude-code-plugins-plus-skills — GitHub](https://github.com/jeremylongshore/claude-code-plugins-plus-skills)
- [netresearch/claude-code-marketplace — GitHub](https://github.com/netresearch/claude-code-marketplace)
- [The Agent Skills Ecosystem in 2026 — Agentman](https://agentman.ai/blog/agent-skills-ecosystem-report-2026)
- [upstash/context7 — GitHub](https://github.com/upstash/context7)
- [Top 7 MCP Alternatives for Context7 in 2026 — Neuledge](https://neuledge.com/blog/2026-02-06/top-7-mcp-alternatives-for-context7-in-2026/)
- [Sunshine | LizardByte](https://app.lizardbyte.dev/Sunshine/)
- [Sunshine + Moonlight vs Parsec — XDA Developers](https://www.xda-developers.com/sunshine-moonlight-vs-parsec/)
- [Parsec vs Moonlight vs Steam Link 2026 — tech-insider.org](https://tech-insider.org/parsec-vs-moonlight-vs-steam-link-2026/)
- [Moonlight vs Parsec vs RDP: GPU Remote Desktop 2026 — SuperRenders](https://superrendersfarm.com/article/moonlight-parsec-rdp-remote-desktop-gpu-rendering-2026)
- [selkies-project/selkies — GitHub](https://github.com/selkies-project/selkies)
- [Selkies project site](https://selkies-project.github.io/selkies/)
- [m1k1o/neko — GitHub](https://github.com/m1k1o/neko)
- [Claude Code Remote Control — Fastio](https://fast.io/resources/claude-code-remote-guide/)
- [Claude Code Routines: 24/7 AI Agents — MindStudio](https://www.mindstudio.ai/blog/claude-code-routines-24-7-agents)
- [vercel-labs/agent-browser — GitHub](https://github.com/vercel-labs/agent-browser)
- [Automate Browser Tasks with Claude Code and Playwright MCP — MindStudio](https://www.mindstudio.ai/blog/automate-browser-tasks-claude-code-playwright)
