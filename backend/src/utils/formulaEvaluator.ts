/**
 * Safe Mathematical & Salary Head Formula Evaluator
 * Evaluates expressions like "BASIC * 0.40" or "(BASIC + HRA) * 0.12"
 * Uses recursive descent token parsing WITHOUT eval() or new Function().
 */

type TokenType = 'NUMBER' | 'IDENTIFIER' | 'PLUS' | 'MINUS' | 'MULTIPLY' | 'DIVIDE' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
  type: TokenType;
  value?: string | number;
}

export function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const clean = expr.trim();

  while (i < clean.length) {
    const ch = clean[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '+') {
      tokens.push({ type: 'PLUS' });
      i++;
    } else if (ch === '-') {
      tokens.push({ type: 'MINUS' });
      i++;
    } else if (ch === '*') {
      tokens.push({ type: 'MULTIPLY' });
      i++;
    } else if (ch === '/') {
      tokens.push({ type: 'DIVIDE' });
      i++;
    } else if (ch === '(') {
      tokens.push({ type: 'LPAREN' });
      i++;
    } else if (ch === ')') {
      tokens.push({ type: 'RPAREN' });
      i++;
    } else if (/\d/.test(ch) || ch === '.') {
      let numStr = '';
      while (i < clean.length && (/[\d.]/.test(clean[i]))) {
        numStr += clean[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
    } else if (/[a-zA-Z_]/.test(ch)) {
      let idStr = '';
      while (i < clean.length && (/[a-zA-Z0-9_]/.test(clean[i]))) {
        idStr += clean[i];
        i++;
      }
      tokens.push({ type: 'IDENTIFIER', value: idStr.toUpperCase() });
    } else {
      throw new Error(`Invalid character in formula: "${ch}"`);
    }
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private current = 0;
  private context: Record<string, number>;

  constructor(tokens: Token[], context: Record<string, number>) {
    this.tokens = tokens;
    this.context = context;
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF' };
  }

  private consume(type: TokenType): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      throw new Error(`Expected token ${type}, but got ${tok.type}`);
    }
    this.current++;
    return tok;
  }

  public parse(): number {
    const res = this.expr();
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected token at end of formula: ${this.peek().type}`);
    }
    return res;
  }

  // expr = term (( '+' | '-' ) term)*
  private expr(): number {
    let result = this.term();

    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.peek().type;
      this.current++;
      const nextTerm = this.term();
      if (op === 'PLUS') {
        result += nextTerm;
      } else {
        result -= nextTerm;
      }
    }

    return result;
  }

  // term = factor (( '*' | '/' ) factor)*
  private term(): number {
    let result = this.factor();

    while (this.peek().type === 'MULTIPLY' || this.peek().type === 'DIVIDE') {
      const op = this.peek().type;
      this.current++;
      const nextFactor = this.factor();
      if (op === 'MULTIPLY') {
        result *= nextFactor;
      } else {
        if (nextFactor === 0) {
          result = 0; // Guard against division by zero
        } else {
          result /= nextFactor;
        }
      }
    }

    return result;
  }

  // factor = NUMBER | IDENTIFIER | '(' expr ')' | '-' factor
  private factor(): number {
    const tok = this.peek();

    if (tok.type === 'MINUS') {
      this.current++;
      return -this.factor();
    }

    if (tok.type === 'NUMBER') {
      this.current++;
      return typeof tok.value === 'number' ? tok.value : 0;
    }

    if (tok.type === 'IDENTIFIER') {
      this.current++;
      const key = String(tok.value).toUpperCase();
      const val = this.context[key];
      return val !== undefined ? val : 0;
    }

    if (tok.type === 'LPAREN') {
      this.current++;
      const val = this.expr();
      this.consume('RPAREN');
      return val;
    }

    throw new Error(`Unexpected token in formula: ${tok.type}`);
  }
}

/**
 * Safely evaluates a formula expression against a context dictionary.
 * @param formula e.g. "BASIC * 0.40"
 * @param context e.g. { BASIC: 25000, GROSS: 50000, HRA: 12500 }
 */
export function evaluateFormula(formula: string, context: Record<string, number>): number {
  if (!formula || !formula.trim()) return 0;
  try {
    const tokens = tokenize(formula);
    const parser = new Parser(tokens, context);
    const res = parser.parse();
    return Number.isFinite(res) ? Math.round(res * 100) / 100 : 0;
  } catch (err: any) {
    console.warn(`[FormulaEvaluator] Error evaluating "${formula}":`, err.message);
    return 0;
  }
}

/**
 * Validates whether a formula expression is syntactically valid and well-formed.
 */
export function validateFormulaSyntax(formula: string): { valid: boolean; error?: string } {
  if (!formula || !formula.trim()) return { valid: true };
  try {
    const tokens = tokenize(formula);
    const dummyContext: Record<string, number> = new Proxy({}, {
      get: () => 100,
    });
    const parser = new Parser(tokens, dummyContext);
    parser.parse();
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}
