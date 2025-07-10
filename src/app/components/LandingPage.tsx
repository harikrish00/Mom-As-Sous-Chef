"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface RecipeInfo {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  image?: string;
}

export default function LandingPage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recipeInfo, setRecipeInfo] = useState<RecipeInfo | null>(null);
  const [scrapingError, setScrapingError] = useState<string | null>(null);
  const [showPlaintext, setShowPlaintext] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const router = useRouter();

  const scrapeRecipe = async (recipeUrl: string) => {
    setIsLoading(true);
    setScrapingError(null);
    setRecipeInfo(null);

    try {
      const response = await fetch("/api/scrape-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: recipeUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to scrape recipe");
      }

      const data = await response.json();
      setRecipeInfo(data);
    } catch (error) {
      console.error("Error scraping recipe:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load recipe. Please check the URL and try again.";
      setScrapingError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCooking = () => {
    if (!url.trim()) {
      alert("Please enter a URL");
      return;
    }

    scrapeRecipe(url.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleStartCooking();
    }
  };

  const generatePlaintext = (recipe: RecipeInfo): string => {
    let plaintext = `${recipe.title}\n\n`;

    if (recipe.description) {
      plaintext += `${recipe.description}\n\n`;
    }

    // Add meta information
    const meta = [];
    if (recipe.prepTime) meta.push(`Prep Time: ${recipe.prepTime}`);
    if (recipe.cookTime) meta.push(`Cook Time: ${recipe.cookTime}`);
    if (recipe.servings) meta.push(`Servings: ${recipe.servings}`);

    if (meta.length > 0) {
      plaintext += `${meta.join(" | ")}\n\n`;
    }

    // Add ingredients
    plaintext += `INGREDIENTS:\n`;
    recipe.ingredients.forEach((ingredient, index) => {
      plaintext += `${index + 1}. ${ingredient}\n`;
    });

    plaintext += `\nINSTRUCTIONS:\n`;
    recipe.instructions.forEach((instruction, index) => {
      plaintext += `${index + 1}. ${instruction}\n`;
    });

    return plaintext;
  };

  const handleStartCookingWithRecipe = () => {
    if (!recipeInfo) return;

    // Encode the recipe data as URL parameters
    const recipeData = encodeURIComponent(JSON.stringify(recipeInfo));
    const plaintextRecipe = encodeURIComponent(generatePlaintext(recipeInfo));

    // Navigate to the cooking interface with recipe data
    router.push(
      `/app?agentConfig=chatSupervisor&url=${encodeURIComponent(
        url
      )}&recipeData=${recipeData}&plaintextRecipe=${plaintextRecipe}`
    );
  };

  const handleManualRecipeInput = () => {
    setShowManualInput(true);
    setScrapingError(null);
  };

  const handleManualRecipeSubmit = (manualRecipe: RecipeInfo) => {
    setRecipeInfo(manualRecipe);
    setShowManualInput(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/openai-logomark.svg"
              alt="OpenAI Logo"
              width={48}
              height={48}
              className="mb-2"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Realtime API Agents
          </h1>
          <p className="text-gray-600 text-lg">
            Start cooking with your favorite recipes
          </p>
        </div>

        {/* URL Input Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="mb-6">
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Recipe URL
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://example.com/recipe"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
            />
          </div>

          {/* Load Recipe Button */}
          <button
            onClick={handleStartCooking}
            disabled={isLoading || !url.trim()}
            className={`
              w-full py-3 px-6 rounded-lg font-semibold text-lg transition-all duration-200 transform mb-4
              ${
                isLoading || !url.trim()
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 shadow-lg hover:shadow-xl"
              }
            `}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Loading Recipe...
              </div>
            ) : (
              "Load Recipe"
            )}
          </button>

          {/* Manual Input Button */}
          <button
            onClick={handleManualRecipeInput}
            className="w-full py-3 px-6 rounded-lg font-semibold text-lg transition-all duration-200 transform bg-green-600 hover:bg-green-700 text-white hover:scale-105 shadow-lg hover:shadow-xl"
          >
            Enter Recipe Manually
          </button>

          {/* Error Message */}
          {scrapingError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm mb-2">{scrapingError}</p>
              <p className="text-red-500 text-xs">
                Tip: Try entering the recipe manually using the button above, or
                try a different recipe URL.
              </p>
            </div>
          )}
        </div>

        {/* Manual Recipe Input Modal */}
        {showManualInput && (
          <ManualRecipeInput
            onSubmit={handleManualRecipeSubmit}
            onCancel={() => setShowManualInput(false)}
          />
        )}

        {/* Recipe Display */}
        {recipeInfo && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* View Toggle */}
            <div className="flex justify-center mb-6">
              <div className="bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setShowPlaintext(false)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    !showPlaintext
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Formatted View
                </button>
                <button
                  onClick={() => setShowPlaintext(true)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    showPlaintext
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Plaintext View
                </button>
              </div>
            </div>

            {!showPlaintext ? (
              /* Formatted View */
              <div className="grid md:grid-cols-2 gap-8">
                {/* Recipe Header */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {recipeInfo.title}
                  </h2>
                  <p className="text-gray-600 mb-4">{recipeInfo.description}</p>

                  {/* Recipe Meta */}
                  <div className="flex gap-4 text-sm text-gray-500 mb-6">
                    {recipeInfo.prepTime && (
                      <div>
                        <span className="font-medium">Prep:</span>{" "}
                        {recipeInfo.prepTime}
                      </div>
                    )}
                    {recipeInfo.cookTime && (
                      <div>
                        <span className="font-medium">Cook:</span>{" "}
                        {recipeInfo.cookTime}
                      </div>
                    )}
                    {recipeInfo.servings && (
                      <div>
                        <span className="font-medium">Servings:</span>{" "}
                        {recipeInfo.servings}
                      </div>
                    )}
                  </div>

                  {/* Ingredients */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Ingredients
                    </h3>
                    <ul className="space-y-2">
                      {recipeInfo.ingredients.map((ingredient, index) => (
                        <li key={index} className="flex items-start">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                          <span className="text-gray-700">{ingredient}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recipe Image and Instructions */}
                <div>
                  {recipeInfo.image && (
                    <div className="mb-6">
                      <Image
                        src={recipeInfo.image}
                        alt={recipeInfo.title}
                        width={400}
                        height={300}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>
                  )}

                  {/* Instructions */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Instructions
                    </h3>
                    <ol className="space-y-3">
                      {recipeInfo.instructions.map((instruction, index) => (
                        <li key={index} className="flex">
                          <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium mr-3 flex-shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-gray-700">{instruction}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            ) : (
              /* Plaintext View */
              <div>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Plaintext Recipe
                    </h3>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          generatePlaintext(recipeInfo)
                        );
                        // You could add a toast notification here
                      }}
                      className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-white p-4 rounded border overflow-auto max-h-96">
                    {generatePlaintext(recipeInfo)}
                  </pre>
                </div>
              </div>
            )}

            {/* Start Cooking Button */}
            <div className="mt-8 text-center">
              <button
                onClick={handleStartCookingWithRecipe}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Start Cooking
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Manual Recipe Input Component
function ManualRecipeInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (recipe: RecipeInfo) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState([""]);
  const [instructions, setInstructions] = useState([""]);
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const recipe: RecipeInfo = {
      title: title.trim(),
      description: description.trim(),
      ingredients: ingredients.filter((i) => i.trim()),
      instructions: instructions.filter((i) => i.trim()),
      prepTime: prepTime.trim() || undefined,
      cookTime: cookTime.trim() || undefined,
      servings: servings.trim() || undefined,
    };

    onSubmit(recipe);
  };

  const addIngredient = () => {
    setIngredients([...ingredients, ""]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = value;
    setIngredients(newIngredients);
  };

  const addInstruction = () => {
    setInstructions([...instructions, ""]);
  };

  const removeInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  const updateInstruction = (index: number, value: string) => {
    const newInstructions = [...instructions];
    newInstructions[index] = value;
    setInstructions(newInstructions);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Enter Recipe Manually
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Recipe Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipe Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Chocolate Chip Cookies"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description of the recipe..."
            />
          </div>

          {/* Meta Information */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prep Time
              </label>
              <input
                type="text"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 15 minutes"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cook Time
              </label>
              <input
                type="text"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 30 minutes"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Servings
              </label>
              <input
                type="text"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 4 servings"
              />
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Ingredients *
              </label>
              <button
                type="button"
                onClick={addIngredient}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md"
              >
                + Add Ingredient
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ingredient, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={ingredient}
                    onChange={(e) => updateIngredient(index, e.target.value)}
                    required
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`Ingredient ${index + 1}`}
                  />
                  {ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="px-3 py-3 text-red-600 hover:text-red-700"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Instructions *
              </label>
              <button
                type="button"
                onClick={addInstruction}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md"
              >
                + Add Step
              </button>
            </div>
            <div className="space-y-2">
              {instructions.map((instruction, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium mt-3 flex-shrink-0">
                        {index + 1}
                      </span>
                      <textarea
                        value={instruction}
                        onChange={(e) =>
                          updateInstruction(index, e.target.value)
                        }
                        required
                        rows={2}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Step ${index + 1}`}
                      />
                    </div>
                  </div>
                  {instructions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInstruction(index)}
                      className="px-3 py-3 text-red-600 hover:text-red-700"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-6 rounded-lg font-semibold text-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-6 rounded-lg font-semibold text-lg bg-green-600 hover:bg-green-700 text-white"
            >
              Save Recipe
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
