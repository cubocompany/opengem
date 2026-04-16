import type { Tree, Node as SyntaxNode } from "web-tree-sitter"
import type { AstNode, AstEdge, AstNodeKind } from "./types"

function makeId(file: string, name: string): string {
  return `${file}#${name}`
}

function getDocComment(node: SyntaxNode): string | null {
  const prev = node.previousNamedSibling
  if (prev?.type === "comment") return prev.text.replace(/^\/\*\*?|\*\/$/g, "").replace(/^\s*\*\s?/gm, "").trim()
  return null
}

type Extracted = { nodes: AstNode[]; edges: AstEdge[] }

export function extractJsTs(
  tree: Tree,
  file: string,
  language: "javascript" | "typescript",
): Extracted {
  const nodes: AstNode[] = []
  const edges: AstEdge[] = []
  const seen = new Set<string>()

  function addNode(name: string, kind: AstNodeKind, line: number, doc: string | null) {
    const id = makeId(file, name)
    if (seen.has(id)) return id
    seen.add(id)
    nodes.push({ id, kind, name, file, line, language, docComment: doc })
    return id
  }

  // Module-level node
  const moduleId = addNode(file, "module", 0, null)

  function walk(node: SyntaxNode, parentId: string) {
    switch (node.type) {
      case "function_declaration":
      case "function": {
        const nameNode = node.childForFieldName("name")
        if (!nameNode) break
        const name = nameNode.text
        const id = addNode(name, "function", node.startPosition.row + 1, getDocComment(node))
        edges.push({ source: parentId, target: id, kind: "contains" })
        walkChildren(node, id)
        return
      }
      case "class_declaration":
      case "class": {
        const nameNode = node.childForFieldName("name")
        if (!nameNode) break
        const name = nameNode.text
        const id = addNode(name, "class", node.startPosition.row + 1, getDocComment(node))
        edges.push({ source: parentId, target: id, kind: "contains" })
        // inheritance
        const heritage = node.childForFieldName("superclass") ?? node.childForFieldName("extends")
        if (heritage) {
          edges.push({ source: id, target: `__unresolved__/${heritage.text}`, kind: "inherits" })
        }
        walkChildren(node, id)
        return
      }
      case "method_definition":
      case "public_field_definition": {
        const nameNode = node.childForFieldName("name")
        if (!nameNode) break
        const name = `${parentId.split("#")[1] ?? "?"}.${nameNode.text}`
        const id = addNode(name, "method", node.startPosition.row + 1, getDocComment(node))
        edges.push({ source: parentId, target: id, kind: "defines" })
        walkChildren(node, id)
        return
      }
      case "arrow_function": {
        // Named arrows assigned to variables are captured by variable_declarator
        walkChildren(node, parentId)
        return
      }
      case "variable_declarator": {
        const nameNode = node.childForFieldName("name")
        const valueNode = node.childForFieldName("value")
        if (!nameNode) break
        if (valueNode?.type === "arrow_function" || valueNode?.type === "function") {
          const name = nameNode.text
          const id = addNode(name, "function", node.startPosition.row + 1, getDocComment(node))
          edges.push({ source: parentId, target: id, kind: "contains" })
          walkChildren(node, id)
          return
        }
        break
      }
      case "import_statement": {
        const sourceNode = node.childForFieldName("source")
        if (!sourceNode) break
        const source = sourceNode.text.replace(/['"]/g, "")
        edges.push({ source: moduleId, target: `__unresolved__/${source}`, kind: "imports" })
        break
      }
      case "call_expression": {
        const calleeNode = node.childForFieldName("function")
        if (!calleeNode) break
        const callee = calleeNode.text.split("(")[0].trim()
        if (callee && !callee.includes(" ")) {
          edges.push({ source: parentId, target: `__unresolved__/${callee}`, kind: "calls" })
        }
        walkChildren(node, parentId)
        return
      }
    }
    walkChildren(node, parentId)
  }

  function walkChildren(node: SyntaxNode, parentId: string) {
    for (const child of node.children) {
      walk(child, parentId)
    }
  }

  walkChildren(tree.rootNode, moduleId)
  return { nodes, edges }
}
