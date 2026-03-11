import {
  FileJson,
  FileCode2,
  FileType,
  File,
  FolderOpen,
} from "lucide-react";
import type { FileEntry } from "../types";

interface Props {
  files: FileEntry[];
  activeFile: string | null;
  onSelect: (path: string) => void;
}

function getIcon(path: string) {
  if (path.endsWith(".json"))
    return <FileJson className="w-4 h-4 text-yellow-400" />;
  if (path.endsWith(".tsx") || path.endsWith(".jsx"))
    return <FileCode2 className="w-4 h-4 text-blue-400" />;
  if (path.endsWith(".ts") || path.endsWith(".js"))
    return <FileCode2 className="w-4 h-4 text-yellow-300" />;
  if (path.endsWith(".css"))
    return <FileType className="w-4 h-4 text-purple-400" />;
  if (path.endsWith(".html"))
    return <FileType className="w-4 h-4 text-orange-400" />;
  return <File className="w-4 h-4 text-[#8888a0]" />;
}

interface TreeNode {
  name: string;
  path: string | null;
  children: TreeNode[];
}

function buildTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode = { name: "", path: null, children: [] };

  for (const file of files) {
    const parts = file.path.replace(/^\//, "").split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      let child = current.children.find((c) => c.name === name);

      if (!child) {
        child = {
          name,
          path: isFile ? file.path : null,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  return root.children;
}

function TreeItem({
  node,
  depth,
  activeFile,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activeFile: string | null;
  onSelect: (path: string) => void;
}) {
  const isDir = node.path === null;
  const isActive = node.path === activeFile;

  return (
    <>
      <button
        onClick={() => node.path && onSelect(node.path)}
        className={`w-full flex items-center gap-2 px-3 py-1 text-left text-xs hover:bg-surface-lighter/50 transition-colors ${
          isActive ? "bg-surface-lighter text-white" : "text-[#b0b0c8]"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {isDir ? (
          <FolderOpen className="w-4 h-4 text-brand-400 shrink-0" />
        ) : (
          <span className="shrink-0">{getIcon(node.name)}</span>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {node.children.map((child) => (
        <TreeItem
          key={child.name}
          node={child}
          depth={depth + 1}
          activeFile={activeFile}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export default function FileTree({ files, activeFile, onSelect }: Props) {
  const tree = buildTree(files);

  if (files.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-[#555570] border-b border-border">
        No files yet...
      </div>
    );
  }

  return (
    <div className="border-b border-border py-1 max-h-[200px] overflow-y-auto">
      {tree.map((node) => (
        <TreeItem
          key={node.name}
          node={node}
          depth={0}
          activeFile={activeFile}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
