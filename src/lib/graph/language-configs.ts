// ── Language configuration for generic AST extraction ────────────────────────
//
// Each config defines which tree-sitter node types map to functions, classes,
// methods, imports, and calls, plus how to extract names from those nodes.

export type LangConfig = {
  /** File extensions handled by this config */
  extensions: string[]
  /** Node types that represent standalone functions / procedures */
  functionNodes: string[]
  /** Node types that represent methods inside a class/struct/impl */
  methodNodes: string[]
  /** Node types that represent classes, structs, enums, interfaces, traits */
  classNodes: string[]
  /** Node types that represent import/use/require statements */
  importNodes: string[]
  /** Node types that represent function/method call expressions */
  callNodes: string[]
  /**
   * How to extract the symbol name from a matched node.
   * Strategies (tried in order):
   *   { field: "name" }         — node.childForFieldName("name")?.text
   *   { type: "identifier" }    — first named child with that type
   *   { declarator: true }      — C/C++ declarator chain unwrap
   */
  nameStrategy: NameStrategy[]
  /** Field name(s) to try for import path/module target */
  importPathFields: string[]
  /** Field/type to get the callee name from a call_expression */
  callTargetField: string
}

export type NameStrategy =
  | { field: string }
  | { type: string }
  | { declarator: true }

// ── Per-language configs ──────────────────────────────────────────────────────

export const LANGUAGE_CONFIGS: Record<string, LangConfig> = {
  go: {
    extensions: [".go"],
    functionNodes: ["function_declaration"],
    methodNodes: ["method_declaration"],
    classNodes: ["type_declaration"],          // covers struct / interface types
    importNodes: ["import_declaration", "import_spec"],
    callNodes: ["call_expression"],
    nameStrategy: [{ field: "name" }],
    importPathFields: ["path"],
    callTargetField: "function",
  },

  rust: {
    extensions: [".rs"],
    functionNodes: ["function_item"],
    methodNodes: [],                           // methods live inside impl_item blocks
    classNodes: ["struct_item", "enum_item", "trait_item", "impl_item"],
    importNodes: ["use_declaration"],
    callNodes: ["call_expression", "macro_invocation"],
    nameStrategy: [{ field: "name" }],
    importPathFields: ["argument"],
    callTargetField: "function",
  },

  java: {
    extensions: [".java"],
    functionNodes: [],
    methodNodes: ["method_declaration", "constructor_declaration"],
    classNodes: ["class_declaration", "interface_declaration", "enum_declaration", "annotation_type_declaration"],
    importNodes: ["import_declaration"],
    callNodes: ["method_invocation"],
    nameStrategy: [{ field: "name" }],
    importPathFields: [],
    callTargetField: "name",
  },

  c: {
    extensions: [".c", ".h"],
    functionNodes: ["function_definition"],
    methodNodes: [],
    classNodes: ["struct_specifier", "enum_specifier", "union_specifier"],
    importNodes: ["preproc_include"],
    callNodes: ["call_expression"],
    nameStrategy: [{ declarator: true }],
    importPathFields: ["path"],
    callTargetField: "function",
  },

  cpp: {
    extensions: [".cpp", ".cc", ".cxx", ".hpp", ".hxx"],
    functionNodes: ["function_definition"],
    methodNodes: ["function_definition"],      // same node inside class body
    classNodes: ["class_specifier", "struct_specifier", "enum_specifier"],
    importNodes: ["preproc_include"],
    callNodes: ["call_expression"],
    nameStrategy: [{ declarator: true }],
    importPathFields: ["path"],
    callTargetField: "function",
  },

  ruby: {
    extensions: [".rb"],
    functionNodes: ["method", "singleton_method"],
    methodNodes: ["method", "singleton_method"],
    classNodes: ["class", "module"],
    importNodes: ["call"],                     // require / require_relative are calls
    callNodes: ["call"],
    nameStrategy: [{ field: "name" }, { type: "identifier" }],
    importPathFields: [],
    callTargetField: "method",
  },

  kotlin: {
    extensions: [".kt", ".kts"],
    functionNodes: ["function_declaration"],
    methodNodes: ["function_declaration"],
    classNodes: ["class_declaration", "object_declaration", "interface_declaration"],
    importNodes: ["import_header"],
    callNodes: ["call_expression"],
    nameStrategy: [{ field: "simple_identifier" }, { field: "name" }, { type: "simple_identifier" }],
    importPathFields: ["identifier"],
    callTargetField: "callsuffix",
  },

  swift: {
    extensions: [".swift"],
    functionNodes: ["function_declaration"],
    methodNodes: ["function_declaration"],
    classNodes: ["class_declaration", "struct_declaration", "enum_declaration", "protocol_declaration"],
    importNodes: ["import_declaration"],
    callNodes: ["call_expression"],
    nameStrategy: [{ field: "name" }],
    importPathFields: ["path"],
    callTargetField: "function",
  },

  lua: {
    extensions: [".lua"],
    functionNodes: ["function_declaration", "local_function"],
    methodNodes: ["function_declaration"],
    classNodes: [],
    importNodes: ["function_call"],            // require("module")
    callNodes: ["function_call"],
    nameStrategy: [{ field: "name" }, { type: "identifier" }],
    importPathFields: [],
    callTargetField: "name",
  },

  scala: {
    extensions: [".scala", ".sc"],
    functionNodes: ["function_definition"],
    methodNodes: ["function_definition"],
    classNodes: ["class_definition", "object_definition", "trait_definition"],
    importNodes: ["import_declaration"],
    callNodes: ["call_expression"],
    nameStrategy: [{ field: "name" }, { type: "identifier" }],
    importPathFields: [],
    callTargetField: "function",
  },

  php: {
    extensions: [".php"],
    functionNodes: ["function_definition"],
    methodNodes: ["method_declaration"],
    classNodes: ["class_declaration", "interface_declaration", "trait_declaration"],
    importNodes: ["namespace_use_declaration"],
    callNodes: ["function_call_expression", "method_call_expression"],
    nameStrategy: [{ field: "name" }, { type: "name" }],
    importPathFields: [],
    callTargetField: "function",
  },

  csharp: {
    extensions: [".cs"],
    functionNodes: [],
    methodNodes: ["method_declaration", "constructor_declaration"],
    classNodes: ["class_declaration", "interface_declaration", "struct_declaration", "enum_declaration"],
    importNodes: ["using_directive"],
    callNodes: ["invocation_expression"],
    nameStrategy: [{ field: "name" }, { type: "identifier" }],
    importPathFields: [],
    callTargetField: "function",
  },
}

/** Map file extension → language key */
export function extensionToLanguage(ext: string): string | null {
  for (const [lang, cfg] of Object.entries(LANGUAGE_CONFIGS)) {
    if (cfg.extensions.includes(ext)) return lang
  }
  return null
}

/** All supported extensions from LANGUAGE_CONFIGS */
export function allGenericExtensions(): string[] {
  return Object.values(LANGUAGE_CONFIGS).flatMap(c => c.extensions)
}
