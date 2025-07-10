import { NextRequest, NextResponse } from "next/server";

interface TestResult {
  name: string;
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: { [key: string]: string };
  contentLength?: number;
  hasStructuredData?: boolean;
  hasRecipeKeywords?: boolean;
  error?: string;
}

interface TestResults {
  url: string;
  timestamp: string;
  tests: TestResult[];
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    console.log(`Testing URL: ${url}`);

    // Test the URL with different approaches
    const results: TestResults = {
      url,
      timestamp: new Date().toISOString(),
      tests: [],
    };

    // Test 1: Basic fetch
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      results.tests.push({
        name: "Basic Fetch",
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (response.ok) {
        const html = await response.text();
        results.tests.push({
          name: "HTML Content",
          success: true,
          contentLength: html.length,
          hasStructuredData: html.includes("application/ld+json"),
          hasRecipeKeywords:
            html.toLowerCase().includes("recipe") ||
            html.toLowerCase().includes("ingredient"),
        });
      }
    } catch (error) {
      results.tests.push({
        name: "Basic Fetch",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in test scrape:", error);
    return NextResponse.json({ error: "Test failed" }, { status: 500 });
  }
}
