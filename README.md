# Block Frontier — Nokia 2720 Flip (KaiOS 2.5)

**Standalone, offline, single-player 2D block sandbox** made for the Nokia 2720 Flip keypad and 240 × 320 screen. It is NOT a 3D voxel engine or an Android/iOS game.

## Features

- Procedural, deterministic horizontal world with forest, plains, desert, snow, hills, caves and ore veins. Only blocks around the camera are rendered; terrain is generated from a seed and nearby tiles are cached.
- Dig and place individual blocks, collect resources, craft planks, tools, torches, wires and mechanisms.
- Survival: health, hunger, hostile night creatures, death/respawn. Creative: unlimited blocks, invulnerability, flying.
- Day/night cycle, hand-drawn pixel-art-style block rendering, parallax background, inventory and crafting menus.
- Three **local offline world save slots**. Only seed, character state, inventory and edited blocks are saved; the untouched terrain is regenerated. Autosave every ~6 seconds and on pause / background. No accounts, servers, multiplayer or telemetry.
- Very small dependency-free HTML5/CSS/JavaScript application. `manifest.webapp` for KaiOS 2.5.x.

## Tested target / limitations

The Nokia 2720 Flip has a **Qualcomm 205**, **512 MB RAM**, **240 × 320** main display and KaiOS **2.5.2** on original devices. The implementation deliberately uses Canvas 2D instead of WebGL and external engines. Source validation and ZIP integrity are automated; performance **must still be measured on a physical Nokia 2720 Flip**, and installation depends on the actual KaiOS firmware. There is no claim of testing on physical hardware.

The horizontal terrain is generated as you explore but is not a full 3D world; caves are tile cavities, there are no bosses or advanced machinery yet. Wires can connect switches to lamps. Save size is bounded by **12,000 edited tiles** to limit localStorage use. Clearing browser/application data will delete saves. Always back up important worlds before updating firmware or uninstalling the game.

## Buttons

| Key | Action |
| --- | --- |
| `4` / `6` | Move left / right |
| `2` | Jump; creative mode fly up |
| `0` | Eat berries; creative mode fly down |
| `8` | Mine a block |
| Center `5` / OK | Place selected block / select menu item |
| `1` / `3` | Cycle block selection |
| `9` | Aim forward, up or down |
| `7` | Toggle switch or rest |
| `*` / left softkey | Inventory and crafting |
| `#` / back/right softkey | Pause / save / menu |

In menus `2/8` change selection and `5` confirms. When selecting a world slot, pressing `0` **twice** deletes that local save. Set **Survival/Creative** before creating a new world. During a game, the pause menu also changes the mode. Mine stone with a crafted pickaxe.

## Download installable ZIP (GitHub Actions)

1. Open the [Actions](https://github.com/danilfg/kaiOS-runner/actions/workflows/build.yml) tab.
2. Choose **Build KaiOS game** → **Run workflow** (or open the latest green run on `main`).
3. In the run details, download the **block-frontier-nokia-2720** artifact.
4. Unzip the downloaded GitHub **artifact**; inside is **`block-frontier-kaios.zip`**. This *inner ZIP* is the KaiOS application. It has `manifest.webapp` at its root.
5. A `v*` git tag additionally publishes the same ZIP under GitHub Releases.

Do **not** rename this file to `.apk`, `.ipa`, `.jar` or `.jad`: KaiOS uses packaged HTML5 applications, not those formats.

## Install on a Nokia 2720 Flip (KaiOS — not iOS)

> Installation is firmware-dependent. On certain firmware builds (notably **KaiOS 2.5.2.2** with release-keys), third-party sideloading is blocked. Do not flash, root or downgrade the phone just to install this game.

### Preferred: developer WebIDE on supported firmware

1. Check **Settings → Device → Device Information → Software** (wording may differ) and note the KaiOS version.
2. On the phone's dialer enter **`*#*#33284#*#*`** to enable debugging, if supported. A bug icon may appear.
3. Connect the phone to a computer over a data-capable USB cable, with ADB installed. Confirm `adb devices` sees the phone.
4. Use Firefox **59 or older** with KaiOS-compatible **WebIDE** (or a compatible developer tool). See [official KaiOS WebIDE setup](https://developer.kaiostech.com/docs/getting-started/env-setup/os-env-setup/).
5. Unpack **`block-frontier-kaios.zip`** to a folder. In WebIDE, choose **Open Packaged App**, point to this extracted folder (the one containing `manifest.webapp`) and click **Run / Install**.
6. The game should appear in the app list. Test movement, saves and resume after restarting the phone.

### Alternative: compatible OmniSD loader

If OmniSD is already installed and supported by your firmware, transfer `block-frontier-kaios.zip` to the phone's storage and install using the package manager. **Do not attempt unverified jailbreak steps.** See [BananaHackers' OmniSD documentation](https://wiki.bananahackers.net/guides/omnisd) for compatibility.

### Development locally

Open `index.html` in a desktop browser (it uses no network APIs) or serve this folder with `python3 -m http.server 8000`. Use the numeric keyboard or simulated keyboard events. The game canvas stays 240 × 320. Tests: `node --check src/game.js && node scripts/validate.js`.

## Build package manually

```bash
zip -9 -r block-frontier-kaios.zip manifest.webapp index.html style.css src icons
```

## Technical notes

- ES5 syntax for the older KaiOS 2.5 browser engine; no external dependencies.
- `localStorage` saves three slots under `bf_slot_0` to `bf_slot_2`.
- No remote APIs, no multiplayer, no service worker and no telemetry.
- Gameplay UI is in English to avoid requiring additional fonts. README is in English for contributors; Russian installation explanation can be added.

## Sources

- [KaiOS Manifest](https://developer.kaiostech.com/docs/getting-started/main-concepts/manifest/)
- [KaiOS packaged apps](https://developer.kaiostech.com/docs/development/packaged-or-hosted/)
- [Nokia 2720 official KaiOS page](https://www.kaiostech.com/devices/nokia-2720-flip/)
- [BananaHackers side-loading](https://wiki.bananahackers.net/en/install-omnisd/natural-sideload)
