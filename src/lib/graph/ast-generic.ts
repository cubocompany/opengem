import type { Tree, Node as SyntaxNode } from "web-tree-sitter"
import type { AstNode, AstEdge, AstNodeKind } from "./types"
import type { LangConfig, NameStrategy } from "./language-configs"

type Extracted = { nodes: AstNode[]; edges: AstEdge[] }

function makeId(file: string, name: string): string {
  return `${file}#${name}`
}

// ── Name extraction ───────────────────────────────────────────────────────────

function unwrapDeclarator(node: SyntaxNode): string | null {
  // C/C++: function_definition → declarator → function_declarator → declarator → identifier
  // Walk "declarator" fields until we hit an identifier
  let cur: SyntaxNode | null = node
  for (let i = 0; i < 5 && cur; i++) {
    const d = cur.childForFieldName("declarator")
    if (!d) break
    if (d.type === "identifier") return d.text
    if (d.type === "qualified_identifier") {
      // C++ qualified name: Foo::bar — take the last identifier
      const last = [...d.children].reverse().find(c => c.type === "identifier" || c.type === "destructor_name")
      return last?.text ?? d.text
    }
    cur = d
  }
  return cur?.text ?? null
}

function extractName(node: SyntaxNode, strategies: NameStrategy[]): string | null {
  for (const s of strategies) {
    if ("declarator" in s) {
      const name = unwrapDeclarator(node)
      if (name) return name
    } else if ("field" in s) {
      const child = node.childForFieldName(s.field)
      if (child) return child.text
    } else if ("type" in s) {
      const child = node.children.find(c => c.type === s.type && c.isNamed)
      if (child) return child.text
    }
  }
  return null
}

// ── Import target extraction ──────────────────────────────────────────────────

function extractImportTarget(node: SyntaxNode, cfg: LangConfig): string | null {
  for (const field of cfg.importPathFields) {
    const child = node.childForFieldName(field)
    if (child) return child.text.replace(/['"]/g, "").trim()
  }
  // Fallback: first string literal descendant (BFS)
  const STRING_TYPES = new Set(["string", "string_literal", "interpreted_string_literal"])
  function findString(n: SyntaxNode): SyntaxNode | null {
    if (STRING_TYPES.has(n.type)) return n
    for (const child of n.children) {
      const found = findString(child)
      if (found) return found
    }
    return null
  }
  const str = findString(node)
  return str ? str.text.replace(/['"]/g, "").trim() : null
}

// ── Call target extraction ────────────────────────────────────────────────────

function extractCallTarget(node: SyntaxNode, cfg: LangConfig): string | null {
  const child = node.childForFieldName(cfg.callTargetField)
  if (!child) return null
  // Qualified call (foo.bar, foo::bar) — take the last identifier
  if (child.type === "selector_expression" || child.type === "member_expression" || child.type === "field_expression") {
    const id = child.children.reverse().find(c => c.type === "identifier" || c.type === "field_identifier")
    return id?.text ?? child.text
  }
  if (child.type === "identifier" || child.type === "field_identifier") return child.text
  return null
}

// ── Main extractor ────────────────────────────────────────────────────────────

export function extractGeneric(tree: Tree, file: string, langKey: string, cfg: LangConfig): Extracted {
  const nodes: AstNode[] = []
  const edges: AstEdge[] = []
  const seen = new Set<string>()

  function addNode(name: string, kind: AstNodeKind, line: number, docComment: string | null): string {
    const id = makeId(file, name)
    if (!seen.has(id)) {
      seen.add(id)
      nodes.push({ id, kind, name, file, line, language: langKey as never, docComment })
    }
    return id
  }

  const moduleId = addNode(file, "module", 0, null)

  function getDocComment(node: SyntaxNode): string | null {
    const prev = node.previousNamedSibling
    if (!prev) return null
    if (prev.type === "comment" || prev.type === "line_comment" || prev.type === "block_comment" || prev.type === "doc_comment") {
      return prev.text.replace(/^\/[/*]+\s*/gm, "").replace(/\s*\*\/\s*$/, "").trim()
    }
    return null
  }

  const allFnTypes = new Set([...cfg.functionNodes, ...cfg.methodNodes])
  const allClassTypes = new Set(cfg.classNodes)
  const allImportTypes = new Set(cfg.importNodes)
  const allCallTypes = new Set(cfg.callNodes)

  let currentClassId: string | null = null

  function walk(node: SyntaxNode) {
    const parentClassId = currentClassId

    if (allClassTypes.has(node.type)) {
      const name = extractName(node, cfg.nameStrategy)
      if (name) {
        const id = addNode(name, "class", node.startPosition.row + 1, getDocComment(node))
        edges.push({ source: moduleId, target: id, kind: "contains" })
        currentClassId = id
        for (const child of node.children) walk(child)
        currentClassId = parentClassId
        return
      }
    }

    if (allFnTypes.has(node.type)) {
      const name = extractName(node, cfg.nameStrategy)
      if (name) {
        const kind: AstNodeKind = currentClassId ? "method" : "function"
        const id = addNode(name, kind, node.startPosition.row + 1, getDocComment(node))
        const parentId = currentClassId ?? moduleId
        edges.push({ source: parentId, target: id, kind: "contains" })

        // Calls within this function
        walkCalls(node, id)
        return
      }
    }

    if (allImportTypes.has(node.type)) {
      const target = extractImportTarget(node, cfg)
      if (target) {
        edges.push({ source: moduleId, target: `__unresolved__/${target}`, kind: "imports" })
      }
      return
    }

    for (const child of node.children) walk(child)
  }

  function walkCalls(node: SyntaxNode, parentFnId: string) {
    if (allCallTypes.has(node.type)) {
      const target = extractCallTarget(node, cfg)
      if (target) {
        edges.push({ source: parentFnId, target: `__unresolved__/${target}`, kind: "calls" })
      }
    }
    for (const child of node.children) walkCalls(child, parentFnId)
  }

  for (const child of tree.rootNode.children) walk(child)

  return { nodes, edges }
}
