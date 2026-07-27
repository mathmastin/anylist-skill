---
name: anylist
description: "Read AnyList recipes and manage AnyList shopping lists via a Node.js bridge to the unofficial AnyList API."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos]
required_environment_variables:
  - ANYLIST_EMAIL
  - ANYLIST_PASSWORD
metadata:
  hermes:
    tags: [AnyList, recipes, groceries, shopping-list, meal-planning]
    related_skills: [meal-planner, google-workspace]
---

# AnyList

Talk to [AnyList](https://www.anylist.com) — read your recipe library and manage
shopping lists — via a small Node.js bridge (`scripts/anylist_bridge.js`) that wraps
the unofficial `anylist` npm package (protobuf-based, reverse-engineered from the app).
There is no official public API, so this bridge is the only integration path.

## Requirements

- Node.js 18+ (`node --version` to check — already required for other Hermes skills)
- `ANYLIST_EMAIL` and `ANYLIST_PASSWORD` in Hermes's `.env` — your normal AnyList
  account login. No OAuth, no API key registration needed.
- npm dependencies installed once (see Setup)

## Setup (one-time)

```bash
ANYLIST_SKILL_DIR="${HERMES_HOME:-$HOME/.hermes}/skills/productivity/anylist"
cd "$ANYLIST_SKILL_DIR/scripts" && npm install
```

Verify:

```bash
cd "$ANYLIST_SKILL_DIR/scripts" && node anylist_bridge.js get-recipes 2>&1 | head -c 300
```

Should print a JSON array of recipes to stdout (progress/log lines go to stderr).
If it fails, check `ANYLIST_EMAIL`/`ANYLIST_PASSWORD` are correct and exported —
the script reads them from the environment, so run it in a context where Hermes's
`.env` has already been loaded (or `export $(grep -v '^#' .env | xargs)` first).

## Commands

All commands are invoked via `terminal`, e.g.:

```bash
ANYLIST_SKILL_DIR="${HERMES_HOME:-$HOME/.hermes}/skills/productivity/anylist"
node "$ANYLIST_SKILL_DIR/scripts/anylist_bridge.js" get-recipes
```

### Get recipes

```bash
node anylist_bridge.js get-recipes
```

Fetches the full recipe library and writes it as a JSON array to stdout. Each recipe:

```json
{
  "identifier": "abc123",
  "name": "Roasted Chicken Thighs",
  "ingredients": ["2 lbs chicken thighs", "3 cloves garlic, minced", "..."],
  "steps": ["Preheat oven to 425F", "..."],
  "prep_time_minutes": 10,
  "cook_time_minutes": 35,
  "servings": 4,
  "notes": null,
  "rating": null,
  "source_url": null,
  "source_name": null
}
```

**Context-efficiency pattern:** the full recipe list (especially `steps` and full
ingredient strings) can be large. When surveying the library to decide what to cook —
rather than executing a specific recipe — strip each recipe down client-side to just
`identifier`, `name`, an ingredient-name-only list (drop quantities/units), and timing,
so you can spot ingredient overlap across recipes cheaply. Only pull the full recipe
(quantities + steps) for the recipes you've actually selected. This mirrors the
original meal-planner app's `get_anylist_recipes()` (summary) vs. `get_recipe_details()`
(full) split — do the same two-pass approach when planning meals, rather than dumping
every recipe's full detail into context up front.

A rough ingredient-name extraction (strip leading quantity + unit, drop anything after
a comma) is enough for overlap detection — exact parsing isn't necessary.

### Add items to a shopping list

```bash
echo '{"list": "Alexa Shopping List", "items": ["3 lbs chicken thighs", "2 cups quinoa", "1 head broccoli"]}' \
  | node anylist_bridge.js add-items
```

Reads `{list, items}` as JSON from stdin, adds each item as a new item to the named
AnyList shopping list. Returns `{"status": "success", "items_added": N}` on success,
or exits non-zero with `{"error": "..."}` on stderr if the named list doesn't exist.

**Before calling this**, consolidate: combine duplicate ingredients across multiple
recipes and sum quantities (e.g. two recipes each needing "2 cloves garlic" becomes
one line "4 cloves garlic"), scaled for how many times each recipe is used. Call
`add-items` once with the full merged list rather than once per recipe.

Default list name is `"Alexa Shopping List"` if the caller doesn't specify one —
confirm the target list name with the user if it's not obvious, since AnyList
supports multiple named lists and adding to the wrong one is a silent mistake the
user won't notice until they're at the store.

### Create a new recipe

```bash
echo '{
  "name": "Roasted Chicken Thighs",
  "ingredients": [
    {"rawIngredient": "2 lbs chicken thighs", "name": "chicken thighs", "quantity": "2", "note": "lbs"},
    {"rawIngredient": "3 cloves garlic, minced", "name": "garlic", "quantity": "3", "note": "cloves, minced"}
  ],
  "preparation_steps": ["Preheat oven to 425F", "Place chicken on baking sheet", "Roast for 35 minutes"],
  "servings": "4 servings",
  "prep_time_minutes": 10,
  "cook_time_minutes": 35,
  "source_name": "Serious Eats",
  "source_url": "https://seriouseats.com",
  "rating": 5,
  "notes": "Family favorite!"
}' | node anylist_bridge.js create-recipe
```

Reads a recipe JSON object from stdin and creates a new recipe in your AnyList account.
Returns `{"status": "success", "recipe_name": "...", "recipe_identifier": "..."}` on success,
or exits non-zero with `{"error": "..."}` on stderr if validation fails.

**Required fields:**
- `name` (string) — recipe name
- `ingredients` (array) — array of ingredient objects with at least `name` or `rawIngredient`

**Optional fields:**
- `preparation_steps` or `steps` (array) — cooking instructions
- `servings` (string) — e.g. "4 servings" or "2 servings as main dish"
- `prep_time_minutes` (number) — preparation time in minutes
- `cook_time_minutes` (number) — cooking time in minutes
- `notes` (string) — additional notes
- `rating` (number) — rating out of 5
- `source_name` (string) — e.g. "Serious Eats"
- `source_url` (string) — URL to the original recipe
- `nutritional_info` (string) — nutritional information

**Ingredient object format:**
```json
{
  "rawIngredient": "2 lbs chicken thighs",  // Full ingredient string (displayed in AnyList)
  "name": "chicken thighs",                  // Ingredient name for matching
  "quantity": "2",                           // Quantity number
  "note": "lbs"                              // Unit or additional notes
}
```

Either `rawIngredient` (the full string) or `name` must be provided. If only `name` is provided,
AnyList will display it without quantity/unit info.

## Pitfalls

- **Bridge is a fresh process per call** — no caching between invocations. If a
  workflow needs both a recipe survey and later per-recipe detail, either fetch full
  recipes once and slice client-side, or accept the AnyList login round-trip cost
  per call (typically a few seconds). For a single planning session, prefer fetching
  `get-recipes` once and keeping the JSON in the conversation/scratch file rather than
  re-invoking the bridge repeatedly.
- **Unofficial API** — AnyList can change their backend at any time and break the
  `anylist` npm package. If `get-recipes`/`add-items` starts failing with protobuf or
  auth errors unrelated to credentials, check for an updated `anylist` package version.
- **List name is exact-match** — `add-items` fails if the named list doesn't exist
  (typos, trailing whitespace). List the user's known list names if unsure, or ask.
- **Credentials in plain env vars** — same trust model as the original app. Don't log
  or echo `ANYLIST_PASSWORD` in terminal output.
- **⚠️ CREATE-RECIPE LIMITATION (v0.8.6)** — The `create-recipe` command returns a success
  message but recipes do NOT persist to your AnyList account. This is a known limitation
  in the underlying `anylist` npm package (v0.8.6) where the user ID is not properly passed
  to the recipe creation API. **Workaround:** Create recipes directly in the AnyList app
  instead. This limitation may be resolved in future package updates.
