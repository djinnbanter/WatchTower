package dev.mcstatus.watchtower.core.config;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import org.tomlj.Toml;
import org.tomlj.TomlArray;
import org.tomlj.TomlParseError;
import org.tomlj.TomlParseResult;
import org.tomlj.TomlTable;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parse TOML into a form field tree and clean-rewrite serialize.
 * Loader-free — uses TomlJ (shaded at runtime in the core jar).
 */
public final class TomlFormModel {

    private static final Pattern KEY_LINE = Pattern.compile(
            "^\\s*([A-Za-z0-9_.-]+)\\s*=.*$");

    private TomlFormModel() {
    }

    public record ParseResult(boolean formOk, JsonArray fields, List<String> warnings) {
    }

    public static ParseResult parse(String tomlText) {
        List<String> warnings = new ArrayList<>();
        if (tomlText == null) {
            warnings.add("empty");
            return new ParseResult(false, new JsonArray(), warnings);
        }
        TomlParseResult result = Toml.parse(tomlText);
        if (result.hasErrors()) {
            for (TomlParseError err : result.errors()) {
                warnings.add(err.toString());
            }
            return new ParseResult(false, new JsonArray(), warnings);
        }
        Map<String, String> hints = extractHints(tomlText);
        try {
            JsonArray fields = new JsonArray();
            walkTable(result, "", "", fields, hints);
            return new ParseResult(true, fields, warnings);
        } catch (UnsupportedStructureException e) {
            warnings.add(e.getMessage() != null ? e.getMessage() : "unsupported_structure");
            return new ParseResult(false, new JsonArray(), warnings);
        }
    }

    public static String serialize(JsonArray fields) {
        if (fields == null) {
            throw new IllegalArgumentException("fields required");
        }
        StringBuilder sb = new StringBuilder();
        sb.append("# WatchTower form rewrite\n");
        List<JsonObject> rootScalars = new ArrayList<>();
        List<JsonObject> tables = new ArrayList<>();
        for (JsonElement el : fields) {
            if (!el.isJsonObject()) {
                throw new IllegalArgumentException("invalid field");
            }
            JsonObject o = el.getAsJsonObject();
            String kind = o.get("kind").getAsString();
            if ("table".equals(kind)) {
                tables.add(o);
            } else {
                rootScalars.add(o);
            }
        }
        for (JsonObject leaf : rootScalars) {
            writeLeaf(sb, leaf, 0);
        }
        if (!rootScalars.isEmpty() && !tables.isEmpty()) {
            sb.append('\n');
        }
        for (int i = 0; i < tables.size(); i++) {
            if (i > 0) {
                sb.append('\n');
            }
            writeTable(sb, tables.get(i), tables.get(i).get("path").getAsString());
        }
        return sb.toString();
    }

    static Map<String, String> extractHints(String tomlText) {
        Map<String, String> hints = new LinkedHashMap<>();
        if (tomlText == null || tomlText.isBlank()) {
            return hints;
        }
        String[] lines = tomlText.split("\\R", -1);
        String currentTable = "";
        List<String> pending = new ArrayList<>();
        for (String raw : lines) {
            String trimmed = raw.trim();
            if (trimmed.startsWith("[")) {
                pending.clear();
                String inner = trimmed.replaceAll("^\\[+|]+$", "").trim();
                currentTable = inner;
                continue;
            }
            if (trimmed.startsWith("#")) {
                String body = trimmed.substring(1).trim();
                if (body.toLowerCase(Locale.ROOT).startsWith("default:")
                        || body.toLowerCase(Locale.ROOT).startsWith("range:")) {
                    pending.add(body);
                }
                continue;
            }
            if (trimmed.isEmpty()) {
                pending.clear();
                continue;
            }
            Matcher m = KEY_LINE.matcher(raw);
            if (m.matches()) {
                String key = m.group(1);
                String path = currentTable.isEmpty() ? key : currentTable + "." + key;
                if (!pending.isEmpty()) {
                    hints.put(path, String.join(" · ", pending));
                }
                pending.clear();
            } else {
                pending.clear();
            }
        }
        return hints;
    }

    private static void walkTable(
            TomlTable table,
            String sectionPath,
            String sectionKey,
            JsonArray out,
            Map<String, String> hints
    ) {
        for (String key : table.keySet()) {
            String dotted = sectionPath.isEmpty() ? key : sectionPath + "." + key;
            if (table.isTable(key)) {
                TomlTable child = table.getTable(key);
                JsonObject node = new JsonObject();
                node.addProperty("kind", "table");
                node.addProperty("key", key);
                node.addProperty("path", dotted);
                node.addProperty("section", sectionPath);
                JsonArray children = new JsonArray();
                walkTable(child, dotted, key, children, hints);
                node.add("children", children);
                out.add(node);
            } else if (table.isArray(key)) {
                TomlArray arr = table.getArray(key);
                if (arr.containsTables()) {
                    throw new UnsupportedStructureException("unsupported_structure: array of tables at " + dotted);
                }
                out.add(leaf(key, dotted, sectionPath, arrayToJson(arr), hints));
            } else if (table.isBoolean(key)) {
                out.add(leaf(key, dotted, sectionPath, new JsonPrimitive(Boolean.TRUE.equals(table.getBoolean(key))), hints));
            } else if (table.isLong(key)) {
                out.add(leaf(key, dotted, sectionPath, new JsonPrimitive(table.getLong(key)), "integer", hints));
            } else if (table.isDouble(key)) {
                out.add(leaf(key, dotted, sectionPath, new JsonPrimitive(table.getDouble(key)), "number", hints));
            } else if (table.isString(key)) {
                out.add(leaf(key, dotted, sectionPath, new JsonPrimitive(table.getString(key)), hints));
            } else {
                throw new UnsupportedStructureException("unsupported_structure: value at " + dotted);
            }
        }
    }

