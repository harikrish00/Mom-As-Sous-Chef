import { NextRequest, NextResponse } from "next/server";

interface RecipeData {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  image?: string;
}

// Helper function to extract text content from HTML
function extractTextContent(html: string, selector: string): string[] {
  const regex = new RegExp(
    `<[^>]*class="[^"]*${selector}[^"]*"[^>]*>([^<]*)</[^>]*>`,
    "gi"
  );
  const matches = html.match(regex);
  if (!matches) return [];

  return matches
    .map((match) => {
      const textMatch = match.match(/>([^<]*)</);
      return textMatch ? textMatch[1].trim() : "";
    })
    .filter((text) => text.length > 0);
}

// Helper function to extract structured data (JSON-LD)
function extractStructuredData(html: string): any {
  const scriptRegex =
    /<script type="application\/ld\+json">([^<]*)<\/script>/gi;
  const matches = html.match(scriptRegex);

  if (!matches) return null;

  for (const match of matches) {
    try {
      const jsonMatch = match.match(
        /<script type="application\/ld\+json">([^<]*)<\/script>/i
      );
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (jsonData["@type"] === "Recipe") {
          return jsonData;
        }
      }
    } catch (error) {
      console.error("Error parsing JSON-LD:", error);
    }
  }

  return null;
}

// Helper function to extract meta tags
function extractMetaContent(html: string, property: string): string | null {
  const regex = new RegExp(
    `<meta[^>]*property="${property}"[^>]*content="([^"]*)"`,
    "i"
  );
  const match = html.match(regex);
  return match ? match[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log(`Attempting to scrape recipe from: ${url}`);

    // Fetch the webpage content
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        {
          error: `Failed to fetch URL: HTTP ${response.status}. The website may be blocking requests or the URL may be invalid.`,
        },
        { status: 400 }
      );
    }

    const html = await response.text();
    console.log(`Successfully fetched HTML (${html.length} characters)`);

    // Try to extract structured data first (most reliable)
    const structuredData = extractStructuredData(html);

    if (structuredData) {
      console.log("Found structured data (JSON-LD)");
      const recipe: RecipeData = {
        title: structuredData.name || "Recipe",
        description: structuredData.description || "",
        ingredients: Array.isArray(structuredData.recipeIngredient)
          ? structuredData.recipeIngredient
          : [],
        instructions: Array.isArray(structuredData.recipeInstructions)
          ? structuredData.recipeInstructions.map((step: any) =>
              typeof step === "string" ? step : step.text || ""
            )
          : [],
        prepTime: structuredData.prepTime,
        cookTime: structuredData.cookTime,
        servings: structuredData.recipeYield,
        image: structuredData.image?.url || structuredData.image,
      };

      console.log(
        `Extracted recipe: ${recipe.title} with ${recipe.ingredients.length} ingredients and ${recipe.instructions.length} instructions`
      );
      return NextResponse.json(recipe);
    }

    console.log("No structured data found, trying pattern matching...");

    // Fallback: Try to extract from common recipe website patterns
    let title = "";
    let description = "";
    let ingredients: string[] = [];
    let instructions: string[] = [];
    let image = "";

    // Extract title from various common selectors
    const titleSelectors = [
      'h1[class*="title"]',
      'h1[class*="recipe"]',
      "h1",
      '[class*="title"]',
      '[class*="recipe-title"]',
    ];

    for (const selector of titleSelectors) {
      const titleMatch = html.match(
        new RegExp(`<${selector}[^>]*>([^<]*)</${selector}>`, "i")
      );
      if (titleMatch && titleMatch[1].trim()) {
        title = titleMatch[1].trim();
        console.log(`Found title: ${title}`);
        break;
      }
    }

    // Extract description
    const descMatch = html.match(
      /<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i
    );
    if (descMatch) {
      description = descMatch[1];
      console.log(`Found description: ${description.substring(0, 100)}...`);
    }

    // Extract ingredients (look for common patterns)
    const ingredientPatterns = [
      /<li[^>]*class="[^"]*ingredient[^"]*"[^>]*>([^<]*)<\/li>/gi,
      /<li[^>]*class="[^"]*ingredients[^"]*"[^>]*>([^<]*)<\/li>/gi,
      /<span[^>]*class="[^"]*ingredient[^"]*"[^>]*>([^<]*)<\/span>/gi,
      /<div[^>]*class="[^"]*ingredient[^"]*"[^>]*>([^<]*)<\/div>/gi,
    ];

    for (const pattern of ingredientPatterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        ingredients = matches
          .map((match) => {
            const textMatch = match.match(/>([^<]*)</);
            return textMatch ? textMatch[1].trim() : "";
          })
          .filter((text) => text.length > 0);
        if (ingredients.length > 0) {
          console.log(`Found ${ingredients.length} ingredients using pattern`);
          break;
        }
      }
    }

    // Extract instructions (look for common patterns)
    const instructionPatterns = [
      /<li[^>]*class="[^"]*instruction[^"]*"[^>]*>([^<]*)<\/li>/gi,
      /<li[^>]*class="[^"]*step[^"]*"[^>]*>([^<]*)<\/li>/gi,
      /<p[^>]*class="[^"]*instruction[^"]*"[^>]*>([^<]*)<\/p>/gi,
      /<div[^>]*class="[^"]*instruction[^"]*"[^>]*>([^<]*)<\/div>/gi,
    ];

    for (const pattern of instructionPatterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        instructions = matches
          .map((match) => {
            const textMatch = match.match(/>([^<]*)</);
            return textMatch ? textMatch[1].trim() : "";
          })
          .filter((text) => text.length > 0);
        if (instructions.length > 0) {
          console.log(
            `Found ${instructions.length} instructions using pattern`
          );
          break;
        }
      }
    }

    // Extract image
    const imageMatch = html.match(
      /<img[^>]*class="[^"]*recipe[^"]*"[^>]*src="([^"]*)"[^>]*>/i
    );
    if (imageMatch) {
      image = imageMatch[1];
      console.log(`Found image: ${image}`);
    }

    // If we couldn't extract meaningful data, return an error
    if (!title || ingredients.length === 0 || instructions.length === 0) {
      console.log(
        `Failed to extract recipe data. Title: ${title}, Ingredients: ${ingredients.length}, Instructions: ${instructions.length}`
      );
      return NextResponse.json(
        {
          error:
            "Could not extract recipe data from this URL. The website may not be a recipe site or may use an unsupported format. Please try a different recipe website.",
        },
        { status: 400 }
      );
    }

    const recipe: RecipeData = {
      title,
      description,
      ingredients,
      instructions,
      image,
    };

    console.log(`Successfully extracted recipe: ${recipe.title}`);
    return NextResponse.json(recipe);
  } catch (error) {
    console.error("Error scraping recipe:", error);

    // Return a more helpful error message based on the error type
    let errorMessage =
      "Failed to scrape recipe. Please check if the URL is accessible and contains a recipe.";

    if (error instanceof TypeError && error.message.includes("fetch")) {
      errorMessage =
        "Failed to fetch the URL. Please check if the URL is valid and accessible.";
    } else if (error instanceof Error) {
      errorMessage = `Scraping error: ${error.message}`;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
