import { Post } from "../types/post";
import { expandSearchQuery, checkPostMatchWithSynonyms } from "./searchSynonyms";

export type TokenType =
  | "AND"
  | "OR"
  | "NOT"
  | "LPAREN"
  | "RPAREN"
  | "TERM";

export interface Token {
  type: TokenType;
  value: string;
}

export type ASTNode =
  | { type: "AND"; left: ASTNode; right: ASTNode }
  | { type: "OR"; left: ASTNode; right: ASTNode }
  | { type: "NOT"; child: ASTNode }
  | { type: "TERM"; raw: string; prefix?: string; value: string };

/**
 * Checks if a search query string contains boolean operators or syntax.
 */
export function hasBooleanOperators(query: string): boolean {
  if (!query) return false;
  // Look for uppercase AND, OR, NOT, or explicit operators &&, ||, !, parentheses
  const booleanRegex = /\b(AND|OR|NOT)\b|&&|\|\||!|\(|\)/;
  return booleanRegex.test(query);
}

/**
 * Tokenizes a search query string into boolean search tokens.
 */
export function tokenizeBooleanQuery(query: string): Token[] {
  const tokens: Token[] = [];
  const regex =
    /\(|\)|\bAND\b|\bOR\b|\bNOT\b|&&|\|\||!|"[^"]+"|[^\s()]+/gi;

  let match;
  while ((match = regex.exec(query)) !== null) {
    const raw = match[0];
    const upper = raw.toUpperCase();

    if (raw === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
    } else if (raw === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
    } else if (upper === "AND" || raw === "&&") {
      tokens.push({ type: "AND", value: "AND" });
    } else if (upper === "OR" || raw === "||") {
      tokens.push({ type: "OR", value: "OR" });
    } else if (upper === "NOT" || raw === "!") {
      tokens.push({ type: "NOT", value: "NOT" });
    } else {
      // Remove surrounding quotes if any
      const cleanVal = raw.startsWith('"') && raw.endsWith('"')
        ? raw.slice(1, -1)
        : raw;
      if (cleanVal.trim()) {
        tokens.push({ type: "TERM", value: cleanVal });
      }
    }
  }

  return tokens;
}

/**
 * Parses token stream into an Abstract Syntax Tree (AST).
 * Grammar:
 *   Expr   -> OrExpr
 *   OrExpr -> AndExpr ( "OR" AndExpr )*
 *   AndExpr -> NotExpr ( ( "AND" )? NotExpr )*
 *   NotExpr -> "NOT" NotExpr | Primary
 *   Primary -> "(" Expr ")" | TERM
 */
export function parseBooleanTokens(tokens: Token[]): ASTNode | null {
  if (!tokens || tokens.length === 0) return null;

  let index = 0;

  function peek(): Token | undefined {
    return tokens[index];
  }

  function consume(): Token | undefined {
    return tokens[index++];
  }

  function parsePrimary(): ASTNode | null {
    const token = peek();
    if (!token) return null;

    if (token.type === "LPAREN") {
      consume(); // consume '('
      const expr = parseOrExpr();
      if (peek()?.type === "RPAREN") {
        consume(); // consume ')'
      }
      return expr;
    }

    if (token.type === "TERM") {
      const termToken = consume()!;
      let prefix: string | undefined;
      let val = termToken.value;

      // Check prefix:value format e.g. tag:food or is:favorite or @creator or #tag
      if (val.includes(":") && !val.startsWith("http")) {
        const parts = val.split(":");
        prefix = parts[0].toLowerCase();
        val = parts.slice(1).join(":");
      } else if (val.startsWith("#")) {
        prefix = "hashtag";
        val = val.substring(1);
      } else if (val.startsWith("@")) {
        prefix = "creator";
        val = val.substring(1);
      }

      return {
        type: "TERM",
        raw: termToken.value,
        prefix,
        value: val,
      };
    }

    // Skip stray operators if encountered out of order
    consume();
    return null;
  }

  function parseNotExpr(): ASTNode | null {
    const token = peek();
    if (token?.type === "NOT") {
      consume();
      const child = parseNotExpr();
      return child ? { type: "NOT", child } : null;
    }
    return parsePrimary();
  }

  function parseAndExpr(): ASTNode | null {
    let left = parseNotExpr();
    if (!left) return null;

    while (index < tokens.length) {
      const token = peek();
      if (!token || token.type === "RPAREN" || token.type === "OR") {
        break;
      }

      if (token.type === "AND") {
        consume(); // consume AND
        const right = parseNotExpr();
        if (right) {
          left = { type: "AND", left, right };
        }
      } else if (
        token.type === "TERM" ||
        token.type === "NOT" ||
        token.type === "LPAREN"
      ) {
        // Implied AND when two terms are specified side-by-side without operator
        const right = parseNotExpr();
        if (right) {
          left = { type: "AND", left, right };
        }
      } else {
        break;
      }
    }

    return left;
  }

  function parseOrExpr(): ASTNode | null {
    let left = parseAndExpr();
    if (!left) return null;

    while (index < tokens.length) {
      const token = peek();
      if (token?.type === "OR") {
        consume(); // consume OR
        const right = parseAndExpr();
        if (right) {
          left = { type: "OR", left, right };
        }
      } else {
        break;
      }
    }

    return left;
  }

  try {
    return parseOrExpr();
  } catch (err) {
    console.warn("Boolean parse error:", err);
    return null;
  }
}

