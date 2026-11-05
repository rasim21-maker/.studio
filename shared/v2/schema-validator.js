var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// <stdin>
var validate = validate10;
var stdin_default = validate10;
var schema11 = { "$id": "https://loft.studio/schemas/document/2", "type": "object", "additionalProperties": false, "required": ["schemaVersion", "name", "locale", "locales", "theme", "pages", "dictionaries"], "properties": { "schemaVersion": { "const": 2 }, "name": { "type": "string", "minLength": 1, "maxLength": 120 }, "locale": { "type": "string", "pattern": "^[a-z]{2,3}(-[A-Z]{2})?$" }, "locales": { "type": "array", "minItems": 1, "maxItems": 30, "uniqueItems": true, "items": { "type": "string", "pattern": "^[a-z]{2,3}(-[A-Z]{2})?$" } }, "theme": { "type": "object", "additionalProperties": false, "properties": { "preset": { "enum": ["original", "warm", "forest", "midnight", "ocean", "rose", "terracotta", "lavender", "mint", "editorial", "citrus", "slate"] }, "font": { "enum": ["system", "serif", "mono"] }, "radius": { "type": "integer", "minimum": 0, "maximum": 48 } }, "required": ["preset", "font", "radius"] }, "pages": { "type": "array", "minItems": 1, "maxItems": 40, "items": { "type": "object", "additionalProperties": false, "properties": { "id": { "type": "string", "pattern": "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, "name": { "type": "string", "minLength": 1, "maxLength": 120 }, "path": { "type": "string", "minLength": 1, "maxLength": 200 }, "title": { "type": "string", "minLength": 0, "maxLength": 160 }, "description": { "type": "string", "minLength": 0, "maxLength": 400 }, "layout": { "type": "object", "additionalProperties": false, "properties": { "desktop": { "type": "object", "additionalProperties": false, "properties": { "display": { "enum": ["stack", "grid", "flex"] }, "columns": { "type": "integer", "minimum": 1, "maximum": 4 }, "gap": { "type": "integer", "minimum": 0, "maximum": 160 }, "padding": { "type": "integer", "minimum": 0, "maximum": 160 }, "margin": { "type": "integer", "minimum": 0, "maximum": 160 }, "maxWidth": { "type": "integer", "minimum": 320, "maximum": 1920 }, "align": { "enum": ["left", "center", "right", "stretch"] }, "vertical": { "enum": ["start", "center", "end"] }, "textAlign": { "enum": ["left", "center", "right", "justify"] }, "autoAlign": { "type": "boolean" } }, "required": [] }, "tablet": { "type": "object", "additionalProperties": false, "properties": { "display": { "enum": ["stack", "grid", "flex"] }, "columns": { "type": "integer", "minimum": 1, "maximum": 4 }, "gap": { "type": "integer", "minimum": 0, "maximum": 160 }, "padding": { "type": "integer", "minimum": 0, "maximum": 160 }, "margin": { "type": "integer", "minimum": 0, "maximum": 160 }, "maxWidth": { "type": "integer", "minimum": 320, "maximum": 1920 }, "align": { "enum": ["left", "center", "right", "stretch"] }, "vertical": { "enum": ["start", "center", "end"] }, "textAlign": { "enum": ["left", "center", "right", "justify"] }, "autoAlign": { "type": "boolean" } }, "required": [] }, "mobile": { "type": "object", "additionalProperties": false, "properties": { "display": { "enum": ["stack", "grid", "flex"] }, "columns": { "type": "integer", "minimum": 1, "maximum": 4 }, "gap": { "type": "integer", "minimum": 0, "maximum": 160 }, "padding": { "type": "integer", "minimum": 0, "maximum": 160 }, "margin": { "type": "integer", "minimum": 0, "maximum": 160 }, "maxWidth": { "type": "integer", "minimum": 320, "maximum": 1920 }, "align": { "enum": ["left", "center", "right", "stretch"] }, "vertical": { "enum": ["start", "center", "end"] }, "textAlign": { "enum": ["left", "center", "right", "justify"] }, "autoAlign": { "type": "boolean" } }, "required": [] } }, "required": ["desktop", "tablet", "mobile"] }, "sections": { "type": "array", "maxItems": 60, "items": { "type": "object", "additionalProperties": false, "properties": { "id": { "type": "string", "pattern": "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, "name": { "type": "string", "minLength": 1, "maxLength": 150 }, "kind": { "enum": ["source", "text", "hero", "image", "cta", "booking", "gadget"] }, "enabled": { "type": "boolean" }, "fields": { "type": "array", "maxItems": 40, "items": { "type": "object", "additionalProperties": false, "properties": { "id": { "type": "string", "pattern": "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, "label": { "type": "string", "minLength": 1, "maxLength": 120 }, "type": { "enum": ["text", "rich", "url", "image", "number", "boolean", "enum"] }, "value": { "type": ["string", "number", "boolean"], "maxLength": 12e3 }, "required": { "type": "boolean" }, "min": { "type": "number" }, "max": { "type": "number" }, "maxLength": { "type": "integer", "minimum": 1, "maximum": 12e3 }, "step": { "type": "number", "exclusiveMinimum": 0 }, "dictionary": { "type": "string", "pattern": "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, "translations": { "type": "object", "maxProperties": 30, "propertyNames": { "pattern": "^[a-z]{2,3}(-[A-Z]{2})?$" }, "additionalProperties": { "type": "string", "minLength": 0, "maxLength": 12e3 } } }, "required": ["id", "label", "type", "value"] } }, "layout": { "type": "object", "additionalProperties": false, "properties": { "desktop": { "type": "object", "additionalProperties": false, "properties": { "display": { "enum": ["stack", "grid", "flex"] }, "columns": { "type": "integer", "minimum": 1, "maximum": 4 }, "gap": { "type": "integer", "minimum": 0, "maximum": 160 }, "padding": { "type": "integer", "minimum": 0, "maximum": 160 }, "margin": { "type": "integer", "minimum": 0, "maximum": 160 }, "maxWidth": { "type": "integer", "minimum": 320, "maximum": 1920 }, "align": { "enum": ["left", "center", "right", "stretch"] }, "vertical": { "enum": ["start", "center", "end"] }, "textAlign": { "enum": ["left", "center", "right", "justify"] }, "autoAlign": { "type": "boolean" } }, "required": [] }, "tablet": { "type": "object", "additionalProperties": false, "properties": { "display": { "enum": ["stack", "grid", "flex"] }, "columns": { "type": "integer", "minimum": 1, "maximum": 4 }, "gap": { "type": "integer", "minimum": 0, "maximum": 160 }, "padding": { "type": "integer", "minimum": 0, "maximum": 160 }, "margin": { "type": "integer", "minimum": 0, "maximum": 160 }, "maxWidth": { "type": "integer", "minimum": 320, "maximum": 1920 }, "align": { "enum": ["left", "center", "right", "stretch"] }, "vertical": { "enum": ["start", "center", "end"] }, "textAlign": { "enum": ["left", "center", "right", "justify"] }, "autoAlign": { "type": "boolean" } }, "required": [] }, "mobile": { "type": "object", "additionalProperties": false, "properties": { "display": { "enum": ["stack", "grid", "flex"] }, "columns": { "type": "integer", "minimum": 1, "maximum": 4 }, "gap": { "type": "integer", "minimum": 0, "maximum": 160 }, "padding": { "type": "integer", "minimum": 0, "maximum": 160 }, "margin": { "type": "integer", "minimum": 0, "maximum": 160 }, "maxWidth": { "type": "integer", "minimum": 320, "maximum": 1920 }, "align": { "enum": ["left", "center", "right", "stretch"] }, "vertical": { "enum": ["start", "center", "end"] }, "textAlign": { "enum": ["left", "center", "right", "justify"] }, "autoAlign": { "type": "boolean" } }, "required": [] } }, "required": ["desktop", "tablet", "mobile"] } }, "required": ["id", "name", "kind", "enabled", "fields", "layout"] } } }, "required": ["id", "name", "path", "title", "description", "layout", "sections"] } }, "dictionaries": { "type": "array", "maxItems": 30, "items": { "type": "object", "additionalProperties": false, "properties": { "id": { "type": "string", "pattern": "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, "version": { "type": "integer", "minimum": 1, "maximum": 2147483647 }, "mode": { "enum": ["strict", "suggest"] }, "entries": { "type": "array", "maxItems": 500, "items": { "type": "object", "additionalProperties": false, "properties": { "id": { "type": "string", "pattern": "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, "labels": { "type": "object", "maxProperties": 30, "propertyNames": { "pattern": "^[a-z]{2,3}(-[A-Z]{2})?$" }, "additionalProperties": { "type": "string", "minLength": 0, "maxLength": 12e3 } }, "active": { "type": "boolean" }, "aliases": { "type": "array", "maxItems": 30, "uniqueItems": true, "items": { "type": "string", "minLength": 1, "maxLength": 120 } } }, "required": ["id", "labels", "active", "aliases"] } } }, "required": ["id", "version", "mode", "entries"] } } } };
var func2 = require_ucs2length().default;
var func12 = Object.prototype.hasOwnProperty;
var pattern0 = new RegExp("^[a-z]{2,3}(-[A-Z]{2})?$", "u");
var pattern2 = new RegExp("^[a-zA-Z][a-zA-Z0-9_-]{0,79}$", "u");
function validate10(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "schemaVersion" }, message: "must have required property 'schemaVersion'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.name === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "name" }, message: "must have required property 'name'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.locale === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "locale" }, message: "must have required property 'locale'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.locales === void 0) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "locales" }, message: "must have required property 'locales'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.theme === void 0) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "theme" }, message: "must have required property 'theme'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.pages === void 0) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "pages" }, message: "must have required property 'pages'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.dictionaries === void 0) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "dictionaries" }, message: "must have required property 'dictionaries'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "schemaVersion" || key0 === "name" || key0 === "locale" || key0 === "locales" || key0 === "theme" || key0 === "pages" || key0 === "dictionaries")) {
        const err7 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      if (2 !== data.schemaVersion) {
        const err8 = { instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: 2 }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.name !== void 0) {
      let data1 = data.name;
      if (typeof data1 === "string") {
        if (func2(data1) > 120) {
          const err9 = { instancePath: instancePath + "/name", schemaPath: "#/properties/name/maxLength", keyword: "maxLength", params: { limit: 120 }, message: "must NOT have more than 120 characters" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err10 = { instancePath: instancePath + "/name", schemaPath: "#/properties/name/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/name", schemaPath: "#/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.locale !== void 0) {
      let data2 = data.locale;
      if (typeof data2 === "string") {
        if (!pattern0.test(data2)) {
          const err12 = { instancePath: instancePath + "/locale", schemaPath: "#/properties/locale/pattern", keyword: "pattern", params: { pattern: "^[a-z]{2,3}(-[A-Z]{2})?$" }, message: 'must match pattern "^[a-z]{2,3}(-[A-Z]{2})?$"' };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/locale", schemaPath: "#/properties/locale/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.locales !== void 0) {
      let data3 = data.locales;
      if (Array.isArray(data3)) {
        if (data3.length > 30) {
          const err14 = { instancePath: instancePath + "/locales", schemaPath: "#/properties/locales/maxItems", keyword: "maxItems", params: { limit: 30 }, message: "must NOT have more than 30 items" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data3.length < 1) {
          const err15 = { instancePath: instancePath + "/locales", schemaPath: "#/properties/locales/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        const len0 = data3.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data4 = data3[i0];
          if (typeof data4 === "string") {
            if (!pattern0.test(data4)) {
              const err16 = { instancePath: instancePath + "/locales/" + i0, schemaPath: "#/properties/locales/items/pattern", keyword: "pattern", params: { pattern: "^[a-z]{2,3}(-[A-Z]{2})?$" }, message: 'must match pattern "^[a-z]{2,3}(-[A-Z]{2})?$"' };
              if (vErrors === null) {
                vErrors = [err16];
              } else {
                vErrors.push(err16);
              }
              errors++;
            }
          } else {
            const err17 = { instancePath: instancePath + "/locales/" + i0, schemaPath: "#/properties/locales/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err17];
            } else {
              vErrors.push(err17);
            }
            errors++;
          }
        }
        let i1 = data3.length;
        let j0;
        if (i1 > 1) {
          const indices0 = {};
          for (; i1--; ) {
            let item0 = data3[i1];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0];
              const err18 = { instancePath: instancePath + "/locales", schemaPath: "#/properties/locales/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err19 = { instancePath: instancePath + "/locales", schemaPath: "#/properties/locales/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.theme !== void 0) {
      let data5 = data.theme;
      if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
        if (data5.preset === void 0) {
          const err20 = { instancePath: instancePath + "/theme", schemaPath: "#/properties/theme/required", keyword: "required", params: { missingProperty: "preset" }, message: "must have required property 'preset'" };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        if (data5.font === void 0) {
          const err21 = { instancePath: instancePath + "/theme", schemaPath: "#/properties/theme/required", keyword: "required", params: { missingProperty: "font" }, message: "must have required property 'font'" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (data5.radius === void 0) {
          const err22 = { instancePath: instancePath + "/theme", schemaPath: "#/properties/theme/required", keyword: "required", params: { missingProperty: "radius" }, message: "must have required property 'radius'" };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        for (const key1 in data5) {
          if (!(key1 === "preset" || key1 === "font" || key1 === "radius")) {
            const err23 = { instancePath: instancePath + "/theme", schemaPath: "#/properties/theme/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
        if (data5.preset !== void 0) {
          let data6 = data5.preset;
          if (!(data6 === "original" || data6 === "warm" || data6 === "forest" || data6 === "midnight" || data6 === "ocean" || data6 === "rose" || data6 === "terracotta" || data6 === "lavender" || data6 === "mint" || data6 === "editorial" || data6 === "citrus" || data6 === "slate")) {
            const err24 = { instancePath: instancePath + "/theme/preset", schemaPath: "#/properties/theme/properties/preset/enum", keyword: "enum", params: { allowedValues: schema11.properties.theme.properties.preset.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        }
        if (data5.font !== void 0) {
          let data7 = data5.font;
          if (!(data7 === "system" || data7 === "serif" || data7 === "mono")) {
            const err25 = { instancePath: instancePath + "/theme/font", schemaPath: "#/properties/theme/properties/font/enum", keyword: "enum", params: { allowedValues: schema11.properties.theme.properties.font.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
        }
        if (data5.radius !== void 0) {
          let data8 = data5.radius;
          if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
            const err26 = { instancePath: instancePath + "/theme/radius", schemaPath: "#/properties/theme/properties/radius/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
          if (typeof data8 == "number" && isFinite(data8)) {
            if (data8 > 48 || isNaN(data8)) {
              const err27 = { instancePath: instancePath + "/theme/radius", schemaPath: "#/properties/theme/properties/radius/maximum", keyword: "maximum", params: { comparison: "<=", limit: 48 }, message: "must be <= 48" };
              if (vErrors === null) {
                vErrors = [err27];
              } else {
                vErrors.push(err27);
              }
              errors++;
            }
            if (data8 < 0 || isNaN(data8)) {
              const err28 = { instancePath: instancePath + "/theme/radius", schemaPath: "#/properties/theme/properties/radius/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            }
          }
        }
      } else {
        const err29 = { instancePath: instancePath + "/theme", schemaPath: "#/properties/theme/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.pages !== void 0) {
      let data9 = data.pages;
      if (Array.isArray(data9)) {
        if (data9.length > 40) {
          const err30 = { instancePath: instancePath + "/pages", schemaPath: "#/properties/pages/maxItems", keyword: "maxItems", params: { limit: 40 }, message: "must NOT have more than 40 items" };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        if (data9.length < 1) {
          const err31 = { instancePath: instancePath + "/pages", schemaPath: "#/properties/pages/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        const len1 = data9.length;
        for (let i2 = 0; i2 < len1; i2++) {
          let data10 = data9[i2];
          if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
            if (data10.id === void 0) {
              const err32 = { instancePath: instancePath + "/pages/" + i2, schemaPath: "#/properties/pages/items/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
              if (vErrors === null) {
                vErrors = [err32];
              } else {
                vErrors.push(err32);
              }
              errors++;
            }
            if (data10.name === void 0) {
              const err33 = { instancePath: instancePath + "/pages/" + i2, schemaPath: "#/properties/pages/items/required", keyword: "required", params: { missingProperty: "name" }, message: "must have required property 'name'" };
              if (vErrors === null) {
                vErrors = [err33];
              } else {
                vErrors.push(err33);
              }
              errors++;
            }
            if (data10.path === void 0) {
              const err34 = { instancePath: instancePath + "/pages/" + i2, schemaPath: "#/properties/pages/items/required", keyword: "required", params: { missingProperty: "path" }, message: "must have required property 'path'" };
              if (vErrors === null) {
                vErrors = [err34];
              } else {
                vErrors.push(err34);
              }
              errors++;
            }
            if (data10.title === void 0) {
              const err35 = { instancePath: instancePath + "/pages/" + i2, schemaPath: "#/properties/pages/items/required", keyword: "required", params: { missingProperty: "title" }, message: "must have required property 'title'" };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
            if (data10.description === void 0) {
              const err36 = { instancePath: instancePath + "/pages/" + i2, schemaPath: "#/properties/pages/items/required", keyword: "required", params: { missingProperty: "description" }, message: "must have required property 'description'" };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
            if (data10.layout === void 0) {
              const err37 = { instancePath: instancePath + "/pages/" + i2, schemaPath: "#/properties/pages/items/required", keyword: "required", params: { missingProperty: "layout" }, message: "must have required property 'layout'" };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
            if (data10.sections === void 0) {
              const err38 = { instancePath: instancePath + "/pages/" + i2, schemaPath: "#/properties/pages/items/required", keyword: "required", params: { missingProperty: "sections" }, message: "must have required property 'sections'" };
              if (vErrors === null) {
                vErrors = [err38];
              } else {
                vErrors.push(err38);
              }
              errors++;
            }
            for (const key2 in data10) {
              if (!(key2 === "id" || key2 === "name" || key2 === "path" || key2 === "title" || key2 === "description" || key2 === "layout" || key2 === "sections")) {
                const err39 = { instancePath: instancePath + "/pages/" + i2, schemaPath: "#/properties/pages/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err39];
                } else {
                  vErrors.push(err39);
                }
                errors++;
              }
            }
            if (data10.id !== void 0) {
              let data11 = data10.id;
              if (typeof data11 === "string") {
                if (!pattern2.test(data11)) {
                  const err40 = { instancePath: instancePath + "/pages/" + i2 + "/id", schemaPath: "#/properties/pages/items/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, message: 'must match pattern "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$"' };
                  if (vErrors === null) {
                    vErrors = [err40];
                  } else {
                    vErrors.push(err40);
                  }
                  errors++;
                }
              } else {
                const err41 = { instancePath: instancePath + "/pages/" + i2 + "/id", schemaPath: "#/properties/pages/items/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err41];
                } else {
                  vErrors.push(err41);
                }
                errors++;
              }
            }
            if (data10.name !== void 0) {
              let data12 = data10.name;
              if (typeof data12 === "string") {
                if (func2(data12) > 120) {
                  const err42 = { instancePath: instancePath + "/pages/" + i2 + "/name", schemaPath: "#/properties/pages/items/properties/name/maxLength", keyword: "maxLength", params: { limit: 120 }, message: "must NOT have more than 120 characters" };
                  if (vErrors === null) {
                    vErrors = [err42];
                  } else {
                    vErrors.push(err42);
                  }
                  errors++;
                }
                if (func2(data12) < 1) {
                  const err43 = { instancePath: instancePath + "/pages/" + i2 + "/name", schemaPath: "#/properties/pages/items/properties/name/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err43];
                  } else {
                    vErrors.push(err43);
                  }
                  errors++;
                }
              } else {
                const err44 = { instancePath: instancePath + "/pages/" + i2 + "/name", schemaPath: "#/properties/pages/items/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err44];
                } else {
                  vErrors.push(err44);
                }
                errors++;
              }
            }
            if (data10.path !== void 0) {
              let data13 = data10.path;
              if (typeof data13 === "string") {
                if (func2(data13) > 200) {
                  const err45 = { instancePath: instancePath + "/pages/" + i2 + "/path", schemaPath: "#/properties/pages/items/properties/path/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
                  if (vErrors === null) {
                    vErrors = [err45];
                  } else {
                    vErrors.push(err45);
                  }
                  errors++;
                }
                if (func2(data13) < 1) {
                  const err46 = { instancePath: instancePath + "/pages/" + i2 + "/path", schemaPath: "#/properties/pages/items/properties/path/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err46];
                  } else {
                    vErrors.push(err46);
                  }
                  errors++;
                }
              } else {
                const err47 = { instancePath: instancePath + "/pages/" + i2 + "/path", schemaPath: "#/properties/pages/items/properties/path/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err47];
                } else {
                  vErrors.push(err47);
                }
                errors++;
              }
            }
            if (data10.title !== void 0) {
              let data14 = data10.title;
              if (typeof data14 === "string") {
                if (func2(data14) > 160) {
                  const err48 = { instancePath: instancePath + "/pages/" + i2 + "/title", schemaPath: "#/properties/pages/items/properties/title/maxLength", keyword: "maxLength", params: { limit: 160 }, message: "must NOT have more than 160 characters" };
                  if (vErrors === null) {
                    vErrors = [err48];
                  } else {
                    vErrors.push(err48);
                  }
                  errors++;
                }
                if (func2(data14) < 0) {
                  const err49 = { instancePath: instancePath + "/pages/" + i2 + "/title", schemaPath: "#/properties/pages/items/properties/title/minLength", keyword: "minLength", params: { limit: 0 }, message: "must NOT have fewer than 0 characters" };
                  if (vErrors === null) {
                    vErrors = [err49];
                  } else {
                    vErrors.push(err49);
                  }
                  errors++;
                }
              } else {
                const err50 = { instancePath: instancePath + "/pages/" + i2 + "/title", schemaPath: "#/properties/pages/items/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err50];
                } else {
                  vErrors.push(err50);
                }
                errors++;
              }
            }
            if (data10.description !== void 0) {
              let data15 = data10.description;
              if (typeof data15 === "string") {
                if (func2(data15) > 400) {
                  const err51 = { instancePath: instancePath + "/pages/" + i2 + "/description", schemaPath: "#/properties/pages/items/properties/description/maxLength", keyword: "maxLength", params: { limit: 400 }, message: "must NOT have more than 400 characters" };
                  if (vErrors === null) {
                    vErrors = [err51];
                  } else {
                    vErrors.push(err51);
                  }
                  errors++;
                }
                if (func2(data15) < 0) {
                  const err52 = { instancePath: instancePath + "/pages/" + i2 + "/description", schemaPath: "#/properties/pages/items/properties/description/minLength", keyword: "minLength", params: { limit: 0 }, message: "must NOT have fewer than 0 characters" };
                  if (vErrors === null) {
                    vErrors = [err52];
                  } else {
                    vErrors.push(err52);
                  }
                  errors++;
                }
              } else {
                const err53 = { instancePath: instancePath + "/pages/" + i2 + "/description", schemaPath: "#/properties/pages/items/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err53];
                } else {
                  vErrors.push(err53);
                }
                errors++;
              }
            }
            if (data10.layout !== void 0) {
              let data16 = data10.layout;
              if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
                if (data16.desktop === void 0) {
                  const err54 = { instancePath: instancePath + "/pages/" + i2 + "/layout", schemaPath: "#/properties/pages/items/properties/layout/required", keyword: "required", params: { missingProperty: "desktop" }, message: "must have required property 'desktop'" };
                  if (vErrors === null) {
                    vErrors = [err54];
                  } else {
                    vErrors.push(err54);
                  }
                  errors++;
                }
                if (data16.tablet === void 0) {
                  const err55 = { instancePath: instancePath + "/pages/" + i2 + "/layout", schemaPath: "#/properties/pages/items/properties/layout/required", keyword: "required", params: { missingProperty: "tablet" }, message: "must have required property 'tablet'" };
                  if (vErrors === null) {
                    vErrors = [err55];
                  } else {
                    vErrors.push(err55);
                  }
                  errors++;
                }
                if (data16.mobile === void 0) {
                  const err56 = { instancePath: instancePath + "/pages/" + i2 + "/layout", schemaPath: "#/properties/pages/items/properties/layout/required", keyword: "required", params: { missingProperty: "mobile" }, message: "must have required property 'mobile'" };
                  if (vErrors === null) {
                    vErrors = [err56];
                  } else {
                    vErrors.push(err56);
                  }
                  errors++;
                }
                for (const key3 in data16) {
                  if (!(key3 === "desktop" || key3 === "tablet" || key3 === "mobile")) {
                    const err57 = { instancePath: instancePath + "/pages/" + i2 + "/layout", schemaPath: "#/properties/pages/items/properties/layout/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
                    if (vErrors === null) {
                      vErrors = [err57];
                    } else {
                      vErrors.push(err57);
                    }
                    errors++;
                  }
                }
                if (data16.desktop !== void 0) {
                  let data17 = data16.desktop;
                  if (data17 && typeof data17 == "object" && !Array.isArray(data17)) {
                    for (const key4 in data17) {
                      if (!func12.call(schema11.properties.pages.items.properties.layout.properties.desktop.properties, key4)) {
                        const err58 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err58];
                        } else {
                          vErrors.push(err58);
                        }
                        errors++;
                      }
                    }
                    if (data17.display !== void 0) {
                      let data18 = data17.display;
                      if (!(data18 === "stack" || data18 === "grid" || data18 === "flex")) {
                        const err59 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/display", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/display/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.desktop.properties.display.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err59];
                        } else {
                          vErrors.push(err59);
                        }
                        errors++;
                      }
                    }
                    if (data17.columns !== void 0) {
                      let data19 = data17.columns;
                      if (!(typeof data19 == "number" && (!(data19 % 1) && !isNaN(data19)) && isFinite(data19))) {
                        const err60 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/columns", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/columns/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err60];
                        } else {
                          vErrors.push(err60);
                        }
                        errors++;
                      }
                      if (typeof data19 == "number" && isFinite(data19)) {
                        if (data19 > 4 || isNaN(data19)) {
                          const err61 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/columns", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/columns/maximum", keyword: "maximum", params: { comparison: "<=", limit: 4 }, message: "must be <= 4" };
                          if (vErrors === null) {
                            vErrors = [err61];
                          } else {
                            vErrors.push(err61);
                          }
                          errors++;
                        }
                        if (data19 < 1 || isNaN(data19)) {
                          const err62 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/columns", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/columns/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                          if (vErrors === null) {
                            vErrors = [err62];
                          } else {
                            vErrors.push(err62);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data17.gap !== void 0) {
                      let data20 = data17.gap;
                      if (!(typeof data20 == "number" && (!(data20 % 1) && !isNaN(data20)) && isFinite(data20))) {
                        const err63 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/gap", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/gap/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err63];
                        } else {
                          vErrors.push(err63);
                        }
                        errors++;
                      }
                      if (typeof data20 == "number" && isFinite(data20)) {
                        if (data20 > 160 || isNaN(data20)) {
                          const err64 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/gap", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/gap/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                          if (vErrors === null) {
                            vErrors = [err64];
                          } else {
                            vErrors.push(err64);
                          }
                          errors++;
                        }
                        if (data20 < 0 || isNaN(data20)) {
                          const err65 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/gap", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/gap/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                          if (vErrors === null) {
                            vErrors = [err65];
                          } else {
                            vErrors.push(err65);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data17.padding !== void 0) {
                      let data21 = data17.padding;
                      if (!(typeof data21 == "number" && (!(data21 % 1) && !isNaN(data21)) && isFinite(data21))) {
                        const err66 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/padding", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/padding/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err66];
                        } else {
                          vErrors.push(err66);
                        }
                        errors++;
                      }
                      if (typeof data21 == "number" && isFinite(data21)) {
                        if (data21 > 160 || isNaN(data21)) {
                          const err67 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/padding", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/padding/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                          if (vErrors === null) {
                            vErrors = [err67];
                          } else {
                            vErrors.push(err67);
                          }
                          errors++;
                        }
                        if (data21 < 0 || isNaN(data21)) {
                          const err68 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/padding", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/padding/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                          if (vErrors === null) {
                            vErrors = [err68];
                          } else {
                            vErrors.push(err68);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data17.margin !== void 0) {
                      let data22 = data17.margin;
                      if (!(typeof data22 == "number" && (!(data22 % 1) && !isNaN(data22)) && isFinite(data22))) {
                        const err69 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/margin", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/margin/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err69];
                        } else {
                          vErrors.push(err69);
                        }
                        errors++;
                      }
                      if (typeof data22 == "number" && isFinite(data22)) {
                        if (data22 > 160 || isNaN(data22)) {
                          const err70 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/margin", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/margin/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                          if (vErrors === null) {
                            vErrors = [err70];
                          } else {
                            vErrors.push(err70);
                          }
                          errors++;
                        }
                        if (data22 < 0 || isNaN(data22)) {
                          const err71 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/margin", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/margin/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                          if (vErrors === null) {
                            vErrors = [err71];
                          } else {
                            vErrors.push(err71);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data17.maxWidth !== void 0) {
                      let data23 = data17.maxWidth;
                      if (!(typeof data23 == "number" && (!(data23 % 1) && !isNaN(data23)) && isFinite(data23))) {
                        const err72 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/maxWidth", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/maxWidth/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err72];
                        } else {
                          vErrors.push(err72);
                        }
                        errors++;
                      }
                      if (typeof data23 == "number" && isFinite(data23)) {
                        if (data23 > 1920 || isNaN(data23)) {
                          const err73 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/maxWidth", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/maxWidth/maximum", keyword: "maximum", params: { comparison: "<=", limit: 1920 }, message: "must be <= 1920" };
                          if (vErrors === null) {
                            vErrors = [err73];
                          } else {
                            vErrors.push(err73);
                          }
                          errors++;
                        }
                        if (data23 < 320 || isNaN(data23)) {
                          const err74 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/maxWidth", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/maxWidth/minimum", keyword: "minimum", params: { comparison: ">=", limit: 320 }, message: "must be >= 320" };
                          if (vErrors === null) {
                            vErrors = [err74];
                          } else {
                            vErrors.push(err74);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data17.align !== void 0) {
                      let data24 = data17.align;
                      if (!(data24 === "left" || data24 === "center" || data24 === "right" || data24 === "stretch")) {
                        const err75 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/align", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/align/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.desktop.properties.align.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err75];
                        } else {
                          vErrors.push(err75);
                        }
                        errors++;
                      }
                    }
                    if (data17.vertical !== void 0) {
                      let data25 = data17.vertical;
                      if (!(data25 === "start" || data25 === "center" || data25 === "end")) {
                        const err76 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/vertical", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/vertical/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.desktop.properties.vertical.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err76];
                        } else {
                          vErrors.push(err76);
                        }
                        errors++;
                      }
                    }
                    if (data17.textAlign !== void 0) {
                      let data26 = data17.textAlign;
                      if (!(data26 === "left" || data26 === "center" || data26 === "right" || data26 === "justify")) {
                        const err77 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/textAlign", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/textAlign/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.desktop.properties.textAlign.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err77];
                        } else {
                          vErrors.push(err77);
                        }
                        errors++;
                      }
                    }
                    if (data17.autoAlign !== void 0) {
                      if (typeof data17.autoAlign !== "boolean") {
                        const err78 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop/autoAlign", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/properties/autoAlign/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                        if (vErrors === null) {
                          vErrors = [err78];
                        } else {
                          vErrors.push(err78);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err79 = { instancePath: instancePath + "/pages/" + i2 + "/layout/desktop", schemaPath: "#/properties/pages/items/properties/layout/properties/desktop/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err79];
                    } else {
                      vErrors.push(err79);
                    }
                    errors++;
                  }
                }
                if (data16.tablet !== void 0) {
                  let data28 = data16.tablet;
                  if (data28 && typeof data28 == "object" && !Array.isArray(data28)) {
                    for (const key5 in data28) {
                      if (!func12.call(schema11.properties.pages.items.properties.layout.properties.tablet.properties, key5)) {
                        const err80 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err80];
                        } else {
                          vErrors.push(err80);
                        }
                        errors++;
                      }
                    }
                    if (data28.display !== void 0) {
                      let data29 = data28.display;
                      if (!(data29 === "stack" || data29 === "grid" || data29 === "flex")) {
                        const err81 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/display", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/display/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.tablet.properties.display.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err81];
                        } else {
                          vErrors.push(err81);
                        }
                        errors++;
                      }
                    }
                    if (data28.columns !== void 0) {
                      let data30 = data28.columns;
                      if (!(typeof data30 == "number" && (!(data30 % 1) && !isNaN(data30)) && isFinite(data30))) {
                        const err82 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/columns", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/columns/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err82];
                        } else {
                          vErrors.push(err82);
                        }
                        errors++;
                      }
                      if (typeof data30 == "number" && isFinite(data30)) {
                        if (data30 > 4 || isNaN(data30)) {
                          const err83 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/columns", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/columns/maximum", keyword: "maximum", params: { comparison: "<=", limit: 4 }, message: "must be <= 4" };
                          if (vErrors === null) {
                            vErrors = [err83];
                          } else {
                            vErrors.push(err83);
                          }
                          errors++;
                        }
                        if (data30 < 1 || isNaN(data30)) {
                          const err84 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/columns", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/columns/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                          if (vErrors === null) {
                            vErrors = [err84];
                          } else {
                            vErrors.push(err84);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data28.gap !== void 0) {
                      let data31 = data28.gap;
                      if (!(typeof data31 == "number" && (!(data31 % 1) && !isNaN(data31)) && isFinite(data31))) {
                        const err85 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/gap", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/gap/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err85];
                        } else {
                          vErrors.push(err85);
                        }
                        errors++;
                      }
                      if (typeof data31 == "number" && isFinite(data31)) {
                        if (data31 > 160 || isNaN(data31)) {
                          const err86 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/gap", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/gap/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                          if (vErrors === null) {
                            vErrors = [err86];
                          } else {
                            vErrors.push(err86);
                          }
                          errors++;
                        }
                        if (data31 < 0 || isNaN(data31)) {
                          const err87 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/gap", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/gap/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                          if (vErrors === null) {
                            vErrors = [err87];
                          } else {
                            vErrors.push(err87);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data28.padding !== void 0) {
                      let data32 = data28.padding;
                      if (!(typeof data32 == "number" && (!(data32 % 1) && !isNaN(data32)) && isFinite(data32))) {
                        const err88 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/padding", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/padding/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err88];
                        } else {
                          vErrors.push(err88);
                        }
                        errors++;
                      }
                      if (typeof data32 == "number" && isFinite(data32)) {
                        if (data32 > 160 || isNaN(data32)) {
                          const err89 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/padding", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/padding/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                          if (vErrors === null) {
                            vErrors = [err89];
                          } else {
                            vErrors.push(err89);
                          }
                          errors++;
                        }
                        if (data32 < 0 || isNaN(data32)) {
                          const err90 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/padding", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/padding/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                          if (vErrors === null) {
                            vErrors = [err90];
                          } else {
                            vErrors.push(err90);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data28.margin !== void 0) {
                      let data33 = data28.margin;
                      if (!(typeof data33 == "number" && (!(data33 % 1) && !isNaN(data33)) && isFinite(data33))) {
                        const err91 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/margin", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/margin/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err91];
                        } else {
                          vErrors.push(err91);
                        }
                        errors++;
                      }
                      if (typeof data33 == "number" && isFinite(data33)) {
                        if (data33 > 160 || isNaN(data33)) {
                          const err92 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/margin", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/margin/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                          if (vErrors === null) {
                            vErrors = [err92];
                          } else {
                            vErrors.push(err92);
                          }
                          errors++;
                        }
                        if (data33 < 0 || isNaN(data33)) {
                          const err93 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/margin", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/margin/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                          if (vErrors === null) {
                            vErrors = [err93];
                          } else {
                            vErrors.push(err93);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data28.maxWidth !== void 0) {
                      let data34 = data28.maxWidth;
                      if (!(typeof data34 == "number" && (!(data34 % 1) && !isNaN(data34)) && isFinite(data34))) {
                        const err94 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/maxWidth", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/maxWidth/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err94];
                        } else {
                          vErrors.push(err94);
                        }
                        errors++;
                      }
                      if (typeof data34 == "number" && isFinite(data34)) {
                        if (data34 > 1920 || isNaN(data34)) {
                          const err95 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/maxWidth", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/maxWidth/maximum", keyword: "maximum", params: { comparison: "<=", limit: 1920 }, message: "must be <= 1920" };
                          if (vErrors === null) {
                            vErrors = [err95];
                          } else {
                            vErrors.push(err95);
                          }
                          errors++;
                        }
                        if (data34 < 320 || isNaN(data34)) {
                          const err96 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/maxWidth", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/maxWidth/minimum", keyword: "minimum", params: { comparison: ">=", limit: 320 }, message: "must be >= 320" };
                          if (vErrors === null) {
                            vErrors = [err96];
                          } else {
                            vErrors.push(err96);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data28.align !== void 0) {
                      let data35 = data28.align;
                      if (!(data35 === "left" || data35 === "center" || data35 === "right" || data35 === "stretch")) {
                        const err97 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/align", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/align/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.tablet.properties.align.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err97];
                        } else {
                          vErrors.push(err97);
                        }
                        errors++;
                      }
                    }
                    if (data28.vertical !== void 0) {
                      let data36 = data28.vertical;
                      if (!(data36 === "start" || data36 === "center" || data36 === "end")) {
                        const err98 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/vertical", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/vertical/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.tablet.properties.vertical.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err98];
                        } else {
                          vErrors.push(err98);
                        }
                        errors++;
                      }
                    }
                    if (data28.textAlign !== void 0) {
                      let data37 = data28.textAlign;
                      if (!(data37 === "left" || data37 === "center" || data37 === "right" || data37 === "justify")) {
                        const err99 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/textAlign", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/textAlign/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.tablet.properties.textAlign.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err99];
                        } else {
                          vErrors.push(err99);
                        }
                        errors++;
                      }
                    }
                    if (data28.autoAlign !== void 0) {
                      if (typeof data28.autoAlign !== "boolean") {
                        const err100 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet/autoAlign", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/properties/autoAlign/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                        if (vErrors === null) {
                          vErrors = [err100];
                        } else {
                          vErrors.push(err100);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err101 = { instancePath: instancePath + "/pages/" + i2 + "/layout/tablet", schemaPath: "#/properties/pages/items/properties/layout/properties/tablet/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err101];
                    } else {
                      vErrors.push(err101);
                    }
                    errors++;
                  }
                }
                if (data16.mobile !== void 0) {
                  let data39 = data16.mobile;
                  if (data39 && typeof data39 == "object" && !Array.isArray(data39)) {
                    for (const key6 in data39) {
                      if (!func12.call(schema11.properties.pages.items.properties.layout.properties.mobile.properties, key6)) {
                        const err102 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err102];
                        } else {
                          vErrors.push(err102);
                        }
                        errors++;
                      }
                    }
                    if (data39.display !== void 0) {
                      let data40 = data39.display;
                      if (!(data40 === "stack" || data40 === "grid" || data40 === "flex")) {
                        const err103 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/display", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/display/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.mobile.properties.display.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err103];
                        } else {
                          vErrors.push(err103);
                        }
                        errors++;
                      }
                    }
                    if (data39.columns !== void 0) {
                      let data41 = data39.columns;
                      if (!(typeof data41 == "number" && (!(data41 % 1) && !isNaN(data41)) && isFinite(data41))) {
                        const err104 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/columns", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/columns/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err104];
                        } else {
                          vErrors.push(err104);
                        }
                        errors++;
                      }
                      if (typeof data41 == "number" && isFinite(data41)) {
                        if (data41 > 4 || isNaN(data41)) {
                          const err105 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/columns", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/columns/maximum", keyword: "maximum", params: { comparison: "<=", limit: 4 }, message: "must be <= 4" };
                          if (vErrors === null) {
                            vErrors = [err105];
                          } else {
                            vErrors.push(err105);
                          }
                          errors++;
                        }
                        if (data41 < 1 || isNaN(data41)) {
                          const err106 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/columns", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/columns/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                          if (vErrors === null) {
                            vErrors = [err106];
                          } else {
                            vErrors.push(err106);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data39.gap !== void 0) {
                      let data42 = data39.gap;
                      if (!(typeof data42 == "number" && (!(data42 % 1) && !isNaN(data42)) && isFinite(data42))) {
                        const err107 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/gap", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/gap/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err107];
                        } else {
                          vErrors.push(err107);
                        }
                        errors++;
                      }
                      if (typeof data42 == "number" && isFinite(data42)) {
                        if (data42 > 160 || isNaN(data42)) {
                          const err108 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/gap", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/gap/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                          if (vErrors === null) {
                            vErrors = [err108];
                          } else {
                            vErrors.push(err108);
                          }
                          errors++;
                        }
                        if (data42 < 0 || isNaN(data42)) {
                          const err109 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/gap", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/gap/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                          if (vErrors === null) {
                            vErrors = [err109];
                          } else {
                            vErrors.push(err109);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data39.padding !== void 0) {
                      let data43 = data39.padding;
                      if (!(typeof data43 == "number" && (!(data43 % 1) && !isNaN(data43)) && isFinite(data43))) {
                        const err110 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/padding", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/padding/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err110];
                        } else {
                          vErrors.push(err110);
                        }
                        errors++;
                      }
                      if (typeof data43 == "number" && isFinite(data43)) {
                        if (data43 > 160 || isNaN(data43)) {
                          const err111 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/padding", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/padding/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                          if (vErrors === null) {
                            vErrors = [err111];
                          } else {
                            vErrors.push(err111);
                          }
                          errors++;
                        }
                        if (data43 < 0 || isNaN(data43)) {
                          const err112 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/padding", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/padding/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                          if (vErrors === null) {
                            vErrors = [err112];
                          } else {
                            vErrors.push(err112);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data39.margin !== void 0) {
                      let data44 = data39.margin;
                      if (!(typeof data44 == "number" && (!(data44 % 1) && !isNaN(data44)) && isFinite(data44))) {
                        const err113 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/margin", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/margin/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err113];
                        } else {
                          vErrors.push(err113);
                        }
                        errors++;
                      }
                      if (typeof data44 == "number" && isFinite(data44)) {
                        if (data44 > 160 || isNaN(data44)) {
                          const err114 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/margin", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/margin/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                          if (vErrors === null) {
                            vErrors = [err114];
                          } else {
                            vErrors.push(err114);
                          }
                          errors++;
                        }
                        if (data44 < 0 || isNaN(data44)) {
                          const err115 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/margin", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/margin/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                          if (vErrors === null) {
                            vErrors = [err115];
                          } else {
                            vErrors.push(err115);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data39.maxWidth !== void 0) {
                      let data45 = data39.maxWidth;
                      if (!(typeof data45 == "number" && (!(data45 % 1) && !isNaN(data45)) && isFinite(data45))) {
                        const err116 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/maxWidth", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/maxWidth/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                        if (vErrors === null) {
                          vErrors = [err116];
                        } else {
                          vErrors.push(err116);
                        }
                        errors++;
                      }
                      if (typeof data45 == "number" && isFinite(data45)) {
                        if (data45 > 1920 || isNaN(data45)) {
                          const err117 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/maxWidth", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/maxWidth/maximum", keyword: "maximum", params: { comparison: "<=", limit: 1920 }, message: "must be <= 1920" };
                          if (vErrors === null) {
                            vErrors = [err117];
                          } else {
                            vErrors.push(err117);
                          }
                          errors++;
                        }
                        if (data45 < 320 || isNaN(data45)) {
                          const err118 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/maxWidth", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/maxWidth/minimum", keyword: "minimum", params: { comparison: ">=", limit: 320 }, message: "must be >= 320" };
                          if (vErrors === null) {
                            vErrors = [err118];
                          } else {
                            vErrors.push(err118);
                          }
                          errors++;
                        }
                      }
                    }
                    if (data39.align !== void 0) {
                      let data46 = data39.align;
                      if (!(data46 === "left" || data46 === "center" || data46 === "right" || data46 === "stretch")) {
                        const err119 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/align", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/align/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.mobile.properties.align.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err119];
                        } else {
                          vErrors.push(err119);
                        }
                        errors++;
                      }
                    }
                    if (data39.vertical !== void 0) {
                      let data47 = data39.vertical;
                      if (!(data47 === "start" || data47 === "center" || data47 === "end")) {
                        const err120 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/vertical", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/vertical/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.mobile.properties.vertical.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err120];
                        } else {
                          vErrors.push(err120);
                        }
                        errors++;
                      }
                    }
                    if (data39.textAlign !== void 0) {
                      let data48 = data39.textAlign;
                      if (!(data48 === "left" || data48 === "center" || data48 === "right" || data48 === "justify")) {
                        const err121 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/textAlign", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/textAlign/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.layout.properties.mobile.properties.textAlign.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err121];
                        } else {
                          vErrors.push(err121);
                        }
                        errors++;
                      }
                    }
                    if (data39.autoAlign !== void 0) {
                      if (typeof data39.autoAlign !== "boolean") {
                        const err122 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile/autoAlign", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/properties/autoAlign/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                        if (vErrors === null) {
                          vErrors = [err122];
                        } else {
                          vErrors.push(err122);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err123 = { instancePath: instancePath + "/pages/" + i2 + "/layout/mobile", schemaPath: "#/properties/pages/items/properties/layout/properties/mobile/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err123];
                    } else {
                      vErrors.push(err123);
                    }
                    errors++;
                  }
                }
              } else {
                const err124 = { instancePath: instancePath + "/pages/" + i2 + "/layout", schemaPath: "#/properties/pages/items/properties/layout/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                if (vErrors === null) {
                  vErrors = [err124];
                } else {
                  vErrors.push(err124);
                }
                errors++;
              }
            }
            if (data10.sections !== void 0) {
              let data50 = data10.sections;
              if (Array.isArray(data50)) {
                if (data50.length > 60) {
                  const err125 = { instancePath: instancePath + "/pages/" + i2 + "/sections", schemaPath: "#/properties/pages/items/properties/sections/maxItems", keyword: "maxItems", params: { limit: 60 }, message: "must NOT have more than 60 items" };
                  if (vErrors === null) {
                    vErrors = [err125];
                  } else {
                    vErrors.push(err125);
                  }
                  errors++;
                }
                const len2 = data50.length;
                for (let i3 = 0; i3 < len2; i3++) {
                  let data51 = data50[i3];
                  if (data51 && typeof data51 == "object" && !Array.isArray(data51)) {
                    if (data51.id === void 0) {
                      const err126 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3, schemaPath: "#/properties/pages/items/properties/sections/items/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
                      if (vErrors === null) {
                        vErrors = [err126];
                      } else {
                        vErrors.push(err126);
                      }
                      errors++;
                    }
                    if (data51.name === void 0) {
                      const err127 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3, schemaPath: "#/properties/pages/items/properties/sections/items/required", keyword: "required", params: { missingProperty: "name" }, message: "must have required property 'name'" };
                      if (vErrors === null) {
                        vErrors = [err127];
                      } else {
                        vErrors.push(err127);
                      }
                      errors++;
                    }
                    if (data51.kind === void 0) {
                      const err128 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3, schemaPath: "#/properties/pages/items/properties/sections/items/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
                      if (vErrors === null) {
                        vErrors = [err128];
                      } else {
                        vErrors.push(err128);
                      }
                      errors++;
                    }
                    if (data51.enabled === void 0) {
                      const err129 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3, schemaPath: "#/properties/pages/items/properties/sections/items/required", keyword: "required", params: { missingProperty: "enabled" }, message: "must have required property 'enabled'" };
                      if (vErrors === null) {
                        vErrors = [err129];
                      } else {
                        vErrors.push(err129);
                      }
                      errors++;
                    }
                    if (data51.fields === void 0) {
                      const err130 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3, schemaPath: "#/properties/pages/items/properties/sections/items/required", keyword: "required", params: { missingProperty: "fields" }, message: "must have required property 'fields'" };
                      if (vErrors === null) {
                        vErrors = [err130];
                      } else {
                        vErrors.push(err130);
                      }
                      errors++;
                    }
                    if (data51.layout === void 0) {
                      const err131 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3, schemaPath: "#/properties/pages/items/properties/sections/items/required", keyword: "required", params: { missingProperty: "layout" }, message: "must have required property 'layout'" };
                      if (vErrors === null) {
                        vErrors = [err131];
                      } else {
                        vErrors.push(err131);
                      }
                      errors++;
                    }
                    for (const key7 in data51) {
                      if (!(key7 === "id" || key7 === "name" || key7 === "kind" || key7 === "enabled" || key7 === "fields" || key7 === "layout")) {
                        const err132 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3, schemaPath: "#/properties/pages/items/properties/sections/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err132];
                        } else {
                          vErrors.push(err132);
                        }
                        errors++;
                      }
                    }
                    if (data51.id !== void 0) {
                      let data52 = data51.id;
                      if (typeof data52 === "string") {
                        if (!pattern2.test(data52)) {
                          const err133 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/id", schemaPath: "#/properties/pages/items/properties/sections/items/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, message: 'must match pattern "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$"' };
                          if (vErrors === null) {
                            vErrors = [err133];
                          } else {
                            vErrors.push(err133);
                          }
                          errors++;
                        }
                      } else {
                        const err134 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/id", schemaPath: "#/properties/pages/items/properties/sections/items/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err134];
                        } else {
                          vErrors.push(err134);
                        }
                        errors++;
                      }
                    }
                    if (data51.name !== void 0) {
                      let data53 = data51.name;
                      if (typeof data53 === "string") {
                        if (func2(data53) > 150) {
                          const err135 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/name", schemaPath: "#/properties/pages/items/properties/sections/items/properties/name/maxLength", keyword: "maxLength", params: { limit: 150 }, message: "must NOT have more than 150 characters" };
                          if (vErrors === null) {
                            vErrors = [err135];
                          } else {
                            vErrors.push(err135);
                          }
                          errors++;
                        }
                        if (func2(data53) < 1) {
                          const err136 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/name", schemaPath: "#/properties/pages/items/properties/sections/items/properties/name/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                          if (vErrors === null) {
                            vErrors = [err136];
                          } else {
                            vErrors.push(err136);
                          }
                          errors++;
                        }
                      } else {
                        const err137 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/name", schemaPath: "#/properties/pages/items/properties/sections/items/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err137];
                        } else {
                          vErrors.push(err137);
                        }
                        errors++;
                      }
                    }
                    if (data51.kind !== void 0) {
                      let data54 = data51.kind;
                      if (!(data54 === "source" || data54 === "text" || data54 === "hero" || data54 === "image" || data54 === "cta" || data54 === "booking" || data54 === "gadget")) {
                        const err138 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/kind", schemaPath: "#/properties/pages/items/properties/sections/items/properties/kind/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.kind.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                          vErrors = [err138];
                        } else {
                          vErrors.push(err138);
                        }
                        errors++;
                      }
                    }
                    if (data51.enabled !== void 0) {
                      if (typeof data51.enabled !== "boolean") {
                        const err139 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/enabled", schemaPath: "#/properties/pages/items/properties/sections/items/properties/enabled/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                        if (vErrors === null) {
                          vErrors = [err139];
                        } else {
                          vErrors.push(err139);
                        }
                        errors++;
                      }
                    }
                    if (data51.fields !== void 0) {
                      let data56 = data51.fields;
                      if (Array.isArray(data56)) {
                        if (data56.length > 40) {
                          const err140 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/maxItems", keyword: "maxItems", params: { limit: 40 }, message: "must NOT have more than 40 items" };
                          if (vErrors === null) {
                            vErrors = [err140];
                          } else {
                            vErrors.push(err140);
                          }
                          errors++;
                        }
                        const len3 = data56.length;
                        for (let i4 = 0; i4 < len3; i4++) {
                          let data57 = data56[i4];
                          if (data57 && typeof data57 == "object" && !Array.isArray(data57)) {
                            if (data57.id === void 0) {
                              const err141 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4, schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
                              if (vErrors === null) {
                                vErrors = [err141];
                              } else {
                                vErrors.push(err141);
                              }
                              errors++;
                            }
                            if (data57.label === void 0) {
                              const err142 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4, schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property 'label'" };
                              if (vErrors === null) {
                                vErrors = [err142];
                              } else {
                                vErrors.push(err142);
                              }
                              errors++;
                            }
                            if (data57.type === void 0) {
                              const err143 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4, schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
                              if (vErrors === null) {
                                vErrors = [err143];
                              } else {
                                vErrors.push(err143);
                              }
                              errors++;
                            }
                            if (data57.value === void 0) {
                              const err144 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4, schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property 'value'" };
                              if (vErrors === null) {
                                vErrors = [err144];
                              } else {
                                vErrors.push(err144);
                              }
                              errors++;
                            }
                            for (const key8 in data57) {
                              if (!func12.call(schema11.properties.pages.items.properties.sections.items.properties.fields.items.properties, key8)) {
                                const err145 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4, schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key8 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err145];
                                } else {
                                  vErrors.push(err145);
                                }
                                errors++;
                              }
                            }
                            if (data57.id !== void 0) {
                              let data58 = data57.id;
                              if (typeof data58 === "string") {
                                if (!pattern2.test(data58)) {
                                  const err146 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/id", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, message: 'must match pattern "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$"' };
                                  if (vErrors === null) {
                                    vErrors = [err146];
                                  } else {
                                    vErrors.push(err146);
                                  }
                                  errors++;
                                }
                              } else {
                                const err147 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/id", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err147];
                                } else {
                                  vErrors.push(err147);
                                }
                                errors++;
                              }
                            }
                            if (data57.label !== void 0) {
                              let data59 = data57.label;
                              if (typeof data59 === "string") {
                                if (func2(data59) > 120) {
                                  const err148 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/label", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/label/maxLength", keyword: "maxLength", params: { limit: 120 }, message: "must NOT have more than 120 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err148];
                                  } else {
                                    vErrors.push(err148);
                                  }
                                  errors++;
                                }
                                if (func2(data59) < 1) {
                                  const err149 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/label", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/label/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err149];
                                  } else {
                                    vErrors.push(err149);
                                  }
                                  errors++;
                                }
                              } else {
                                const err150 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/label", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/label/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err150];
                                } else {
                                  vErrors.push(err150);
                                }
                                errors++;
                              }
                            }
                            if (data57.type !== void 0) {
                              let data60 = data57.type;
                              if (!(data60 === "text" || data60 === "rich" || data60 === "url" || data60 === "image" || data60 === "number" || data60 === "boolean" || data60 === "enum")) {
                                const err151 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/type", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/type/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.fields.items.properties.type.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err151];
                                } else {
                                  vErrors.push(err151);
                                }
                                errors++;
                              }
                            }
                            if (data57.value !== void 0) {
                              let data61 = data57.value;
                              if (typeof data61 !== "string" && !(typeof data61 == "number" && isFinite(data61)) && typeof data61 !== "boolean") {
                                const err152 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/value", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/value/type", keyword: "type", params: { type: schema11.properties.pages.items.properties.sections.items.properties.fields.items.properties.value.type }, message: "must be string,number,boolean" };
                                if (vErrors === null) {
                                  vErrors = [err152];
                                } else {
                                  vErrors.push(err152);
                                }
                                errors++;
                              }
                              if (typeof data61 === "string") {
                                if (func2(data61) > 12e3) {
                                  const err153 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/value", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/value/maxLength", keyword: "maxLength", params: { limit: 12e3 }, message: "must NOT have more than 12000 characters" };
                                  if (vErrors === null) {
                                    vErrors = [err153];
                                  } else {
                                    vErrors.push(err153);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data57.required !== void 0) {
                              if (typeof data57.required !== "boolean") {
                                const err154 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/required", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/required/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                                if (vErrors === null) {
                                  vErrors = [err154];
                                } else {
                                  vErrors.push(err154);
                                }
                                errors++;
                              }
                            }
                            if (data57.min !== void 0) {
                              let data63 = data57.min;
                              if (!(typeof data63 == "number" && isFinite(data63))) {
                                const err155 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/min", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/min/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                                if (vErrors === null) {
                                  vErrors = [err155];
                                } else {
                                  vErrors.push(err155);
                                }
                                errors++;
                              }
                            }
                            if (data57.max !== void 0) {
                              let data64 = data57.max;
                              if (!(typeof data64 == "number" && isFinite(data64))) {
                                const err156 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/max", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/max/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                                if (vErrors === null) {
                                  vErrors = [err156];
                                } else {
                                  vErrors.push(err156);
                                }
                                errors++;
                              }
                            }
                            if (data57.maxLength !== void 0) {
                              let data65 = data57.maxLength;
                              if (!(typeof data65 == "number" && (!(data65 % 1) && !isNaN(data65)) && isFinite(data65))) {
                                const err157 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/maxLength", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/maxLength/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err157];
                                } else {
                                  vErrors.push(err157);
                                }
                                errors++;
                              }
                              if (typeof data65 == "number" && isFinite(data65)) {
                                if (data65 > 12e3 || isNaN(data65)) {
                                  const err158 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/maxLength", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/maxLength/maximum", keyword: "maximum", params: { comparison: "<=", limit: 12e3 }, message: "must be <= 12000" };
                                  if (vErrors === null) {
                                    vErrors = [err158];
                                  } else {
                                    vErrors.push(err158);
                                  }
                                  errors++;
                                }
                                if (data65 < 1 || isNaN(data65)) {
                                  const err159 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/maxLength", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/maxLength/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                  if (vErrors === null) {
                                    vErrors = [err159];
                                  } else {
                                    vErrors.push(err159);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data57.step !== void 0) {
                              let data66 = data57.step;
                              if (typeof data66 == "number" && isFinite(data66)) {
                                if (data66 <= 0 || isNaN(data66)) {
                                  const err160 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/step", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/step/exclusiveMinimum", keyword: "exclusiveMinimum", params: { comparison: ">", limit: 0 }, message: "must be > 0" };
                                  if (vErrors === null) {
                                    vErrors = [err160];
                                  } else {
                                    vErrors.push(err160);
                                  }
                                  errors++;
                                }
                              } else {
                                const err161 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/step", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/step/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                                if (vErrors === null) {
                                  vErrors = [err161];
                                } else {
                                  vErrors.push(err161);
                                }
                                errors++;
                              }
                            }
                            if (data57.dictionary !== void 0) {
                              let data67 = data57.dictionary;
                              if (typeof data67 === "string") {
                                if (!pattern2.test(data67)) {
                                  const err162 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/dictionary", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/dictionary/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, message: 'must match pattern "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$"' };
                                  if (vErrors === null) {
                                    vErrors = [err162];
                                  } else {
                                    vErrors.push(err162);
                                  }
                                  errors++;
                                }
                              } else {
                                const err163 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/dictionary", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/dictionary/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                  vErrors = [err163];
                                } else {
                                  vErrors.push(err163);
                                }
                                errors++;
                              }
                            }
                            if (data57.translations !== void 0) {
                              let data68 = data57.translations;
                              if (data68 && typeof data68 == "object" && !Array.isArray(data68)) {
                                if (Object.keys(data68).length > 30) {
                                  const err164 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/translations", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/translations/maxProperties", keyword: "maxProperties", params: { limit: 30 }, message: "must NOT have more than 30 properties" };
                                  if (vErrors === null) {
                                    vErrors = [err164];
                                  } else {
                                    vErrors.push(err164);
                                  }
                                  errors++;
                                }
                                for (const key9 in data68) {
                                  const _errs131 = errors;
                                  if (typeof key9 === "string") {
                                    if (!pattern0.test(key9)) {
                                      const err165 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/translations", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/translations/propertyNames/pattern", keyword: "pattern", params: { pattern: "^[a-z]{2,3}(-[A-Z]{2})?$" }, message: 'must match pattern "^[a-z]{2,3}(-[A-Z]{2})?$"', propertyName: key9 };
                                      if (vErrors === null) {
                                        vErrors = [err165];
                                      } else {
                                        vErrors.push(err165);
                                      }
                                      errors++;
                                    }
                                  }
                                  var valid18 = _errs131 === errors;
                                  if (!valid18) {
                                    const err166 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/translations", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/translations/propertyNames", keyword: "propertyNames", params: { propertyName: key9 }, message: "property name must be valid" };
                                    if (vErrors === null) {
                                      vErrors = [err166];
                                    } else {
                                      vErrors.push(err166);
                                    }
                                    errors++;
                                  }
                                }
                                for (const key10 in data68) {
                                  let data69 = data68[key10];
                                  if (typeof data69 === "string") {
                                    if (func2(data69) > 12e3) {
                                      const err167 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/translations/" + key10.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/translations/additionalProperties/maxLength", keyword: "maxLength", params: { limit: 12e3 }, message: "must NOT have more than 12000 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err167];
                                      } else {
                                        vErrors.push(err167);
                                      }
                                      errors++;
                                    }
                                    if (func2(data69) < 0) {
                                      const err168 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/translations/" + key10.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/translations/additionalProperties/minLength", keyword: "minLength", params: { limit: 0 }, message: "must NOT have fewer than 0 characters" };
                                      if (vErrors === null) {
                                        vErrors = [err168];
                                      } else {
                                        vErrors.push(err168);
                                      }
                                      errors++;
                                    }
                                  } else {
                                    const err169 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/translations/" + key10.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/translations/additionalProperties/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                      vErrors = [err169];
                                    } else {
                                      vErrors.push(err169);
                                    }
                                    errors++;
                                  }
                                }
                              } else {
                                const err170 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4 + "/translations", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/properties/translations/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                                if (vErrors === null) {
                                  vErrors = [err170];
                                } else {
                                  vErrors.push(err170);
                                }
                                errors++;
                              }
                            }
                          } else {
                            const err171 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields/" + i4, schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/items/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err171];
                            } else {
                              vErrors.push(err171);
                            }
                            errors++;
                          }
                        }
                      } else {
                        const err172 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/fields", schemaPath: "#/properties/pages/items/properties/sections/items/properties/fields/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                        if (vErrors === null) {
                          vErrors = [err172];
                        } else {
                          vErrors.push(err172);
                        }
                        errors++;
                      }
                    }
                    if (data51.layout !== void 0) {
                      let data70 = data51.layout;
                      if (data70 && typeof data70 == "object" && !Array.isArray(data70)) {
                        if (data70.desktop === void 0) {
                          const err173 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/required", keyword: "required", params: { missingProperty: "desktop" }, message: "must have required property 'desktop'" };
                          if (vErrors === null) {
                            vErrors = [err173];
                          } else {
                            vErrors.push(err173);
                          }
                          errors++;
                        }
                        if (data70.tablet === void 0) {
                          const err174 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/required", keyword: "required", params: { missingProperty: "tablet" }, message: "must have required property 'tablet'" };
                          if (vErrors === null) {
                            vErrors = [err174];
                          } else {
                            vErrors.push(err174);
                          }
                          errors++;
                        }
                        if (data70.mobile === void 0) {
                          const err175 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/required", keyword: "required", params: { missingProperty: "mobile" }, message: "must have required property 'mobile'" };
                          if (vErrors === null) {
                            vErrors = [err175];
                          } else {
                            vErrors.push(err175);
                          }
                          errors++;
                        }
                        for (const key11 in data70) {
                          if (!(key11 === "desktop" || key11 === "tablet" || key11 === "mobile")) {
                            const err176 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key11 }, message: "must NOT have additional properties" };
                            if (vErrors === null) {
                              vErrors = [err176];
                            } else {
                              vErrors.push(err176);
                            }
                            errors++;
                          }
                        }
                        if (data70.desktop !== void 0) {
                          let data71 = data70.desktop;
                          if (data71 && typeof data71 == "object" && !Array.isArray(data71)) {
                            for (const key12 in data71) {
                              if (!func12.call(schema11.properties.pages.items.properties.sections.items.properties.layout.properties.desktop.properties, key12)) {
                                const err177 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key12 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err177];
                                } else {
                                  vErrors.push(err177);
                                }
                                errors++;
                              }
                            }
                            if (data71.display !== void 0) {
                              let data72 = data71.display;
                              if (!(data72 === "stack" || data72 === "grid" || data72 === "flex")) {
                                const err178 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/display", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/display/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.desktop.properties.display.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err178];
                                } else {
                                  vErrors.push(err178);
                                }
                                errors++;
                              }
                            }
                            if (data71.columns !== void 0) {
                              let data73 = data71.columns;
                              if (!(typeof data73 == "number" && (!(data73 % 1) && !isNaN(data73)) && isFinite(data73))) {
                                const err179 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/columns", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/columns/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err179];
                                } else {
                                  vErrors.push(err179);
                                }
                                errors++;
                              }
                              if (typeof data73 == "number" && isFinite(data73)) {
                                if (data73 > 4 || isNaN(data73)) {
                                  const err180 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/columns", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/columns/maximum", keyword: "maximum", params: { comparison: "<=", limit: 4 }, message: "must be <= 4" };
                                  if (vErrors === null) {
                                    vErrors = [err180];
                                  } else {
                                    vErrors.push(err180);
                                  }
                                  errors++;
                                }
                                if (data73 < 1 || isNaN(data73)) {
                                  const err181 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/columns", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/columns/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                  if (vErrors === null) {
                                    vErrors = [err181];
                                  } else {
                                    vErrors.push(err181);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data71.gap !== void 0) {
                              let data74 = data71.gap;
                              if (!(typeof data74 == "number" && (!(data74 % 1) && !isNaN(data74)) && isFinite(data74))) {
                                const err182 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/gap", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/gap/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err182];
                                } else {
                                  vErrors.push(err182);
                                }
                                errors++;
                              }
                              if (typeof data74 == "number" && isFinite(data74)) {
                                if (data74 > 160 || isNaN(data74)) {
                                  const err183 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/gap", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/gap/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                                  if (vErrors === null) {
                                    vErrors = [err183];
                                  } else {
                                    vErrors.push(err183);
                                  }
                                  errors++;
                                }
                                if (data74 < 0 || isNaN(data74)) {
                                  const err184 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/gap", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/gap/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err184];
                                  } else {
                                    vErrors.push(err184);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data71.padding !== void 0) {
                              let data75 = data71.padding;
                              if (!(typeof data75 == "number" && (!(data75 % 1) && !isNaN(data75)) && isFinite(data75))) {
                                const err185 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/padding", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/padding/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err185];
                                } else {
                                  vErrors.push(err185);
                                }
                                errors++;
                              }
                              if (typeof data75 == "number" && isFinite(data75)) {
                                if (data75 > 160 || isNaN(data75)) {
                                  const err186 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/padding", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/padding/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                                  if (vErrors === null) {
                                    vErrors = [err186];
                                  } else {
                                    vErrors.push(err186);
                                  }
                                  errors++;
                                }
                                if (data75 < 0 || isNaN(data75)) {
                                  const err187 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/padding", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/padding/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err187];
                                  } else {
                                    vErrors.push(err187);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data71.margin !== void 0) {
                              let data76 = data71.margin;
                              if (!(typeof data76 == "number" && (!(data76 % 1) && !isNaN(data76)) && isFinite(data76))) {
                                const err188 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/margin", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/margin/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err188];
                                } else {
                                  vErrors.push(err188);
                                }
                                errors++;
                              }
                              if (typeof data76 == "number" && isFinite(data76)) {
                                if (data76 > 160 || isNaN(data76)) {
                                  const err189 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/margin", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/margin/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                                  if (vErrors === null) {
                                    vErrors = [err189];
                                  } else {
                                    vErrors.push(err189);
                                  }
                                  errors++;
                                }
                                if (data76 < 0 || isNaN(data76)) {
                                  const err190 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/margin", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/margin/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err190];
                                  } else {
                                    vErrors.push(err190);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data71.maxWidth !== void 0) {
                              let data77 = data71.maxWidth;
                              if (!(typeof data77 == "number" && (!(data77 % 1) && !isNaN(data77)) && isFinite(data77))) {
                                const err191 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/maxWidth", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/maxWidth/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err191];
                                } else {
                                  vErrors.push(err191);
                                }
                                errors++;
                              }
                              if (typeof data77 == "number" && isFinite(data77)) {
                                if (data77 > 1920 || isNaN(data77)) {
                                  const err192 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/maxWidth", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/maxWidth/maximum", keyword: "maximum", params: { comparison: "<=", limit: 1920 }, message: "must be <= 1920" };
                                  if (vErrors === null) {
                                    vErrors = [err192];
                                  } else {
                                    vErrors.push(err192);
                                  }
                                  errors++;
                                }
                                if (data77 < 320 || isNaN(data77)) {
                                  const err193 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/maxWidth", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/maxWidth/minimum", keyword: "minimum", params: { comparison: ">=", limit: 320 }, message: "must be >= 320" };
                                  if (vErrors === null) {
                                    vErrors = [err193];
                                  } else {
                                    vErrors.push(err193);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data71.align !== void 0) {
                              let data78 = data71.align;
                              if (!(data78 === "left" || data78 === "center" || data78 === "right" || data78 === "stretch")) {
                                const err194 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/align", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/align/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.desktop.properties.align.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err194];
                                } else {
                                  vErrors.push(err194);
                                }
                                errors++;
                              }
                            }
                            if (data71.vertical !== void 0) {
                              let data79 = data71.vertical;
                              if (!(data79 === "start" || data79 === "center" || data79 === "end")) {
                                const err195 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/vertical", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/vertical/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.desktop.properties.vertical.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err195];
                                } else {
                                  vErrors.push(err195);
                                }
                                errors++;
                              }
                            }
                            if (data71.textAlign !== void 0) {
                              let data80 = data71.textAlign;
                              if (!(data80 === "left" || data80 === "center" || data80 === "right" || data80 === "justify")) {
                                const err196 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/textAlign", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/textAlign/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.desktop.properties.textAlign.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err196];
                                } else {
                                  vErrors.push(err196);
                                }
                                errors++;
                              }
                            }
                            if (data71.autoAlign !== void 0) {
                              if (typeof data71.autoAlign !== "boolean") {
                                const err197 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop/autoAlign", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/properties/autoAlign/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                                if (vErrors === null) {
                                  vErrors = [err197];
                                } else {
                                  vErrors.push(err197);
                                }
                                errors++;
                              }
                            }
                          } else {
                            const err198 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/desktop", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/desktop/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err198];
                            } else {
                              vErrors.push(err198);
                            }
                            errors++;
                          }
                        }
                        if (data70.tablet !== void 0) {
                          let data82 = data70.tablet;
                          if (data82 && typeof data82 == "object" && !Array.isArray(data82)) {
                            for (const key13 in data82) {
                              if (!func12.call(schema11.properties.pages.items.properties.sections.items.properties.layout.properties.tablet.properties, key13)) {
                                const err199 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key13 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err199];
                                } else {
                                  vErrors.push(err199);
                                }
                                errors++;
                              }
                            }
                            if (data82.display !== void 0) {
                              let data83 = data82.display;
                              if (!(data83 === "stack" || data83 === "grid" || data83 === "flex")) {
                                const err200 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/display", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/display/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.tablet.properties.display.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err200];
                                } else {
                                  vErrors.push(err200);
                                }
                                errors++;
                              }
                            }
                            if (data82.columns !== void 0) {
                              let data84 = data82.columns;
                              if (!(typeof data84 == "number" && (!(data84 % 1) && !isNaN(data84)) && isFinite(data84))) {
                                const err201 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/columns", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/columns/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err201];
                                } else {
                                  vErrors.push(err201);
                                }
                                errors++;
                              }
                              if (typeof data84 == "number" && isFinite(data84)) {
                                if (data84 > 4 || isNaN(data84)) {
                                  const err202 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/columns", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/columns/maximum", keyword: "maximum", params: { comparison: "<=", limit: 4 }, message: "must be <= 4" };
                                  if (vErrors === null) {
                                    vErrors = [err202];
                                  } else {
                                    vErrors.push(err202);
                                  }
                                  errors++;
                                }
                                if (data84 < 1 || isNaN(data84)) {
                                  const err203 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/columns", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/columns/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                  if (vErrors === null) {
                                    vErrors = [err203];
                                  } else {
                                    vErrors.push(err203);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data82.gap !== void 0) {
                              let data85 = data82.gap;
                              if (!(typeof data85 == "number" && (!(data85 % 1) && !isNaN(data85)) && isFinite(data85))) {
                                const err204 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/gap", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/gap/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err204];
                                } else {
                                  vErrors.push(err204);
                                }
                                errors++;
                              }
                              if (typeof data85 == "number" && isFinite(data85)) {
                                if (data85 > 160 || isNaN(data85)) {
                                  const err205 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/gap", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/gap/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                                  if (vErrors === null) {
                                    vErrors = [err205];
                                  } else {
                                    vErrors.push(err205);
                                  }
                                  errors++;
                                }
                                if (data85 < 0 || isNaN(data85)) {
                                  const err206 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/gap", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/gap/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err206];
                                  } else {
                                    vErrors.push(err206);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data82.padding !== void 0) {
                              let data86 = data82.padding;
                              if (!(typeof data86 == "number" && (!(data86 % 1) && !isNaN(data86)) && isFinite(data86))) {
                                const err207 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/padding", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/padding/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err207];
                                } else {
                                  vErrors.push(err207);
                                }
                                errors++;
                              }
                              if (typeof data86 == "number" && isFinite(data86)) {
                                if (data86 > 160 || isNaN(data86)) {
                                  const err208 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/padding", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/padding/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                                  if (vErrors === null) {
                                    vErrors = [err208];
                                  } else {
                                    vErrors.push(err208);
                                  }
                                  errors++;
                                }
                                if (data86 < 0 || isNaN(data86)) {
                                  const err209 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/padding", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/padding/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err209];
                                  } else {
                                    vErrors.push(err209);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data82.margin !== void 0) {
                              let data87 = data82.margin;
                              if (!(typeof data87 == "number" && (!(data87 % 1) && !isNaN(data87)) && isFinite(data87))) {
                                const err210 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/margin", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/margin/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err210];
                                } else {
                                  vErrors.push(err210);
                                }
                                errors++;
                              }
                              if (typeof data87 == "number" && isFinite(data87)) {
                                if (data87 > 160 || isNaN(data87)) {
                                  const err211 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/margin", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/margin/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                                  if (vErrors === null) {
                                    vErrors = [err211];
                                  } else {
                                    vErrors.push(err211);
                                  }
                                  errors++;
                                }
                                if (data87 < 0 || isNaN(data87)) {
                                  const err212 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/margin", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/margin/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err212];
                                  } else {
                                    vErrors.push(err212);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data82.maxWidth !== void 0) {
                              let data88 = data82.maxWidth;
                              if (!(typeof data88 == "number" && (!(data88 % 1) && !isNaN(data88)) && isFinite(data88))) {
                                const err213 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/maxWidth", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/maxWidth/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err213];
                                } else {
                                  vErrors.push(err213);
                                }
                                errors++;
                              }
                              if (typeof data88 == "number" && isFinite(data88)) {
                                if (data88 > 1920 || isNaN(data88)) {
                                  const err214 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/maxWidth", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/maxWidth/maximum", keyword: "maximum", params: { comparison: "<=", limit: 1920 }, message: "must be <= 1920" };
                                  if (vErrors === null) {
                                    vErrors = [err214];
                                  } else {
                                    vErrors.push(err214);
                                  }
                                  errors++;
                                }
                                if (data88 < 320 || isNaN(data88)) {
                                  const err215 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/maxWidth", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/maxWidth/minimum", keyword: "minimum", params: { comparison: ">=", limit: 320 }, message: "must be >= 320" };
                                  if (vErrors === null) {
                                    vErrors = [err215];
                                  } else {
                                    vErrors.push(err215);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data82.align !== void 0) {
                              let data89 = data82.align;
                              if (!(data89 === "left" || data89 === "center" || data89 === "right" || data89 === "stretch")) {
                                const err216 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/align", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/align/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.tablet.properties.align.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err216];
                                } else {
                                  vErrors.push(err216);
                                }
                                errors++;
                              }
                            }
                            if (data82.vertical !== void 0) {
                              let data90 = data82.vertical;
                              if (!(data90 === "start" || data90 === "center" || data90 === "end")) {
                                const err217 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/vertical", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/vertical/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.tablet.properties.vertical.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err217];
                                } else {
                                  vErrors.push(err217);
                                }
                                errors++;
                              }
                            }
                            if (data82.textAlign !== void 0) {
                              let data91 = data82.textAlign;
                              if (!(data91 === "left" || data91 === "center" || data91 === "right" || data91 === "justify")) {
                                const err218 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/textAlign", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/textAlign/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.tablet.properties.textAlign.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err218];
                                } else {
                                  vErrors.push(err218);
                                }
                                errors++;
                              }
                            }
                            if (data82.autoAlign !== void 0) {
                              if (typeof data82.autoAlign !== "boolean") {
                                const err219 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet/autoAlign", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/properties/autoAlign/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                                if (vErrors === null) {
                                  vErrors = [err219];
                                } else {
                                  vErrors.push(err219);
                                }
                                errors++;
                              }
                            }
                          } else {
                            const err220 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/tablet", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/tablet/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err220];
                            } else {
                              vErrors.push(err220);
                            }
                            errors++;
                          }
                        }
                        if (data70.mobile !== void 0) {
                          let data93 = data70.mobile;
                          if (data93 && typeof data93 == "object" && !Array.isArray(data93)) {
                            for (const key14 in data93) {
                              if (!func12.call(schema11.properties.pages.items.properties.sections.items.properties.layout.properties.mobile.properties, key14)) {
                                const err221 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key14 }, message: "must NOT have additional properties" };
                                if (vErrors === null) {
                                  vErrors = [err221];
                                } else {
                                  vErrors.push(err221);
                                }
                                errors++;
                              }
                            }
                            if (data93.display !== void 0) {
                              let data94 = data93.display;
                              if (!(data94 === "stack" || data94 === "grid" || data94 === "flex")) {
                                const err222 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/display", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/display/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.mobile.properties.display.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err222];
                                } else {
                                  vErrors.push(err222);
                                }
                                errors++;
                              }
                            }
                            if (data93.columns !== void 0) {
                              let data95 = data93.columns;
                              if (!(typeof data95 == "number" && (!(data95 % 1) && !isNaN(data95)) && isFinite(data95))) {
                                const err223 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/columns", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/columns/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err223];
                                } else {
                                  vErrors.push(err223);
                                }
                                errors++;
                              }
                              if (typeof data95 == "number" && isFinite(data95)) {
                                if (data95 > 4 || isNaN(data95)) {
                                  const err224 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/columns", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/columns/maximum", keyword: "maximum", params: { comparison: "<=", limit: 4 }, message: "must be <= 4" };
                                  if (vErrors === null) {
                                    vErrors = [err224];
                                  } else {
                                    vErrors.push(err224);
                                  }
                                  errors++;
                                }
                                if (data95 < 1 || isNaN(data95)) {
                                  const err225 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/columns", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/columns/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                                  if (vErrors === null) {
                                    vErrors = [err225];
                                  } else {
                                    vErrors.push(err225);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data93.gap !== void 0) {
                              let data96 = data93.gap;
                              if (!(typeof data96 == "number" && (!(data96 % 1) && !isNaN(data96)) && isFinite(data96))) {
                                const err226 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/gap", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/gap/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err226];
                                } else {
                                  vErrors.push(err226);
                                }
                                errors++;
                              }
                              if (typeof data96 == "number" && isFinite(data96)) {
                                if (data96 > 160 || isNaN(data96)) {
                                  const err227 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/gap", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/gap/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                                  if (vErrors === null) {
                                    vErrors = [err227];
                                  } else {
                                    vErrors.push(err227);
                                  }
                                  errors++;
                                }
                                if (data96 < 0 || isNaN(data96)) {
                                  const err228 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/gap", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/gap/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err228];
                                  } else {
                                    vErrors.push(err228);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data93.padding !== void 0) {
                              let data97 = data93.padding;
                              if (!(typeof data97 == "number" && (!(data97 % 1) && !isNaN(data97)) && isFinite(data97))) {
                                const err229 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/padding", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/padding/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err229];
                                } else {
                                  vErrors.push(err229);
                                }
                                errors++;
                              }
                              if (typeof data97 == "number" && isFinite(data97)) {
                                if (data97 > 160 || isNaN(data97)) {
                                  const err230 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/padding", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/padding/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                                  if (vErrors === null) {
                                    vErrors = [err230];
                                  } else {
                                    vErrors.push(err230);
                                  }
                                  errors++;
                                }
                                if (data97 < 0 || isNaN(data97)) {
                                  const err231 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/padding", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/padding/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err231];
                                  } else {
                                    vErrors.push(err231);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data93.margin !== void 0) {
                              let data98 = data93.margin;
                              if (!(typeof data98 == "number" && (!(data98 % 1) && !isNaN(data98)) && isFinite(data98))) {
                                const err232 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/margin", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/margin/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err232];
                                } else {
                                  vErrors.push(err232);
                                }
                                errors++;
                              }
                              if (typeof data98 == "number" && isFinite(data98)) {
                                if (data98 > 160 || isNaN(data98)) {
                                  const err233 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/margin", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/margin/maximum", keyword: "maximum", params: { comparison: "<=", limit: 160 }, message: "must be <= 160" };
                                  if (vErrors === null) {
                                    vErrors = [err233];
                                  } else {
                                    vErrors.push(err233);
                                  }
                                  errors++;
                                }
                                if (data98 < 0 || isNaN(data98)) {
                                  const err234 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/margin", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/margin/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                                  if (vErrors === null) {
                                    vErrors = [err234];
                                  } else {
                                    vErrors.push(err234);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data93.maxWidth !== void 0) {
                              let data99 = data93.maxWidth;
                              if (!(typeof data99 == "number" && (!(data99 % 1) && !isNaN(data99)) && isFinite(data99))) {
                                const err235 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/maxWidth", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/maxWidth/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                                if (vErrors === null) {
                                  vErrors = [err235];
                                } else {
                                  vErrors.push(err235);
                                }
                                errors++;
                              }
                              if (typeof data99 == "number" && isFinite(data99)) {
                                if (data99 > 1920 || isNaN(data99)) {
                                  const err236 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/maxWidth", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/maxWidth/maximum", keyword: "maximum", params: { comparison: "<=", limit: 1920 }, message: "must be <= 1920" };
                                  if (vErrors === null) {
                                    vErrors = [err236];
                                  } else {
                                    vErrors.push(err236);
                                  }
                                  errors++;
                                }
                                if (data99 < 320 || isNaN(data99)) {
                                  const err237 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/maxWidth", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/maxWidth/minimum", keyword: "minimum", params: { comparison: ">=", limit: 320 }, message: "must be >= 320" };
                                  if (vErrors === null) {
                                    vErrors = [err237];
                                  } else {
                                    vErrors.push(err237);
                                  }
                                  errors++;
                                }
                              }
                            }
                            if (data93.align !== void 0) {
                              let data100 = data93.align;
                              if (!(data100 === "left" || data100 === "center" || data100 === "right" || data100 === "stretch")) {
                                const err238 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/align", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/align/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.mobile.properties.align.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err238];
                                } else {
                                  vErrors.push(err238);
                                }
                                errors++;
                              }
                            }
                            if (data93.vertical !== void 0) {
                              let data101 = data93.vertical;
                              if (!(data101 === "start" || data101 === "center" || data101 === "end")) {
                                const err239 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/vertical", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/vertical/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.mobile.properties.vertical.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err239];
                                } else {
                                  vErrors.push(err239);
                                }
                                errors++;
                              }
                            }
                            if (data93.textAlign !== void 0) {
                              let data102 = data93.textAlign;
                              if (!(data102 === "left" || data102 === "center" || data102 === "right" || data102 === "justify")) {
                                const err240 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/textAlign", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/textAlign/enum", keyword: "enum", params: { allowedValues: schema11.properties.pages.items.properties.sections.items.properties.layout.properties.mobile.properties.textAlign.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                  vErrors = [err240];
                                } else {
                                  vErrors.push(err240);
                                }
                                errors++;
                              }
                            }
                            if (data93.autoAlign !== void 0) {
                              if (typeof data93.autoAlign !== "boolean") {
                                const err241 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile/autoAlign", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/properties/autoAlign/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                                if (vErrors === null) {
                                  vErrors = [err241];
                                } else {
                                  vErrors.push(err241);
                                }
                                errors++;
                              }
                            }
                          } else {
                            const err242 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout/mobile", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/properties/mobile/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                            if (vErrors === null) {
                              vErrors = [err242];
                            } else {
                              vErrors.push(err242);
                            }
                            errors++;
                          }
                        }
                      } else {
                        const err243 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3 + "/layout", schemaPath: "#/properties/pages/items/properties/sections/items/properties/layout/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err243];
                        } else {
                          vErrors.push(err243);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err244 = { instancePath: instancePath + "/pages/" + i2 + "/sections/" + i3, schemaPath: "#/properties/pages/items/properties/sections/items/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err244];
                    } else {
                      vErrors.push(err244);
                    }
                    errors++;
                  }
                }
              } else {
                const err245 = { instancePath: instancePath + "/pages/" + i2 + "/sections", schemaPath: "#/properties/pages/items/properties/sections/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                if (vErrors === null) {
                  vErrors = [err245];
                } else {
                  vErrors.push(err245);
                }
                errors++;
              }
            }
          } else {
            const err246 = { instancePath: instancePath + "/pages/" + i2, schemaPath: "#/properties/pages/items/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err246];
            } else {
              vErrors.push(err246);
            }
            errors++;
          }
        }
      } else {
        const err247 = { instancePath: instancePath + "/pages", schemaPath: "#/properties/pages/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err247];
        } else {
          vErrors.push(err247);
        }
        errors++;
      }
    }
    if (data.dictionaries !== void 0) {
      let data104 = data.dictionaries;
      if (Array.isArray(data104)) {
        if (data104.length > 30) {
          const err248 = { instancePath: instancePath + "/dictionaries", schemaPath: "#/properties/dictionaries/maxItems", keyword: "maxItems", params: { limit: 30 }, message: "must NOT have more than 30 items" };
          if (vErrors === null) {
            vErrors = [err248];
          } else {
            vErrors.push(err248);
          }
          errors++;
        }
        const len4 = data104.length;
        for (let i5 = 0; i5 < len4; i5++) {
          let data105 = data104[i5];
          if (data105 && typeof data105 == "object" && !Array.isArray(data105)) {
            if (data105.id === void 0) {
              const err249 = { instancePath: instancePath + "/dictionaries/" + i5, schemaPath: "#/properties/dictionaries/items/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
              if (vErrors === null) {
                vErrors = [err249];
              } else {
                vErrors.push(err249);
              }
              errors++;
            }
            if (data105.version === void 0) {
              const err250 = { instancePath: instancePath + "/dictionaries/" + i5, schemaPath: "#/properties/dictionaries/items/required", keyword: "required", params: { missingProperty: "version" }, message: "must have required property 'version'" };
              if (vErrors === null) {
                vErrors = [err250];
              } else {
                vErrors.push(err250);
              }
              errors++;
            }
            if (data105.mode === void 0) {
              const err251 = { instancePath: instancePath + "/dictionaries/" + i5, schemaPath: "#/properties/dictionaries/items/required", keyword: "required", params: { missingProperty: "mode" }, message: "must have required property 'mode'" };
              if (vErrors === null) {
                vErrors = [err251];
              } else {
                vErrors.push(err251);
              }
              errors++;
            }
            if (data105.entries === void 0) {
              const err252 = { instancePath: instancePath + "/dictionaries/" + i5, schemaPath: "#/properties/dictionaries/items/required", keyword: "required", params: { missingProperty: "entries" }, message: "must have required property 'entries'" };
              if (vErrors === null) {
                vErrors = [err252];
              } else {
                vErrors.push(err252);
              }
              errors++;
            }
            for (const key15 in data105) {
              if (!(key15 === "id" || key15 === "version" || key15 === "mode" || key15 === "entries")) {
                const err253 = { instancePath: instancePath + "/dictionaries/" + i5, schemaPath: "#/properties/dictionaries/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key15 }, message: "must NOT have additional properties" };
                if (vErrors === null) {
                  vErrors = [err253];
                } else {
                  vErrors.push(err253);
                }
                errors++;
              }
            }
            if (data105.id !== void 0) {
              let data106 = data105.id;
              if (typeof data106 === "string") {
                if (!pattern2.test(data106)) {
                  const err254 = { instancePath: instancePath + "/dictionaries/" + i5 + "/id", schemaPath: "#/properties/dictionaries/items/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, message: 'must match pattern "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$"' };
                  if (vErrors === null) {
                    vErrors = [err254];
                  } else {
                    vErrors.push(err254);
                  }
                  errors++;
                }
              } else {
                const err255 = { instancePath: instancePath + "/dictionaries/" + i5 + "/id", schemaPath: "#/properties/dictionaries/items/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err255];
                } else {
                  vErrors.push(err255);
                }
                errors++;
              }
            }
            if (data105.version !== void 0) {
              let data107 = data105.version;
              if (!(typeof data107 == "number" && (!(data107 % 1) && !isNaN(data107)) && isFinite(data107))) {
                const err256 = { instancePath: instancePath + "/dictionaries/" + i5 + "/version", schemaPath: "#/properties/dictionaries/items/properties/version/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
                if (vErrors === null) {
                  vErrors = [err256];
                } else {
                  vErrors.push(err256);
                }
                errors++;
              }
              if (typeof data107 == "number" && isFinite(data107)) {
                if (data107 > 2147483647 || isNaN(data107)) {
                  const err257 = { instancePath: instancePath + "/dictionaries/" + i5 + "/version", schemaPath: "#/properties/dictionaries/items/properties/version/maximum", keyword: "maximum", params: { comparison: "<=", limit: 2147483647 }, message: "must be <= 2147483647" };
                  if (vErrors === null) {
                    vErrors = [err257];
                  } else {
                    vErrors.push(err257);
                  }
                  errors++;
                }
                if (data107 < 1 || isNaN(data107)) {
                  const err258 = { instancePath: instancePath + "/dictionaries/" + i5 + "/version", schemaPath: "#/properties/dictionaries/items/properties/version/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
                  if (vErrors === null) {
                    vErrors = [err258];
                  } else {
                    vErrors.push(err258);
                  }
                  errors++;
                }
              }
            }
            if (data105.mode !== void 0) {
              let data108 = data105.mode;
              if (!(data108 === "strict" || data108 === "suggest")) {
                const err259 = { instancePath: instancePath + "/dictionaries/" + i5 + "/mode", schemaPath: "#/properties/dictionaries/items/properties/mode/enum", keyword: "enum", params: { allowedValues: schema11.properties.dictionaries.items.properties.mode.enum }, message: "must be equal to one of the allowed values" };
                if (vErrors === null) {
                  vErrors = [err259];
                } else {
                  vErrors.push(err259);
                }
                errors++;
              }
            }
            if (data105.entries !== void 0) {
              let data109 = data105.entries;
              if (Array.isArray(data109)) {
                if (data109.length > 500) {
                  const err260 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries", schemaPath: "#/properties/dictionaries/items/properties/entries/maxItems", keyword: "maxItems", params: { limit: 500 }, message: "must NOT have more than 500 items" };
                  if (vErrors === null) {
                    vErrors = [err260];
                  } else {
                    vErrors.push(err260);
                  }
                  errors++;
                }
                const len5 = data109.length;
                for (let i6 = 0; i6 < len5; i6++) {
                  let data110 = data109[i6];
                  if (data110 && typeof data110 == "object" && !Array.isArray(data110)) {
                    if (data110.id === void 0) {
                      const err261 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6, schemaPath: "#/properties/dictionaries/items/properties/entries/items/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
                      if (vErrors === null) {
                        vErrors = [err261];
                      } else {
                        vErrors.push(err261);
                      }
                      errors++;
                    }
                    if (data110.labels === void 0) {
                      const err262 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6, schemaPath: "#/properties/dictionaries/items/properties/entries/items/required", keyword: "required", params: { missingProperty: "labels" }, message: "must have required property 'labels'" };
                      if (vErrors === null) {
                        vErrors = [err262];
                      } else {
                        vErrors.push(err262);
                      }
                      errors++;
                    }
                    if (data110.active === void 0) {
                      const err263 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6, schemaPath: "#/properties/dictionaries/items/properties/entries/items/required", keyword: "required", params: { missingProperty: "active" }, message: "must have required property 'active'" };
                      if (vErrors === null) {
                        vErrors = [err263];
                      } else {
                        vErrors.push(err263);
                      }
                      errors++;
                    }
                    if (data110.aliases === void 0) {
                      const err264 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6, schemaPath: "#/properties/dictionaries/items/properties/entries/items/required", keyword: "required", params: { missingProperty: "aliases" }, message: "must have required property 'aliases'" };
                      if (vErrors === null) {
                        vErrors = [err264];
                      } else {
                        vErrors.push(err264);
                      }
                      errors++;
                    }
                    for (const key16 in data110) {
                      if (!(key16 === "id" || key16 === "labels" || key16 === "active" || key16 === "aliases")) {
                        const err265 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6, schemaPath: "#/properties/dictionaries/items/properties/entries/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key16 }, message: "must NOT have additional properties" };
                        if (vErrors === null) {
                          vErrors = [err265];
                        } else {
                          vErrors.push(err265);
                        }
                        errors++;
                      }
                    }
                    if (data110.id !== void 0) {
                      let data111 = data110.id;
                      if (typeof data111 === "string") {
                        if (!pattern2.test(data111)) {
                          const err266 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/id", schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/id/pattern", keyword: "pattern", params: { pattern: "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$" }, message: 'must match pattern "^[a-zA-Z][a-zA-Z0-9_-]{0,79}$"' };
                          if (vErrors === null) {
                            vErrors = [err266];
                          } else {
                            vErrors.push(err266);
                          }
                          errors++;
                        }
                      } else {
                        const err267 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/id", schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                          vErrors = [err267];
                        } else {
                          vErrors.push(err267);
                        }
                        errors++;
                      }
                    }
                    if (data110.labels !== void 0) {
                      let data112 = data110.labels;
                      if (data112 && typeof data112 == "object" && !Array.isArray(data112)) {
                        if (Object.keys(data112).length > 30) {
                          const err268 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/labels", schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/labels/maxProperties", keyword: "maxProperties", params: { limit: 30 }, message: "must NOT have more than 30 properties" };
                          if (vErrors === null) {
                            vErrors = [err268];
                          } else {
                            vErrors.push(err268);
                          }
                          errors++;
                        }
                        for (const key17 in data112) {
                          const _errs214 = errors;
                          if (typeof key17 === "string") {
                            if (!pattern0.test(key17)) {
                              const err269 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/labels", schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/labels/propertyNames/pattern", keyword: "pattern", params: { pattern: "^[a-z]{2,3}(-[A-Z]{2})?$" }, message: 'must match pattern "^[a-z]{2,3}(-[A-Z]{2})?$"', propertyName: key17 };
                              if (vErrors === null) {
                                vErrors = [err269];
                              } else {
                                vErrors.push(err269);
                              }
                              errors++;
                            }
                          }
                          var valid30 = _errs214 === errors;
                          if (!valid30) {
                            const err270 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/labels", schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/labels/propertyNames", keyword: "propertyNames", params: { propertyName: key17 }, message: "property name must be valid" };
                            if (vErrors === null) {
                              vErrors = [err270];
                            } else {
                              vErrors.push(err270);
                            }
                            errors++;
                          }
                        }
                        for (const key18 in data112) {
                          let data113 = data112[key18];
                          if (typeof data113 === "string") {
                            if (func2(data113) > 12e3) {
                              const err271 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/labels/" + key18.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/labels/additionalProperties/maxLength", keyword: "maxLength", params: { limit: 12e3 }, message: "must NOT have more than 12000 characters" };
                              if (vErrors === null) {
                                vErrors = [err271];
                              } else {
                                vErrors.push(err271);
                              }
                              errors++;
                            }
                            if (func2(data113) < 0) {
                              const err272 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/labels/" + key18.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/labels/additionalProperties/minLength", keyword: "minLength", params: { limit: 0 }, message: "must NOT have fewer than 0 characters" };
                              if (vErrors === null) {
                                vErrors = [err272];
                              } else {
                                vErrors.push(err272);
                              }
                              errors++;
                            }
                          } else {
                            const err273 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/labels/" + key18.replace(/~/g, "~0").replace(/\//g, "~1"), schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/labels/additionalProperties/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err273];
                            } else {
                              vErrors.push(err273);
                            }
                            errors++;
                          }
                        }
                      } else {
                        const err274 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/labels", schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/labels/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                        if (vErrors === null) {
                          vErrors = [err274];
                        } else {
                          vErrors.push(err274);
                        }
                        errors++;
                      }
                    }
                    if (data110.active !== void 0) {
                      if (typeof data110.active !== "boolean") {
                        const err275 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/active", schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/active/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
                        if (vErrors === null) {
                          vErrors = [err275];
                        } else {
                          vErrors.push(err275);
                        }
                        errors++;
                      }
                    }
                    if (data110.aliases !== void 0) {
                      let data115 = data110.aliases;
                      if (Array.isArray(data115)) {
                        if (data115.length > 30) {
                          const err276 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/aliases", schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/aliases/maxItems", keyword: "maxItems", params: { limit: 30 }, message: "must NOT have more than 30 items" };
                          if (vErrors === null) {
                            vErrors = [err276];
                          } else {
                            vErrors.push(err276);
                          }
                          errors++;
                        }
                        const len6 = data115.length;
                        for (let i7 = 0; i7 < len6; i7++) {
                          let data116 = data115[i7];
                          if (typeof data116 === "string") {
                            if (func2(data116) > 120) {
                              const err277 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/aliases/" + i7, schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/aliases/items/maxLength", keyword: "maxLength", params: { limit: 120 }, message: "must NOT have more than 120 characters" };
                              if (vErrors === null) {
                                vErrors = [err277];
                              } else {
                                vErrors.push(err277);
                              }
                              errors++;
                            }
                            if (func2(data116) < 1) {
                              const err278 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/aliases/" + i7, schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/aliases/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                              if (vErrors === null) {
                                vErrors = [err278];
                              } else {
                                vErrors.push(err278);
                              }
                              errors++;
                            }
                          } else {
                            const err279 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/aliases/" + i7, schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/aliases/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                              vErrors = [err279];
                            } else {
                              vErrors.push(err279);
                            }
                            errors++;
                          }
                        }
                        let i8 = data115.length;
                        let j1;
                        if (i8 > 1) {
                          const indices1 = {};
                          for (; i8--; ) {
                            let item1 = data115[i8];
                            if (typeof item1 !== "string") {
                              continue;
                            }
                            if (typeof indices1[item1] == "number") {
                              j1 = indices1[item1];
                              const err280 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/aliases", schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/aliases/uniqueItems", keyword: "uniqueItems", params: { i: i8, j: j1 }, message: "must NOT have duplicate items (items ## " + j1 + " and " + i8 + " are identical)" };
                              if (vErrors === null) {
                                vErrors = [err280];
                              } else {
                                vErrors.push(err280);
                              }
                              errors++;
                              break;
                            }
                            indices1[item1] = i8;
                          }
                        }
                      } else {
                        const err281 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6 + "/aliases", schemaPath: "#/properties/dictionaries/items/properties/entries/items/properties/aliases/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                        if (vErrors === null) {
                          vErrors = [err281];
                        } else {
                          vErrors.push(err281);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err282 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries/" + i6, schemaPath: "#/properties/dictionaries/items/properties/entries/items/type", keyword: "type", params: { type: "object" }, message: "must be object" };
                    if (vErrors === null) {
                      vErrors = [err282];
                    } else {
                      vErrors.push(err282);
                    }
                    errors++;
                  }
                }
              } else {
                const err283 = { instancePath: instancePath + "/dictionaries/" + i5 + "/entries", schemaPath: "#/properties/dictionaries/items/properties/entries/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                if (vErrors === null) {
                  vErrors = [err283];
                } else {
                  vErrors.push(err283);
                }
                errors++;
              }
            }
          } else {
            const err284 = { instancePath: instancePath + "/dictionaries/" + i5, schemaPath: "#/properties/dictionaries/items/type", keyword: "type", params: { type: "object" }, message: "must be object" };
            if (vErrors === null) {
              vErrors = [err284];
            } else {
              vErrors.push(err284);
            }
            errors++;
          }
        }
      } else {
        const err285 = { instancePath: instancePath + "/dictionaries", schemaPath: "#/properties/dictionaries/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err285];
        } else {
          vErrors.push(err285);
        }
        errors++;
      }
    }
  } else {
    const err286 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err286];
    } else {
      vErrors.push(err286);
    }
    errors++;
  }
  validate10.errors = vErrors;
  return errors === 0;
}
export {
  stdin_default as default,
  validate
};
