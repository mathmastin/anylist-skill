# AnyList Skill for Hermes Agent

A Hermes Agent skill for managing AnyList recipes and shopping lists via the unofficial AnyList API.

## Features

- **Get Recipes**: Fetch your entire AnyList recipe library
- **Create Recipes**: Add new recipes to AnyList from JSON data (perfect for converting recipe images or URLs)
- **Add Items**: Add ingredients to your shopping lists

## Quick Start

### Installation

This skill is included with Hermes Agent. To set it up:

```bash
cd ~/.hermes/skills/productivity/anylist/scripts
npm install
```

### Configuration

Add your AnyList credentials to your Hermes `.env` file:

```
ANYLIST_EMAIL=your-email@example.com
ANYLIST_PASSWORD=your-password
```

### Usage Examples

#### Create a recipe from image or URL

```bash
# First, parse the recipe (from image, URL, or manual entry)
# Then create it via the bridge:

echo '{
  "name": "Roasted Chicken Thighs",
  "ingredients": [
    {"rawIngredient": "2 lbs chicken thighs", "name": "chicken thighs", "quantity": "2", "note": "lbs"},
    {"rawIngredient": "3 cloves garlic, minced", "name": "garlic", "quantity": "3", "note": "cloves, minced"}
  ],
  "preparation_steps": [
    "Preheat oven to 425F",
    "Place chicken on baking sheet",
    "Roast for 35 minutes"
  ],
  "servings": "4 servings",
  "prep_time_minutes": 10,
  "cook_time_minutes": 35,
  "source_name": "Serious Eats",
  "source_url": "https://seriouseats.com"
}' | node scripts/anylist_bridge.js create-recipe
```

#### Get all recipes

```bash
node scripts/anylist_bridge.js get-recipes
```

#### Add items to shopping list

```bash
echo '{
  "list": "Alexa Shopping List",
  "items": ["3 lbs chicken thighs", "2 cups quinoa", "1 head broccoli"]
}' | node scripts/anylist_bridge.js add-items
```

## Commands

### `create-recipe`

Create a new recipe in AnyList from JSON input.

**Required fields:**
- `name` (string) — recipe name
- `ingredients` (array) — array of ingredient objects

**Optional fields:**
- `preparation_steps` or `steps` (array) — cooking instructions
- `servings` (string)
- `prep_time_minutes` (number)
- `cook_time_minutes` (number)
- `notes` (string)
- `rating` (number, 1-5)
- `source_name` (string)
- `source_url` (string)
- `nutritional_info` (string)

### `get-recipes`

Fetch your entire recipe library as JSON.

### `add-items`

Add items to a named shopping list.

## Development

This repository uses Node.js and the [`anylist`](https://github.com/kevdliu/anylist) npm package, which is a reverse-engineered wrapper for the unofficial AnyList API.

### File Structure

```
.
├── scripts/
│   ├── anylist_bridge.js     # Main CLI bridge to the anylist package
│   ├── package.json
│   └── package-lock.json
├── SKILL.md                   # Hermes skill documentation
└── README.md                  # This file
```

### Testing

To test the create-recipe command:

```bash
export ANYLIST_EMAIL=your-email
export ANYLIST_PASSWORD=your-password

# Test creating a recipe
echo '{"name": "Test Recipe", "ingredients": [{"name": "test"}]}' \
  | node scripts/anylist_bridge.js create-recipe
```

## Rollback

This repository maintains full git history for easy rollback:

```bash
# View commit history
git log --oneline

# Revert to a previous version
git checkout <commit-hash>
```

## Troubleshooting

### "Resource not accessible by personal access token"
This usually means your AnyList credentials are incorrect or the API has changed.

### "AnyList list not found"
Double-check the exact name of your shopping list in AnyList (case-sensitive).

### Timeout when creating recipe
The AnyList API can be slow. Give it 30+ seconds. If it continues to timeout, check your network connection and AnyList account status.

## License

MIT

## Contributing

This skill is maintained by Hermes Agent. For issues or improvements, please submit a PR or open an issue on GitHub.
