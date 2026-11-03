// Finish the new base-recipe steps when older tests are exercising a different rule.
// Recipe-specific tests exercise each of these actions separately.
export function finishRecipe(game, portion) {
  if (portion.type === "toast") {
    game.loadKaya();
    game.addIngredient(portion.id, "kaya");
  } else if (portion.type === "noodles") {
    if (!game.choppedVegetables) {
      game.loadVegetables();
      for (let i = 0; i < 3; i++) {
        game.chopVegetables();
        game.tick(0.2);
        game.tick(0.2);
      }
    }
    game.addIngredient(portion.id, "garnish");
  } else {
    game.addIngredient(portion.id, "milk");
    game.addIngredient(portion.id, "sugar");
  }
  return portion;
}