    private static JsonArray arrayToJson(TomlArray arr) {
        JsonArray out = new JsonArray();
        for (int i = 0; i < arr.size(); i++) {
            Object v = arr.get(i);
            if (v instanceof Boolean b) {
                out.add(b);
            } else if (v instanceof Long l) {
                out.add(l);
            } else if (v instanceof Integer n) {
                out.add(n.longValue());
            } else if (v instanceof Double d) {
                out.add(d);
            } else if (v instanceof Float f) {
                out.add(f.doubleValue());
            } else if (v instanceof String s) {
                out.add(s);
            } else if (v instanceof TomlArray nested) {
                if (nested.containsTables()) {
                    throw new UnsupportedStructureException("unsupported_structure: array of tables");
                }
                out.add(arrayToJson(nested));
            } else if (v instanceof TomlTable) {
                throw new UnsupportedStructureException("unsupported_structure: array of tables");
            } else {
                throw new UnsupportedStructureException("unsupported_structure: array element");
            }
        }
        return out;
    }

    private static JsonObject leaf(
            String key,
            String path,
            String section,
            JsonElement value,
            Map<String, String> hints
    ) {
        String kind;
        if (value.isJsonArray()) {
            kind = "array";
        } else if (value.isJsonPrimitive()) {
            JsonPrimitive p = value.getAsJsonPrimitive();
            if (p.isBoolean()) {
                kind = "bool";
            } else if (p.isNumber()) {
                kind = "number";
            } else {
                kind = "string";
            }
        } else {
            kind = "string";
        }
        return leaf(key, path, section, value, kind, hints);
    }

    private static JsonObject leaf(
            String key,
            String path,
            String section,
            JsonElement value,
            String kind,
            Map<String, String> hints
    ) {
        JsonObject node = new JsonObject();
        node.addProperty("kind", kind);
        node.addProperty("key", key);
        node.addProperty("path", path);
        node.addProperty("section", section != null ? section : "");
        node.add("value", value);
        String hint = hints.get(path);
        if (hint != null && !hint.isBlank()) {
            node.addProperty("hint", hint);
        }
        return node;
    }

    private static void writeTable(StringBuilder sb, JsonObject table, String dottedPath) {
        sb.append('[').append(dottedPath).append("]\n");
        JsonArray children = table.getAsJsonArray("children");
        if (children == null) {
            return;
        }
        List<JsonObject> nested = new ArrayList<>();
        for (JsonElement el : children) {
            JsonObject child = el.getAsJsonObject();
            if ("table".equals(child.get("kind").getAsString())) {
                nested.add(child);
            } else {
                writeLeaf(sb, child, 0);
            }
        }
        for (JsonObject n : nested) {
            sb.append('\n');
            writeTable(sb, n, n.get("path").getAsString());
        }
    }

    private static void writeLeaf(StringBuilder sb, JsonObject leaf, int indent) {
        String key = leaf.get("key").getAsString();
        sb.append("  ".repeat(Math.max(0, indent)));
        sb.append(key).append(" = ");
        appendValue(sb, leaf.get("value"));
        sb.append('\n');
    }

    private static void appendValue(StringBuilder sb, JsonElement value) {
        if (value == null || value.isJsonNull()) {
            sb.append("\"\"");
            return;
        }
        if (value.isJsonPrimitive()) {
            JsonPrimitive p = value.getAsJsonPrimitive();
            if (p.isBoolean()) {
                sb.append(p.getAsBoolean());
            } else if (p.isNumber()) {
                Number n = p.getAsNumber();
                if (n instanceof Double || n instanceof Float || p.getAsString().contains(".")) {
                    sb.append(p.getAsDouble());
                } else {
                    sb.append(p.getAsLong());
                }
            } else {
                sb.append('"').append(escapeToml(p.getAsString())).append('"');
            }
            return;
        }
        if (value.isJsonArray()) {
            sb.append('[');
            JsonArray arr = value.getAsJsonArray();
            for (int i = 0; i < arr.size(); i++) {
                if (i > 0) {
                    sb.append(", ");
                }
                appendValue(sb, arr.get(i));
            }
            sb.append(']');
            return;
        }
        throw new IllegalArgumentException("cannot serialize value");
    }

    private static String escapeToml(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static final class UnsupportedStructureException extends RuntimeException {
        UnsupportedStructureException(String message) {
            super(message);
        }
    }
}
