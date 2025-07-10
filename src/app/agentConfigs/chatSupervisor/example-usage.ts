// Example usage of the recipe injection functionality
import { createChatAgent } from "./index";

// Example 1: Create an agent without recipe context (default behavior)
const defaultAgent = createChatAgent();

// Example 2: Create an agent with recipe context
const recipeText = `Chocolate Chip Cookies

INGREDIENTS:
1. 2 1/4 cups all-purpose flour
2. 1 tsp baking soda
3. 1 tsp salt
4. 1 cup (2 sticks) butter, softened
5. 3/4 cup granulated sugar
6. 3/4 cup packed brown sugar
7. 2 large eggs
8. 2 tsp vanilla extract
9. 2 cups chocolate chips

INSTRUCTIONS:
1. Preheat oven to 375°F (190°C)
2. Mix flour, baking soda, and salt in a small bowl
3. Beat butter, granulated sugar, and brown sugar until creamy
4. Add eggs and vanilla; beat well
5. Gradually beat in flour mixture
6. Stir in chocolate chips
7. Drop by rounded tablespoon onto ungreased baking sheets
8. Bake for 9 to 11 minutes or until golden brown
9. Cool on baking sheets for 2 minutes; remove to wire racks to cool completely`;

const agentWithRecipe = createChatAgent(recipeText);

// Example 3: Using the agent in a scenario
export const chatSupervisorWithRecipe = [agentWithRecipe];

// Example 4: Dynamic recipe injection (as used in App.tsx)
export function createAgentWithRecipe(recipeText?: string) {
  if (recipeText) {
    return createChatAgent(recipeText);
  }
  return createChatAgent(); // Default agent without recipe
}

// Usage in App.tsx would be:
// const agent = createAgentWithRecipe(decodedRecipe);
// This replaces the first agent in the scenario with one that has recipe context
