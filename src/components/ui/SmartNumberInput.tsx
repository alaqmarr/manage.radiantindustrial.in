"use client"

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { Calculator } from "lucide-react"

/**
 * Safe recursive-descent mathematical expression evaluator.
 * Supports:
 * - Addition (+), Subtraction (-), Multiplication (*, ×, x), Division (/, ÷)
 * - Parentheses: ( ... )
 * - Percentages:
 *   - Additive/Subtractive: `1000 + 18%` -> 1180, `1000 - 10%` -> 900
 *   - Multiplicative: `1000 * 18%` -> 180
 */
export function evaluateMathExpression(expr: string, maxDecimals = 2): number | null {
  if (!expr || typeof expr !== "string") return null

  // Clean up whitespace, currency symbols, commas, trailing '='
  const cleaned = expr
    .replace(/[,₹$\s]/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/=+$/, "")
    .trim()

  if (!cleaned) return null

  // Allow only digits, decimal point, operators, parentheses, and %
  if (!/^[0-9.+\-*/()%]+$/.test(cleaned)) {
    return null
  }

  // Tokenize into numbers, operators, parens, and %
  const tokens: string[] = []
  let i = 0
  while (i < cleaned.length) {
    const ch = cleaned[i]
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let numStr = ""
      let dotCount = 0
      while (i < cleaned.length && ((cleaned[i] >= "0" && cleaned[i] <= "9") || cleaned[i] === ".")) {
        if (cleaned[i] === ".") dotCount++
        if (dotCount > 1) return null
        numStr += cleaned[i]
        i++
      }
      if (numStr === ".") return null
      tokens.push(numStr)
    } else if ("+-*/()%".includes(ch)) {
      tokens.push(ch)
      i++
    } else {
      return null
    }
  }

  if (tokens.length === 0) return null

  let pos = 0

  function peek(): string | undefined {
    return tokens[pos]
  }

  function consume(): string | undefined {
    return tokens[pos++]
  }

  // Grammar:
  // Expression -> Term ( ('+' | '-') Term )*
  //   Special rule: if Term is a single Factor followed by '%' in an additive context,
  //   e.g. `Left + Right%`, evaluate as `Left + (Left * Right / 100)`
  // Term -> Factor ( ('*' | '/') Factor )*
  // Factor -> ('+' | '-') Factor | Primary ('%')?
  // Primary -> NUMBER | '(' Expression ')'

  function parseExpression(): number {
    let left = parseTermWithPercentFlag().value

    while (peek() === "+" || peek() === "-") {
      const op = consume()!
      const rightObj = parseTermWithPercentFlag()
      const rightVal = rightObj.isStandalonePercent
        ? left * (rightObj.rawBeforePercent / 100)
        : rightObj.value

      if (op === "+") {
        left = left + rightVal
      } else {
        left = left - rightVal
      }
    }
    return left
  }

  function parseTermWithPercentFlag(): {
    value: number
    isStandalonePercent: boolean
    rawBeforePercent: number
  } {
    const first = parseFactor()
    let left = first.value
    let hadMultDiv = false

    while (peek() === "*" || peek() === "/") {
      hadMultDiv = true
      const op = consume()!
      const right = parseFactor().value
      if (op === "*") {
        left = left * right
      } else {
        if (right === 0) return { value: NaN, isStandalonePercent: false, rawBeforePercent: NaN }
        left = left / right
      }
    }

    return {
      value: left,
      isStandalonePercent: !hadMultDiv && first.hasPercent,
      rawBeforePercent: first.rawBeforePercent,
    }
  }

  function parseFactor(): {
    value: number
    hasPercent: boolean
    rawBeforePercent: number
  } {
    if (peek() === "+") {
      consume()
      const f = parseFactor()
      return f
    }
    if (peek() === "-") {
      consume()
      const f = parseFactor()
      return {
        value: -f.value,
        hasPercent: f.hasPercent,
        rawBeforePercent: -f.rawBeforePercent,
      }
    }

    const base = parsePrimary()
    if (peek() === "%") {
      consume()
      return {
        value: base / 100,
        hasPercent: true,
        rawBeforePercent: base,
      }
    }

    return {
      value: base,
      hasPercent: false,
      rawBeforePercent: base,
    }
  }

  function parsePrimary(): number {
    const tok = peek()
    if (!tok) return NaN

    if (tok === "(") {
      consume() // '('
      const val = parseExpression()
      if (peek() !== ")") return NaN
      consume() // ')'
      return val
    }

    if (/^[0-9.]+$/.test(tok)) {
      consume()
      return parseFloat(tok)
    }

    return NaN
  }

  const result = parseExpression()
  if (pos !== tokens.length || !Number.isFinite(result)) {
    return null
  }

  const factor = Math.pow(10, maxDecimals)
  return Math.round((result + Number.EPSILON) * factor) / factor
}

/**
 * Checks whether the string contains a math operator (beyond a simple leading sign or plain number)
 */
export function hasMathOperator(str: string): boolean {
  const trimmed = str.trim()
  if (!trimmed) return false
  // Check for +, *, /, (, ), %, or a '-' not at index 0
  return /[+*/()%×÷]/.test(trimmed) || trimmed.slice(1).includes("-")
}

export interface SmartNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | string
  onValueChange: (numericValue: number, stringValue: string) => void
  /** Max decimal places when evaluating an expression (default 2) */
  maxDecimals?: number
  /** Allow negative results (default false) */
  allowNegative?: boolean
  /** Optional callback when Enter is pressed after calculation */
  onEnterAfterCalc?: () => void
  /** Hide the subtle = preview badge when typing an expression */
  hidePreviewBadge?: boolean
}

