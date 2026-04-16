import type { Tree, Node as SyntaxNode } from "web-tree-sitter"
import type { AstNode, AstEdge } from "./types"

type Extracted = { nodes: AstNode[]; edges: AstEdge[] }

function makeId(file: string, name: string): string {
  return `${file}#${name}`
}

export function extractPython(tree: Tree, file: string): Extracted {
  const nodes: AstNode[] = []
  const edges: AstEdge[] = []
  const seen = new Set<string>()

  function addNode(name: string, kind: AstNode["kind"], line: number, doc: string | null) {
    const id = makeId(file, name)
    if (seen.has(id)) return id
    seen.add(id)
    nodes.push({ id, kind, name, file, line, language: "python", docComment: doc })
    return id
  }

  const moduleId = addNode(file, "module", 0, null)

  function getDocstring(node: SyntaxNode): string | null {
    const body = node.childForFieldName("body")
    if (!body) return null
    const first = body.firstNamedChild
    if (first?.type === "expression_statement") {
      const expr = first.firstNamedChild
      if (expr?.type === "string") return expr.text.replace(/^"""|"""$/g, "").trim()
    }
    return null
  }

  function walk(node: SyntaxNode, parentId: string) {
    switch (node.type) {
      case "function_definition": {
        const nameNode = node.childForFieldName("name")
        if (!nameNode) break
        const name = nameNode.text
        const id = addNode(name, parentId === moduleId ? "function" : "method", node.startPosition.row + 1, getDocstring(node))
        edges.push({ source: parentId, target: id, kind: "contains" })
        walkChildren(node, id)
        return
      }
      case "class_definition": {
        const nameNode = node.childForFieldName("name")
        if (!nameNode) break
        const name = nameNode.text
        const id = addNode(name, "class", node.startPosition.row + 1, getDocstring(node))
        edges.push({ source: parentId, target: id, kind: "contains" })
        // inheritance
        const args = node.childForFieldName("superclasses")
        if (args) {
          for (const base of args.namedChildren) {
            edges.push({ source: id, target: `__unresolved__/${base.text}`, kind: "inherits" })
          }
        }
        walkChildren(node, id)
        return
      }
      case "import_statement":
      case "import_from_statement": {
        // from x import y  /  import x
        const moduleName = node.childForFieldName("module_name") ?? node.namedChildren.find((c: SyntaxNode) => c.type === "dotted_name")
        if (moduleName) {
          edges.push({ source: moduleId, target: `__unresolved__/${moduleName.text}`, kind: "imports" })
        }
        break
      }
      case "call": {
        const fnNode = node.childForFieldName("function")
        if (!fnNode) break
        const callee = fnNode.text.split("(")[0].trim()
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
