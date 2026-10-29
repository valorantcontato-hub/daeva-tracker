# Account resources: native read-only capture

The values belong to a freshly identified character in the same TCP flow. A remembered local name, a different flow, or the previous character cannot authorize a pending resource snapshot. Missing fields remain unknown; zero is displayed only after a valid reading.

| Frame (opcode bytes) | Reading |
| --- | --- |
| `0b 61`, `0c 61` | Ticket 60000001: base and charged Odyle Energy |
| `3b e3` | Membership benefits 34–42: 560 / 840 capacity; an auto-loot-only update does not change membership |
| `1c 8d` | Completed Duty Missions, out of 5 |
| `11 56`, `1b 56` | Own inventory currencies: 930100001 bound, 930100031 tradeable, 930100030 integrated if present |
| `8f 8d`, `8b 8d` | Conversion recipe counters: 32070001 server-wide (16), 32070002 per character (4) |

Craft uses the sum of the two conversion counters, not shop counter 100134. The conversion list is sent when the crafting window opens; a craft result replaces the respective cumulative counter. Daily/weekly periods expire at the game's 07:00 UTC reset (weekly Wednesday); expired unknown counters are never invented as zero.

Odyle refill is +15 per three hours. A next-refill timestamp is anchored only after an observed server refill message, rather than inventing a phase from the player's login time. Before that, the UI leaves the countdown unknown.

Protocol references:

- [Aion-DPS-Meter ticket and membership layouts](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/main/Client/Aion2/Aion2Tickets.cs), [inventory anchors](https://github.com/SkeeveAN/Aion-DPS-Meter/blob/main/Client/Aion2/Aion2Stock.cs). Adapted under MIT; notice distributed in licenses/aion-dps-meter-MIT.txt.
- [A2Tools verified crafting protocol and recipe IDs](https://github.com/taengu/A2Tools-DPS-Meter/blob/main/src-tauri/src/capture/stream_processor.rs), [counter semantics](https://github.com/taengu/A2Tools-DPS-Meter/blob/main/src-tauri/src/plugins/mod.rs). Used as protocol facts; no Rust implementation copied.
- [Global client recharge metadata](https://metabot.gg/en/aion-2/items/odyle-energy-bound).