export const SmartNumberInput = forwardRef<HTMLInputElement, SmartNumberInputProps>(
  (
    {
      value,
      onValueChange,
      maxDecimals = 2,
      allowNegative = false,
      onEnterAfterCalc,
      hidePreviewBadge = false,
      className = "",
      placeholder = "0 (or e.g. 10+10)",
      onBlur,
      onFocus,
      onKeyDown,
      ...rest
    },
    ref
  ) => {
    const innerRef = useRef<HTMLInputElement>(null)
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement)

    const formatIncoming = (v: number | string): string => {
      if (v === "" || v === null || v === undefined) return ""
      if (typeof v === "number") {
        if (v === 0 && placeholder !== "0") return ""
        return String(v)
      }
      return v
    }

    const [text, setText] = useState<string>(() => formatIncoming(value))
    const [isFocused, setIsFocused] = useState(false)
    const [justCalculated, setJustCalculated] = useState(false)

    // Sync external value changes when the input is not actively mid-expression
    useEffect(() => {
      if (!isFocused) {
        setText(formatIncoming(value))
      } else {
        // Even if focused, if external code reset or changed the value (e.g. clicking a +15% markup preset chip)
        // and the user isn't currently typing an unfinished operator, sync it
        const currentEval = evaluateMathExpression(text, maxDecimals)
        const incomingNum = typeof value === "number" ? value : parseFloat(String(value)) || 0
        if (!hasMathOperator(text) && currentEval !== incomingNum) {
          setText(formatIncoming(value))
        } else if (hasMathOperator(text) && currentEval !== null && currentEval !== incomingNum && incomingNum > 0) {
          // External preset button clicked while focused
          setText(formatIncoming(value))
        }
      }
    }, [value])

    const isExpression = hasMathOperator(text)
    const evaluatedPreview = isExpression ? evaluateMathExpression(text, maxDecimals) : null

    const commitCalculation = (raw: string): number | null => {
      const evaluated = evaluateMathExpression(raw, maxDecimals)
      if (evaluated !== null) {
        const finalVal = allowNegative ? evaluated : Math.max(0, evaluated)
        const finalStr = String(finalVal)
        setText(finalStr)
        onValueChange(finalVal, finalStr)
        if (hasMathOperator(raw)) {
          setJustCalculated(true)
          setTimeout(() => setJustCalculated(false), 900)
        }
        return finalVal
      }
      return null
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value

      // If the user typed '=' at the end of an expression (e.g. "10+10="), immediately calculate!
      if (raw.endsWith("=") && raw.length > 1) {
        const withoutEq = raw.slice(0, -1)
        const committed = commitCalculation(withoutEq)
        if (committed !== null) return
      }

      // Filter out invalid characters (keep digits, ., +, -, *, /, (, ), %, space)
      if (raw !== "" && !/^[0-9.+\-*/()%×÷\s,]*$/.test(raw)) {
        return
      }

      setText(raw)

      if (raw.trim() === "") {
        onValueChange(0, "")
        return
      }

      // Evaluate live so totals/margins update in real time even before pressing Enter
      const evaluated = evaluateMathExpression(raw, maxDecimals)
      if (evaluated !== null) {
        const finalVal = allowNegative ? evaluated : Math.max(0, evaluated)
        onValueChange(finalVal, hasMathOperator(raw) ? raw : String(finalVal))
      }
    }

    const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "=" || e.key === "Enter") {
        if (hasMathOperator(text)) {
          e.preventDefault()
          e.stopPropagation()
          commitCalculation(text)
          if (e.key === "Enter" && onEnterAfterCalc) {
            onEnterAfterCalc()
          }
          return
        } else if (e.key === "=") {
          // Prevent literal '=' when no expression
          e.preventDefault()
          return
        }
      }
      if (onKeyDown) {
        onKeyDown(e)
      }
    }

    const handleBlurInternal = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      if (text.trim() === "") {
        setText("")
        onValueChange(0, "")
      } else {
        const committed = commitCalculation(text)
        if (committed === null) {
          // Fallback to parsing leading number if expression was incomplete (e.g. "10+")
          const fallback = parseFloat(text) || 0
          const finalVal = allowNegative ? fallback : Math.max(0, fallback)
          setText(finalVal === 0 && placeholder !== "0" ? "" : String(finalVal))
          onValueChange(finalVal, String(finalVal))
        }
      }
      if (onBlur) onBlur(e)
    }

    const handleFocusInternal = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      if (onFocus) onFocus(e)
    }

    return (
      <div className="relative w-full">
        <input
          {...rest}
          ref={innerRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={handleKeyDownInternal}
          onBlur={handleBlurInternal}
          onFocus={handleFocusInternal}
          title="Smart Calculator Input: Type numbers or math like 10+10, 250*1.18, 500+15% and press Enter or ="
          className={`${className} ${
            justCalculated ? "ring-2 ring-emerald-500/40 border-emerald-500 transition-all" : ""
          }`}
        />

        {/* Live Calculation Preview Badge when typing a math expression */}
        {!hidePreviewBadge && isFocused && isExpression && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault()
              commitCalculation(text)
            }}
            className={`absolute -top-6 right-0 z-30 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shadow-sm border transition-all cursor-pointer ${
              evaluatedPreview !== null
                ? "bg-slate-900 text-white border-slate-800 hover:bg-orange-600"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
            title="Click or press Enter / = to apply calculation"
          >
            <Calculator className="w-2.5 h-2.5 text-orange-400" />
            {evaluatedPreview !== null ? (
              <span className="text-white">= {evaluatedPreview} ↵</span>
            ) : (
              <span>typing math...</span>
            )}
          </button>
        )}
      </div>
    )
  }
)

SmartNumberInput.displayName = "SmartNumberInput"
