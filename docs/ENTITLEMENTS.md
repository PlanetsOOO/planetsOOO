# Orbit entitlement matrix

| Tier | Product | Payment | Where it works | Multiplayer |
|------|---------|---------|----------------|-------------|
| **Basic** | Chrome extension scenic screensaver | Free | Hosted `planets.ooo/?screensaver=1&flight=0` | No |
| **Premium extension** | Offline/manual flight | One-time ($2.99) | Packaged `screensaver-react.html` | No (solo flight only) |
| **Multiplayer subscription** | Gamified shared exploration | Recurring (Stripe) or admin whitelist | `planets.ooo` when logged in + **verified email** | Yes (web) |
| **Premium + subscription** | Extension multiplayer | Both above | Extension when online + linked account | Yes (extension) |

## Rules

- Solo Premium flight is **never** gated behind subscription.
- Web multiplayer requires an **active subscription** (Stripe or verified admin-whitelist email) and planets.ooo login.
- Email addresses must be **verified** before session access to Online / multiplayer.
- Extension multiplayer requires **Premium entitlement on the install**, **linked account**, and **active subscription**.
- Offline Premium flight remains solo; multiplayer UI is disabled without network.

## Verification

| Check | API / storage |
|-------|----------------|
| Premium extension | HMAC token in `chrome.storage.local.premiumEntitlement` + `/api/premium/verify` |
| Web session | HttpOnly `orbit_session` cookie |
| Subscription | Stripe webhook → entitlement DB → `/api/multiplayer/entitlement` |
| Extension account link | `chrome.storage.local.orbitUserSession` + install link in DB |

## Flight mode checklist (Premium extension milestone)

1. Enter flight → move/look → 15s idle returns to scenic
2. Exit key / Escape → scenic tour (screensaver stays open)
3. **L** toggles labels; default off in flight
4. **O** toggles orbit paths; default off in flight
5. Reticle on label + click → travels; still in flight mode
6. During transit: click canvas → look works; reticle visible
7. During transit: **WASD** → manual flight, still in flight mode
8. Random input in flight → does **not** close screensaver
