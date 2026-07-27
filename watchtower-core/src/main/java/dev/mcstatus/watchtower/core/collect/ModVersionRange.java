package dev.mcstatus.watchtower.core.collect;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses common Forge/NeoForge Maven-style version ranges from mods.toml
 * ({@code [1.0,)}, {@code (1.0,2.0]}, exact versions, comma-separated unions).
 */
public final class ModVersionRange {

    public enum Match {
        SATISFIED,
        NOT_SATISFIED,
        UNKNOWN
    }

    private static final Pattern BOUNDED = Pattern.compile(
            "^([\\[(])\\s*([^,\\]\\)]*)\\s*,\\s*([^,\\]\\)]*)\\s*([\\])])$");

    private final List<Constraint> constraints;
    private final boolean unparseable;

    private ModVersionRange(List<Constraint> constraints, boolean unparseable) {
        this.constraints = constraints;
        this.unparseable = unparseable;
    }

    public static ModVersionRange parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return new ModVersionRange(List.of(), true);
        }
        List<Constraint> parts = new ArrayList<>();
        for (String piece : splitUnion(raw.strip())) {
            Constraint c = parseOne(piece.strip());
            if (c == null) {
                return new ModVersionRange(List.of(), true);
            }
            parts.add(c);
        }
        if (parts.isEmpty()) {
            return new ModVersionRange(List.of(), true);
        }
        return new ModVersionRange(List.copyOf(parts), false);
    }

    public boolean unparseable() {
        return unparseable;
    }

    public Match contains(String version) {
        if (unparseable) {
            return Match.UNKNOWN;
        }
        if (version == null || version.isBlank() || "?".equals(version)) {
            return Match.UNKNOWN;
        }
        ComparableVersion installed = ComparableVersion.tryParse(version);
        if (installed == null) {
            return Match.UNKNOWN;
        }
        for (Constraint c : constraints) {
            Match m = c.matches(installed);
            if (m == Match.SATISFIED) {
                return Match.SATISFIED;
            }
            if (m == Match.UNKNOWN) {
                return Match.UNKNOWN;
            }
        }
        return Match.NOT_SATISFIED;
    }

    private static List<String> splitUnion(String raw) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        int depth = 0;
        for (int i = 0; i < raw.length(); i++) {
            char ch = raw.charAt(i);
            if (ch == '[' || ch == '(') {
                depth++;
                cur.append(ch);
            } else if (ch == ']' || ch == ')') {
                depth = Math.max(0, depth - 1);
                cur.append(ch);
            } else if (ch == ',' && depth == 0) {
                if (!cur.isEmpty()) {
                    out.add(cur.toString());
                    cur.setLength(0);
                }
            } else {
                cur.append(ch);
            }
        }
        if (!cur.isEmpty()) {
            out.add(cur.toString());
        }
        return out;
    }

    private static Constraint parseOne(String piece) {
        if (piece == null || piece.isBlank()) {
            return null;
        }
        Matcher m = BOUNDED.matcher(piece);
        if (m.matches()) {
            boolean lowerInclusive = "[".equals(m.group(1));
            boolean upperInclusive = "]".equals(m.group(4));
            String lowerRaw = m.group(2).strip();
            String upperRaw = m.group(3).strip();
            ComparableVersion lower = lowerRaw.isEmpty() ? null : ComparableVersion.tryParse(lowerRaw);
            ComparableVersion upper = upperRaw.isEmpty() ? null : ComparableVersion.tryParse(upperRaw);
            if ((!lowerRaw.isEmpty() && lower == null) || (!upperRaw.isEmpty() && upper == null)) {
                return null;
            }
            return new Bounded(lower, lowerInclusive, upper, upperInclusive);
        }
        ComparableVersion exact = ComparableVersion.tryParse(piece);
        if (exact == null) {
            return null;
        }
        return new Exact(exact);
    }

    private interface Constraint {
        Match matches(ComparableVersion version);
    }

    private record Exact(ComparableVersion version) implements Constraint {
        @Override
        public Match matches(ComparableVersion installed) {
            return installed.compareTo(version) == 0 ? Match.SATISFIED : Match.NOT_SATISFIED;
        }
    }

    private record Bounded(
            ComparableVersion lower,
            boolean lowerInclusive,
            ComparableVersion upper,
            boolean upperInclusive) implements Constraint {
        @Override
        public Match matches(ComparableVersion installed) {
            if (lower != null) {
                int cmp = installed.compareTo(lower);
                if (cmp < 0 || (cmp == 0 && !lowerInclusive)) {
                    return Match.NOT_SATISFIED;
                }
            }
            if (upper != null) {
                int cmp = installed.compareTo(upper);
                if (cmp > 0 || (cmp == 0 && !upperInclusive)) {
                    return Match.NOT_SATISFIED;
                }
            }
            return Match.SATISFIED;
        }
    }

    static final class ComparableVersion implements Comparable<ComparableVersion> {
        private final List<Object> parts;

        private ComparableVersion(List<Object> parts) {
            this.parts = parts;
        }

        static ComparableVersion tryParse(String raw) {
            if (raw == null || raw.isBlank()) {
                return null;
            }
            String s = raw.strip();
            if (s.isEmpty()) {
                return null;
            }
            List<Object> parts = new ArrayList<>();
            Matcher m = Pattern.compile("\\d+|\\p{Alpha}+").matcher(s.toLowerCase(Locale.ROOT));
            while (m.find()) {
                String tok = m.group();
                if (tok.chars().allMatch(Character::isDigit)) {
                    try {
                        parts.add(Long.parseLong(tok));
                    } catch (NumberFormatException e) {
                        parts.add(tok);
                    }
                } else {
                    parts.add(tok);
                }
            }
            if (parts.isEmpty()) {
                return null;
            }
            return new ComparableVersion(parts);
        }

        @Override
        public int compareTo(ComparableVersion o) {
            int n = Math.max(parts.size(), o.parts.size());
            for (int i = 0; i < n; i++) {
                Object a = i < parts.size() ? parts.get(i) : 0L;
                Object b = i < o.parts.size() ? o.parts.get(i) : 0L;
                if (a instanceof Long la && b instanceof Long lb) {
                    int c = Long.compare(la, lb);
                    if (c != 0) {
                        return c;
                    }
                } else {
                    int c = String.valueOf(a).compareTo(String.valueOf(b));
                    if (c != 0) {
                        return c;
                    }
                }
            }
            return 0;
        }
    }
}
