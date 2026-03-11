import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";

interface Props {
  content: string;
  filePath: string | null;
  readOnly: boolean;
}

function getLanguage(path: string | null) {
  if (!path) return [];
  if (path.endsWith(".tsx") || path.endsWith(".jsx"))
    return [javascript({ jsx: true, typescript: path.endsWith(".tsx") })];
  if (path.endsWith(".ts")) return [javascript({ typescript: true })];
  if (path.endsWith(".js")) return [javascript()];
  if (path.endsWith(".css")) return [css()];
  if (path.endsWith(".html")) return [html()];
  if (path.endsWith(".json")) return [json()];
  return [];
}

export default function CodeEditor({ content, filePath, readOnly }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        oneDark,
        EditorState.readOnly.of(readOnly),
        ...getLanguage(filePath),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [filePath]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== content) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      });
    }
  }, [content]);

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[#555570]">
        Select a file to view its code
      </div>
    );
  }

  return <div ref={containerRef} className="h-full overflow-auto" />;
}
