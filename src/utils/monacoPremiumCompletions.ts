/**
 * Client-only Monaco completion snippets for premium editor UX.
 * Does not execute code; uses problem signature metadata when provided.
 */
import type { Monaco } from "@monaco-editor/react";
import type { editor, IRange, languages, Position } from "monaco-editor";

export type SignatureHints = {
  functionName?: string;
  className?: string;
  parameters?: Array<{ name: string; type: string }>;
  returnType?: string;
};

const disposables = new Map<string, { dispose: () => void }>();

export function registerPremiumCompletions(
  monaco: Monaco,
  languageId: string,
  hints: SignatureHints
) {
  const key = languageId;
  disposables.get(key)?.dispose();

  const fn = hints.functionName || "solve";
  const params = (hints.parameters || [])
    .map((p) => p.name)
    .join(languageId === "python" ? ", " : ", ");
  const cls = hints.className || "Solution";

  const provider = monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: [".", "("],
    provideCompletionItems(
      model: editor.ITextModel,
      position: Position
    ): { suggestions: languages.CompletionItem[] } {
      const word = model.getWordUntilPosition(position);
      const range: IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const Kind = monaco.languages.CompletionItemKind;
      const InsertAsSnippet =
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
      const items: languages.CompletionItem[] = [
        {
          label: fn,
          kind: Kind.Function,
          insertText: `${fn}(${params})`,
          detail: "Problem entry function",
          range,
        },
        {
          label: cls,
          kind: Kind.Class,
          insertText: cls,
          detail: "Solution class",
          range,
        },
      ];
      if (languageId === "python") {
        items.push({
          label: "list comprehension",
          kind: Kind.Snippet,
          insertText: "[${1:x} for ${1:x} in ${2:iterable}]",
          insertTextRules: InsertAsSnippet,
          detail: "Python snippet",
          range,
        });
      }
      if (languageId === "javascript") {
        items.push({
          label: "console.log",
          kind: Kind.Function,
          insertText: "console.log(${1})",
          insertTextRules: InsertAsSnippet,
          detail: "Debug print (run sandbox only)",
          range,
        });
      }
      return { suggestions: items };
    },
  });

  disposables.set(key, provider);
}