/**
 * Evaluates a single post against a boolean AST node.
 */
export function evaluateAST(post: Post, node: ASTNode | null): boolean {
  if (!node) return true;

  switch (node.type) {
    case "AND":
      return evaluateAST(post, node.left) && evaluateAST(post, node.right);

    case "OR":
      return evaluateAST(post, node.left) || evaluateAST(post, node.right);

    case "NOT":
      return !evaluateAST(post, node.child);

    case "TERM": {
      const valLower = node.value.toLowerCase();

      if (node.prefix) {
        const prefix = node.prefix;
        if (
          prefix === "creator" ||
          prefix === "user" ||
          prefix === "author" ||
          prefix === "from"
        ) {
          return (
            (post.creatorUsername || "").toLowerCase().includes(valLower) ||
            (post.creatorName || "").toLowerCase().includes(valLower)
          );
        } else if (prefix === "post" || prefix === "caption") {
          return (post.caption || "").toLowerCase().includes(valLower);
        } else if (prefix === "tag" || prefix === "hashtag") {
          const tagExpanded = expandSearchQuery(node.value);
          const pTags = [
            ...(post.tags || []),
            ...(post.hashtags || []),
          ].map((t) => t.toLowerCase());

          return tagExpanded.expandedTerms.some((term) =>
            pTags.some((pt) => pt.includes(term)),
          );
        } else if (prefix === "collection" || prefix === "folder") {
          return (post.collections || []).some((c) =>
            c.toLowerCase().includes(valLower),
          );
        } else if (prefix === "notes") {
          return (post.notes || "").toLowerCase().includes(valLower);
        } else if (prefix === "is") {
          if (valLower === "favorite" || valLower === "starred") return post.isFavorite;
          if (valLower === "archived") return post.isArchived;
          if (valLower === "active" || valLower === "unarchived") return !post.isArchived;
          if (valLower === "reel") return post.isReel;
          if (valLower === "video") return post.mediaType === "video";
          if (valLower === "image") return post.mediaType === "image";
          if (valLower === "carousel") return post.mediaType === "carousel";
          if (valLower === "read-later" || valLower === "readlater") return post.readLater;
          if (valLower === "notes" || valLower === "has-notes") return !!(post.notes && post.notes.trim());
          if (valLower === "location" || valLower === "has-location") return !!(post.location && post.location.trim());
        }
      }

      // General term search with synonym expansion
      const expanded = expandSearchQuery(node.value);
      return checkPostMatchWithSynonyms(post, expanded).matches;
    }

    default:
      return true;
  }
}

/**
 * Convenience method to parse and evaluate a boolean search query string against a list of posts.
 */
export function filterPostsWithBooleanQuery(
  posts: Post[],
  query: string,
): { filteredPosts: Post[]; ast: ASTNode | null; tokens: Token[] } {
  const tokens = tokenizeBooleanQuery(query);
  const ast = parseBooleanTokens(tokens);

  if (!ast) {
    return { filteredPosts: posts, ast: null, tokens: [] };
  }

  const filteredPosts = posts.filter((post) => evaluateAST(post, ast));
  return { filteredPosts, ast, tokens };
}

/**
 * Formats an ASTNode back into a readable boolean string representation.
 */
export function formatASTToString(node: ASTNode | null): string {
  if (!node) return "";
  switch (node.type) {
    case "AND":
      return `(${formatASTToString(node.left)} AND ${formatASTToString(node.right)})`;
    case "OR":
      return `(${formatASTToString(node.left)} OR ${formatASTToString(node.right)})`;
    case "NOT":
      return `NOT (${formatASTToString(node.child)})`;
    case "TERM":
      return node.raw;
  }
}
