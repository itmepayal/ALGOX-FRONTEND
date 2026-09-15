import type * as Monaco from "monaco-editor";
import prettier from "prettier/standalone";
import parserBabel from "prettier/plugins/babel";
import parserEstree from "prettier/plugins/estree";

let registered = false;

async function formatWithPrettier(
  code: string,
  language: "javascript" | "typescript",
  tabWidth: number,
): Promise<string> {
  return prettier.format(code, {
    parser: language === "typescript" ? "typescript" : "babel",
    plugins: [parserBabel, parserEstree],
    semi: true,
    singleQuote: false,
    trailingComma: "es5",
    tabWidth,
    useTabs: false,
    printWidth: 88,
  });
}

/**
 * Register real document + range formatters for JS/TS via Prettier.
 * Python / C++ / Java have no browser formatter here — Format Document
 * will no-op for those languages (Monaco shows nothing / leaves code unchanged).
 */
export function registerMonacoFormatters(monaco: typeof Monaco): void {
  if (registered) return;
  registered = true;

  const languages: Array<"javascript" | "typescript"> = [
    "javascript",
    "typescript",
  ];

  for (const language of languages) {
    monaco.languages.registerDocumentFormattingEditProvider(language, {
      async provideDocumentFormattingEdits(model) {
        const value = model.getValue();
        const tabWidth = model.getOptions().tabSize || 4;
        try {
          const formatted = await formatWithPrettier(value, language, tabWidth);
          if (formatted === value) return [];
          return [
            {
              range: model.getFullModelRange(),
              text: formatted,
            },
          ];
        } catch {
          return [];
        }
      },
    });

    monaco.languages.registerDocumentRangeFormattingEditProvider(language, {
      async provideDocumentRangeFormattingEdits(model, range) {
        const value = model.getValueInRange(range);
        const tabWidth = model.getOptions().tabSize || 4;
        try {
          const formatted = await formatWithPrettier(value, language, tabWidth);
          if (formatted === value) return [];
          return [{ range, text: formatted }];
        } catch {
          return [];
        }
      },
    });
  }
}
