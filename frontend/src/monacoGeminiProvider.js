// Gemini-powered code completion provider for Monaco Editor
import * as monaco from 'monaco-editor';

export function registerGeminiCompletionProvider(language = 'python') {
  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ['.', ' ', '(', '[', '{', '=', ':'],
    async provideCompletionItems(model, position) {
      const codeUntilCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      try {
        const response = await fetch('/api/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeUntilCursor, language }),
        });
        const data = await response.json();
        if (data.suggestion && data.suggestion.trim()) {
          return {
            suggestions: [
              {
                label: 'Gemini Suggestion',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: data.suggestion,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                },
                documentation: 'AI-powered suggestion from Gemini',
              },
            ],
          };
        }
      } catch (e) {
        // Fail silently
      }
      return { suggestions: [] };
    },
  });
}
