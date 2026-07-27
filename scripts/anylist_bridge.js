#!/usr/bin/env node
/**
 * Bridge to the unofficial AnyList API (via the `anylist` npm package).
 * Reads ANYLIST_EMAIL and ANYLIST_PASSWORD from environment variables.
 *
 * Commands:
 *   get-recipes   — fetch all recipes, write as JSON to stdout
 *   add-items     — read { list, items } from stdin, add each item
 *                    to the named shopping list
 *   create-recipe — read recipe JSON from stdin, create a new recipe
 */

const AnyList = require('anylist');

// The anylist package uses console.info/log for progress messages (e.g. "Connected to websocket").
// Redirect them to stderr so stdout carries only our JSON output.
console.info = (...args) => process.stderr.write(args.join(' ') + '\n');
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');

async function getRecipes(al) {
  const recipes = (await al.getRecipes()).map(r => ({
    identifier: r.identifier,
    name: r.name,
    ingredients: (r.ingredients || []).map(i =>
      i.rawIngredient || [i.quantity, i.name].filter(Boolean).join(' ')
    ),
    steps: r.preparationSteps || [],
    prep_time_minutes: r.prepTime ? Math.round(r.prepTime / 60) : null,
    cook_time_minutes: r.cookTime ? Math.round(r.cookTime / 60) : null,
    servings: r.servings || null,
    notes: r.note || null,
    rating: r.rating || null,
    source_url: r.sourceUrl || null,
    source_name: r.sourceName || null,
  }));
  process.stdout.write(JSON.stringify(recipes));
}

async function addItems(al) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const { list: listName, items } = JSON.parse(chunks.join(''));

  await al.getLists();
  const list = al.getListByName(listName);
  if (!list) {
    process.stderr.write(JSON.stringify({ error: `AnyList list "${listName}" not found` }));
    process.exit(1);
  }

  for (const name of items) {
    const item = al.createItem({ name });
    await list.addItem(item);
  }

  process.stdout.write(JSON.stringify({ status: 'success', items_added: items.length }));
}

async function createRecipe(al) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const recipeData = JSON.parse(chunks.join(''));

  // Validate required fields
  if (!recipeData.name) {
    process.stderr.write(JSON.stringify({ error: 'Recipe name is required' }));
    process.exit(1);
  }
  if (!recipeData.ingredients || !Array.isArray(recipeData.ingredients)) {
    process.stderr.write(JSON.stringify({ error: 'Recipe ingredients must be an array' }));
    process.exit(1);
  }

  try {
    // Build the recipe object for AnyList API
    const recipe = await al.createRecipe({
      name: recipeData.name,
      ingredients: recipeData.ingredients, // Array of {rawIngredient, name, quantity, note}
      preparationSteps: recipeData.preparation_steps || recipeData.steps || [],
      servings: recipeData.servings || null,
      prepTime: recipeData.prep_time_minutes ? recipeData.prep_time_minutes * 60 : null,
      cookTime: recipeData.cook_time_minutes ? recipeData.cook_time_minutes * 60 : null,
      note: recipeData.notes || null,
      rating: recipeData.rating || null,
      sourceUrl: recipeData.source_url || null,
      sourceName: recipeData.source_name || null,
      nutritionalInfo: recipeData.nutritional_info || null,
      scaleFactor: recipeData.scale_factor || 1,
      creationTimestamp: Date.now() / 1000,
      timestamp: Date.now() / 1000,
    });

    // Persist the recipe to AnyList
    await recipe.save();

    process.stdout.write(JSON.stringify({
      status: 'success',
      recipe_name: recipe.name,
      recipe_identifier: recipe.identifier,
    }));
  } catch (e) {
    process.stderr.write(JSON.stringify({ error: e.message }));
    process.exit(1);
  }
}

async function main() {
  const email = process.env.ANYLIST_EMAIL;
  const password = process.env.ANYLIST_PASSWORD;
  if (!email || !password) {
    process.stderr.write(JSON.stringify({ error: 'ANYLIST_EMAIL and ANYLIST_PASSWORD must be set' }));
    process.exit(1);
  }

  // Accept both "get-recipes" (skill CLI name) and legacy "get-recipes"/no-arg default.
  const rawCommand = process.argv[2] || 'get-recipes';
  const command = rawCommand === 'get-recipes' ? 'get-recipes' : rawCommand;
  const al = new AnyList({ email, password });
  await al.login();

  if (command === 'add-items') {
    await addItems(al);
  } else if (command === 'create-recipe') {
    await createRecipe(al);
  } else {
    await getRecipes(al);
  }

  await al.teardown();
}

main().catch(e => {
  process.stderr.write(JSON.stringify({ error: e.message }));
  process.exit(1);
});
