// Shared browser/server allowlist. Every accepted tag is rebuilt; attributes are never copied.
export const escapeHtml = s => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const tags = new Set(['strong','b','em','i','u','s','br','span','a','code','mark','sub','sup']);
const entities = s => escapeHtml(s).replace(/&amp;((?:amp|lt|gt|quot|apos|nbsp|#\d{1,7}|#x[0-9a-f]{1,6});)/gi,'&$1');
export function richHtml(value) {
  if (typeof value !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw Error('Geçersiz metin.');
  if (!/<\/?[a-z]/i.test(value)) return escapeHtml(value);
  let html = '', cursor = 0; const stack = [];
  for (const m of value.matchAll(/<[^>]*>/g)) {
    if (value.slice(cursor,m.index).includes('<')) throw Error('HTML sözdizimi geçersiz.');
    html += entities(value.slice(cursor,m.index)); cursor = m.index+m[0].length;
    const tag = m[0].match(/^<(\/)?([a-z]+)((?:\s+[a-z-]+\s*=\s*(?:"[^"<>]*"|'[^'<>]*'))*\s*)(\/?)>$/i);
    if (!tag || !tags.has(tag[2].toLowerCase())) throw Error('HTML: yalnızca güvenli metin biçimleri ve bağlantılar desteklenir.');
    const name = tag[2].toLowerCase();
    if (tag[1]) { if (tag[3].trim() || tag[4] || stack.pop() !== name) throw Error('HTML etiketlerini sıralı kapatın.'); html += `</${name}>`; continue; }
    let attributes = ''; const seen = new Set();
    for (const a of tag[3].matchAll(/([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      const key = a[1].toLowerCase(), val = a[2] ?? a[3];
      if (seen.has(key)) throw Error('Tekrarlanan HTML niteliği.'); seen.add(key);
      if (name === 'a' && key === 'href' && /^(https:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d\s()-]+|\/(?!\/)[^\s]*|#[\w-]+)$/.test(val) && !/[&\\\u0000-\u001f]/.test(val)) attributes += ` href="${escapeHtml(val)}" rel="noopener noreferrer"`;
      else if (name === 'span' && key === 'class' && /^rt-align-(left|center|right|justify)$/.test(val)) attributes += ` class="${val}"`;
      else if (name === 'span' && key === 'style' && /^text-align:\s*(left|center|right|justify);?$/.test(val)) attributes += ` class="rt-align-${val.match(/(left|center|right|justify)/)[1]}"`;
      else throw Error('Bu HTML niteliği veya bağlantı adresi desteklenmiyor.');
    }
    html += `<${name}${attributes}>`; if (name !== 'br') stack.push(name);
    if (stack.length > 20) throw Error('HTML çok derin.');
  }
  if (stack.length || value.slice(cursor).includes('<')) throw Error('HTML etiketlerini kapatın.');
  return html + entities(value.slice(cursor));
}
export function plainText(value) { return String(value).replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[x])); }
export function validRich(value, max=12000, required=false) { try { return typeof value==='string' && value.length<=max && (!required||plainText(value).trim().length>0) && !!(richHtml(value)||!required); } catch { return false; } }
