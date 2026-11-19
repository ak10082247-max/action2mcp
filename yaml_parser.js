/**
 * Zero-dependency JSON + YAML OpenAPI parser for Cloudflare Workers.
 * Handles real-world OpenAPI 3.0/3.1 JSON and YAML Custom GPT Action specs
 * (nested mappings, block/inline sequences, quoted/multiline scalars, booleans, numbers).
 */

function stripYamlComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle && line[i - 1] !== "\\") {
      inDouble = !inDouble;
    } else if (ch === "#" && !inSingle && !inDouble && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquoteScalar(raw) {
  const s = raw.trim();
  if (!s) return "";
  if (s === "true" || s === "True" || s === "TRUE") return true;
  if (s === "false" || s === "False" || s === "FALSE") return false;
  if (s === "null" || s === "Null" || s === "NULL" || s === "~") return null;
  if (/^-?\d+$/.test(s) && s.length <= 15) return Number(s);
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    if (s.startsWith('"')) {
      try {
        return JSON.parse(s);
      } catch {
        return s.slice(1, -1);
      }
    }
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    const parsedFlow = parseFlowCollection(s);
    if (parsedFlow !== undefined) return parsedFlow;
  }
  return s;
}

function splitTopLevelCommas(inner) {
  const parts = [];
  let cur = "";
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && inner[i - 1] !== "\\") inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === "[" || ch === "{") depth += 1;
      else if (ch === "]" || ch === "}") depth -= 1;
      else if (ch === "," && depth === 0) {
        parts.push(cur.trim());
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function parseFlowCollection(text) {
  const s = text.trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevelCommas(inner).map((item) => unquoteScalar(item));
  }
  if (s.startsWith("{") && s.endsWith("}")) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return {};
    const obj = {};
    for (const entry of splitTopLevelCommas(inner)) {
      const idx = findKeyColon(entry);
      if (idx === -1) return undefined;
      const k = String(unquoteScalar(entry.slice(0, idx)));
      const v = unquoteScalar(entry.slice(idx + 1));
      obj[k] = v;
    }
    return obj;
  }
  return undefined;
}

function findKeyColon(text) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && text[i - 1] !== "\\") inDouble = !inDouble;
    else if (ch === ":" && !inSingle && !inDouble) {
      if (i + 1 === text.length || /\s/.test(text[i + 1])) return i;
    }
  }
  return -1;
}

function tokenizeYamlLines(rawText) {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (let idx = 0; idx < lines.length; idx += 1) {
    const cleaned = stripYamlComment(lines[idx]).replace(/\s+$/, "");
    if (!cleaned.trim() || cleaned.trim() === "---" || cleaned.trim() === "...") continue;
    const indent = cleaned.length - cleaned.trimStart().length;
    out.push({ indent, trimmed: cleaned.trim(), raw: cleaned, lineNo: idx + 1 });
  }
  return out;
}

function parseBlockScalar(tokens, startIdx, baseIndent, style) {
  const lines = [];
  let minContentIndent = null;
  let i = startIdx;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.indent <= baseIndent) break;
    if (minContentIndent === null) minContentIndent = t.indent;
    lines.push(t.raw.slice(minContentIndent));
    i += 1;
  }
  const text = style.startsWith(">") ? lines.join(" ").trim() : lines.join("\n").trim();
  return { value: text, nextIdx: i };
}

function parseYamlNode(tokens, startIdx, minIndent) {
  if (startIdx >= tokens.length) return { value: null, nextIdx: startIdx };
  const first = tokens[startIdx];
  if (first.indent < minIndent) return { value: null, nextIdx: startIdx };

  if (first.trimmed.startsWith("- ") || first.trimmed === "-") {
    const arr = [];
    const seqIndent = first.indent;
    let i = startIdx;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.indent < seqIndent) break;
      if (t.indent > seqIndent) break;
      if (!(t.trimmed.startsWith("- ") || t.trimmed === "-")) break;

      const rest = t.trimmed === "-" ? "" : t.trimmed.slice(2).trim();
      if (!rest) {
        if (i + 1 < tokens.length && tokens[i + 1].indent > seqIndent) {
          const child = parseYamlNode(tokens, i + 1, tokens[i + 1].indent);
          arr.push(child.value);
          i = child.nextIdx;
        } else {
          arr.push(null);
          i += 1;
        }
        continue;
      }

      const colonIdx = findKeyColon(rest);
      if (colonIdx !== -1 && !rest.startsWith("[") && !rest.startsWith("{")) {
        // Inline mapping starting inside sequence item `- key: value`
        const itemIndent = seqIndent + 2;
        const synthetic = [{ indent: itemIndent, trimmed: rest, raw: " ".repeat(itemIndent) + rest, lineNo: t.lineNo }];
        let j = i + 1;
        while (j < tokens.length && tokens[j].indent >= itemIndent) {
          synthetic.push(tokens[j]);
          j += 1;
        }
        const objNode = parseYamlNode(synthetic, 0, itemIndent);
        arr.push(objNode.value);
        i = j;
      } else if (rest === "|" || rest === "|-" || rest === ">" || rest === ">-") {
        const blk = parseBlockScalar(tokens, i + 1, seqIndent, rest);
        arr.push(blk.value);
        i = blk.nextIdx;
      } else {
        arr.push(unquoteScalar(rest));
        i += 1;
      }
    }
    return { value: arr, nextIdx: i };
  }

  const colon0 = findKeyColon(first.trimmed);
  if (colon0 === -1) {
    return { value: unquoteScalar(first.trimmed), nextIdx: startIdx + 1 };
  }

  const obj = {};
  const mapIndent = first.indent;
  let i = startIdx;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.indent < mapIndent || t.indent > mapIndent) break;
    if (t.trimmed.startsWith("- ") || t.trimmed === "-") break;
    const colonIdx = findKeyColon(t.trimmed);
    if (colonIdx === -1) break;

    const key = String(unquoteScalar(t.trimmed.slice(0, colonIdx)));
    const valPart = t.trimmed.slice(colonIdx + 1).trim();

    if (!valPart) {
      if (i + 1 < tokens.length && (tokens[i + 1].indent > mapIndent || (tokens[i + 1].indent === mapIndent && (tokens[i + 1].trimmed.startsWith("- ") || tokens[i + 1].trimmed === "-")))) {
        const child = parseYamlNode(tokens, i + 1, tokens[i + 1].indent);
        obj[key] = child.value;
        i = child.nextIdx;
      } else {
        obj[key] = null;
        i += 1;
      }
    } else if (valPart === "|" || valPart === "|-" || valPart === ">" || valPart === ">-") {
      const blk = parseBlockScalar(tokens, i + 1, mapIndent, valPart);
      obj[key] = blk.value;
      i = blk.nextIdx;
    } else {
      obj[key] = unquoteScalar(valPart);
      i += 1;
    }
  }
  return { value: obj, nextIdx: i };
}

/**
 * Parse OpenAPI JSON or YAML text into a plain JS object.
 */
export function parseJsonOrYaml(rawText) {
  const src = String(rawText || "").trim();
  if (!src) throw new Error("Empty OpenAPI schema input.");
  if (src.startsWith("{")) {
    return JSON.parse(src);
  }
  const tokens = tokenizeYamlLines(src);
  if (tokens.length === 0) throw new Error("YAML input contains no data.");
  const root = parseYamlNode(tokens, 0, tokens[0].indent);
  if (!root || typeof root.value !== "object" || Array.isArray(root.value) || root.value === null) {
    throw new Error("Parsed OpenAPI document must be a JSON or YAML object.");
  }
  return root.value;
}
