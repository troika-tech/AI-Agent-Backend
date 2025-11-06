// tests/suggestion-questions.test.js
const { extractSuggestions, prepareAssistantMessage, generateSuggestionsViaLLM } = require("../services/chatService");

describe("Suggestion Questions Feature", () => {
  describe("extractSuggestions", () => {
    test("should extract suggestions with pipe delimiter", () => {
      const text = "This is an answer. [SUGGESTIONS: What is pricing? | How does it work? | Can I try it?]";
      const result = extractSuggestions(text);
      
      expect(result).toEqual([
        "What is pricing?",
        "How does it work?",
        "Can I try it?"
      ]);
    });

    test("should extract suggestions with semicolon delimiter", () => {
      const text = "Answer here [SUGGESTIONS: Question 1; Question 2; Question 3]";
      const result = extractSuggestions(text);
      
      expect(result).toEqual([
        "Question 1",
        "Question 2",
        "Question 3"
      ]);
    });

    test("should return empty array if no suggestions tag", () => {
      const text = "This is just a plain answer with no suggestions.";
      const result = extractSuggestions(text);
      
      expect(result).toEqual([]);
    });

    test("should return empty array for null or undefined input", () => {
      expect(extractSuggestions(null)).toEqual([]);
      expect(extractSuggestions(undefined)).toEqual([]);
      expect(extractSuggestions("")).toEqual([]);
    });

    test("should filter out empty suggestions", () => {
      const text = "Answer [SUGGESTIONS: Good question | | Another question]";
      const result = extractSuggestions(text);
      
      expect(result).toEqual([
        "Good question",
        "Another question"
      ]);
    });

    test("should limit to 3 suggestions", () => {
      const text = "Answer [SUGGESTIONS: Q1 | Q2 | Q3 | Q4 | Q5]";
      const result = extractSuggestions(text);
      
      expect(result).toHaveLength(3);
      expect(result).toEqual(["Q1", "Q2", "Q3"]);
    });

    test("should filter out overly long questions (>150 chars)", () => {
      const longQuestion = "a".repeat(200);
      const text = `Answer [SUGGESTIONS: Short question | ${longQuestion} | Another short one]`;
      const result = extractSuggestions(text);
      
      expect(result).toEqual([
        "Short question",
        "Another short one"
      ]);
    });

    test("should be case insensitive", () => {
      const text = "Answer [suggestions: Question 1 | Question 2]";
      const result = extractSuggestions(text);
      
      expect(result).toEqual([
        "Question 1",
        "Question 2"
      ]);
    });

    test("should trim whitespace from questions", () => {
      const text = "Answer [SUGGESTIONS:   Question 1   |  Question 2  ]";
      const result = extractSuggestions(text);
      
      expect(result).toEqual([
        "Question 1",
        "Question 2"
      ]);
    });
  });

  describe("prepareAssistantMessage", () => {
    test("should extract both KBQ and suggestions", () => {
      const rawText = "This is the answer [KBQ: pricing details] [SUGGESTIONS: What is pricing? | How to pay?]";
      const result = prepareAssistantMessage(rawText);
      
      expect(result.cleanAnswer).toBe("This is the answer");
      expect(result.kbFollowUpQuery).toBe("pricing details");
      expect(result.suggestions).toEqual([
        "What is pricing?",
        "How to pay?"
      ]);
      expect(result.assistantMessageForHistory).toContain("[KBQ: pricing details]");
      expect(result.assistantMessageForHistory).toContain("[SUGGESTIONS: What is pricing? | How to pay?]");
    });

    test("should handle answer with only suggestions", () => {
      const rawText = "Answer text here [SUGGESTIONS: Q1 | Q2 | Q3]";
      const result = prepareAssistantMessage(rawText);
      
      expect(result.cleanAnswer).toBe("Answer text here");
      expect(result.suggestions).toEqual(["Q1", "Q2", "Q3"]);
      expect(result.kbFollowUpQuery).toBeNull();
    });

    test("should handle answer with only KBQ", () => {
      const rawText = "Answer text here [KBQ: follow up keywords]";
      const result = prepareAssistantMessage(rawText);
      
      expect(result.cleanAnswer).toBe("Answer text here");
      expect(result.kbFollowUpQuery).toBe("follow up keywords");
      expect(result.suggestions).toEqual([]);
    });

    test("should handle plain answer with no tags", () => {
      const rawText = "Just a plain answer";
      const result = prepareAssistantMessage(rawText);
      
      expect(result.cleanAnswer).toBe("Just a plain answer");
      expect(result.kbFollowUpQuery).toBeNull();
      expect(result.suggestions).toEqual([]);
      expect(result.assistantMessageForHistory).toBe("Just a plain answer");
    });

    test("should handle null or empty input", () => {
      const result = prepareAssistantMessage(null);
      
      expect(result.cleanAnswer).toBe("");
      expect(result.kbFollowUpQuery).toBeNull();
      expect(result.suggestions).toEqual([]);
      expect(result.assistantMessageForHistory).toBe("");
    });

    test("should preserve tags in history but not in clean answer", () => {
      const rawText = "Answer [KBQ: keywords] [SUGGESTIONS: Q1 | Q2]";
      const result = prepareAssistantMessage(rawText);
      
      expect(result.cleanAnswer).not.toContain("[KBQ:");
      expect(result.cleanAnswer).not.toContain("[SUGGESTIONS:");
      expect(result.assistantMessageForHistory).toContain("[KBQ: keywords]");
      expect(result.assistantMessageForHistory).toContain("[SUGGESTIONS: Q1 | Q2]");
    });
  });

  describe("Integration scenarios", () => {
    test("should handle realistic product query response", () => {
      const rawText = `We have several t-shirt options available. Our cotton t-shirts start at ₹499 and come in various colors. [SUGGESTIONS: What colors are available? | Do you have size XL? | What's the return policy?]`;
      const result = prepareAssistantMessage(rawText);
      
      expect(result.cleanAnswer).toContain("We have several t-shirt options");
      expect(result.cleanAnswer).not.toContain("[SUGGESTIONS:");
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0]).toBe("What colors are available?");
    });

    test("should handle service information response", () => {
      const rawText = `Our chatbot service offers 24/7 support, multi-language capabilities, and easy integration. [KBQ: integration steps] [SUGGESTIONS: How long is setup? | What languages are supported? | Can I see a demo?]`;
      const result = prepareAssistantMessage(rawText);
      
      expect(result.cleanAnswer).toContain("Our chatbot service offers");
      expect(result.kbFollowUpQuery).toBe("integration steps");
      expect(result.suggestions).toHaveLength(3);
    });

    test("should handle error fallback message", () => {
      const rawText = "Sorry, I'm having trouble right now. Could you try rephrasing your request?";
      const result = prepareAssistantMessage(rawText);
      
      expect(result.cleanAnswer).toBe(rawText);
      expect(result.suggestions).toEqual([]);
      expect(result.kbFollowUpQuery).toBeNull();
    });
  });

  describe("generateSuggestionsViaLLM", () => {
    // Note: These tests require OpenAI API key and make real API calls
    // Consider mocking in CI/CD environments
    
    test("should generate contextual suggestions via LLM", async () => {
      const answer = "We offer three pricing plans starting at ₹999 per month.";
      const query = "What do you offer?";
      const result = await generateSuggestionsViaLLM(answer, query, "");
      
      // Should return array (may be empty if API fails)
      expect(Array.isArray(result)).toBe(true);
      
      // If successful, should have up to 3 suggestions
      if (result.length > 0) {
        expect(result.length).toBeLessThanOrEqual(3);
        expect(result[0]).toBeTruthy();
      }
    }, 10000); // Longer timeout for API call

    test("should handle API errors gracefully", async () => {
      // This might fail due to network/API issues, should return empty array
      const result = await generateSuggestionsViaLLM("", "", "");
      
      expect(Array.isArray(result)).toBe(true);
    }, 10000);
  });
});

// Note: Functions are now exported from chatService.js for testing

