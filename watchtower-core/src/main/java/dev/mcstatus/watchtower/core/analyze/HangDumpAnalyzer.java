package dev.mcstatus.watchtower.core.analyze;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure hang-dump / phase classifier for soft-hang likely cause.
 * Hint-level only — never claims proven root cause.
 */
public final class HangDumpAnalyzer {

    public static final String NOTE_HINT = "Hint from the hang dump — not proof.";

    private static final Pattern THREAD_HEADER = Pattern.compile("^\"([^\"]+)\"", Pattern.MULTILINE);
    private static final Pattern FRAME = Pattern.compile(
            "^\\s+at\\s+([\\w.$]+)\\.([\\w$<>]+)\\(", Pattern.MULTILINE);

    private HangDumpAnalyzer() {
    }

    public record Result(
            String likelyCause,
            String likelyCauseSummary,
            String likelyCauseConfidence,
            String suspectMod,
            String suspectModNote
    ) {
    }

    /**
     * @param dumpText full hang dump or null/blank for phase-only
     * @param phase    soft_hang.phase hint
     */
    public static Result analyze(String dumpText, String phase) {
        if (dumpText == null || dumpText.isBlank()) {
            return phaseOnly(phase);
        }

        String serverStack = extractServerThreadStack(dumpText);
        if (serverStack == null || serverStack.isBlank()) {
            return phaseOnly(phase);
        }

        if (looksLikeDeadlock(dumpText)) {
            String suspect = findSuspect(serverStack);
            return result("deadlock", "medium", suspect);
        }

        String cause = classifyStack(serverStack);
        if (cause == null) {
            return phaseOnly(phase);
        }
        String suspect = findSuspect(serverStack);
        return result(cause, "medium", suspect);
    }

    private static Result phaseOnly(String phase) {
        String p = phase == null ? "" : phase.trim().toLowerCase(Locale.ROOT);
        String cause = switch (p) {
            case "saving" -> "saving";
            case "loading_world" -> "world_gen";
            case "ticking" -> "entity_tick";
            default -> "unknown";
        };
        return result(cause, "low", null);
    }

    private static Result result(String cause, String confidence, String suspect) {
        String note = suspect != null && !suspect.isBlank() ? NOTE_HINT : null;
        return new Result(cause, summaryFor(cause), confidence, blankToNull(suspect), note);
    }

    static String summaryFor(String cause) {
        return switch (cause == null ? "" : cause) {
            case "saving" -> "Looks stuck while saving the world";
            case "world_gen" -> "Looks stuck in world generation / chunk loading";
            case "entity_tick" -> "Looks stuck while ticking entities";
            case "network" -> "Looks stuck in network / connection handling";
            case "deadlock" -> "Possible thread deadlock (threads waiting on each other)";
            default -> "Freeze detected; stacks don’t match a clear pattern";
        };
    }

    private static String extractServerThreadStack(String dumpText) {
        Matcher headers = THREAD_HEADER.matcher(dumpText);
        int serverStart = -1;
        int serverEnd = dumpText.length();
        while (headers.find()) {
            String name = headers.group(1);
            if (serverStart < 0 && "Server thread".equals(name)) {
                serverStart = headers.start();
            } else if (serverStart >= 0) {
                serverEnd = headers.start();
                break;
            }
        }
        if (serverStart < 0) {
            return null;
        }
        return dumpText.substring(serverStart, serverEnd);
    }

    private static String classifyStack(String stack) {
        String lower = stack.toLowerCase(Locale.ROOT);
        int saving = 0;
        int worldGen = 0;
        int entity = 0;
        int network = 0;

        if (containsAny(lower, "chunkserializer", "fileio", "saveeverything", "chunkmap.save", ".save(")
                || lower.contains("filedispatcher")
                || (lower.contains("save") && (lower.contains("chunk") || lower.contains("level")))) {
            saving += 3;
        }
        if (containsAny(lower, "chunkgenerator", "world.level.chunk", "chunkstatus", "worldgen", "noisebasedchunkgenerator")) {
            worldGen += 3;
        }
        if (containsAny(lower, "entityticklist", "world.entity", "serverlevel.tick", "entity.tick")) {
            entity += 3;
        }
        if (containsAny(lower, "network.connection", "packetlistener", "servergamepacketlistener", "net.minecraft.network")) {
            network += 3;
        }

        int best = Math.max(Math.max(saving, worldGen), Math.max(entity, network));
        if (best <= 0) {
            return null;
        }
        if (saving == best) {
            return "saving";
        }
        if (worldGen == best) {
            return "world_gen";
        }
        if (entity == best) {
            return "entity_tick";
        }
        if (network == best) {
            return "network";
        }
        return null;
    }

    /**
     * Conservative: at least two BLOCKED threads that each wait on a lock the other holds.
     */
    private static boolean looksLikeDeadlock(String dumpText) {
        int blocked = 0;
        Matcher m = Pattern.compile("java\\.lang\\.Thread\\.State:\\s*BLOCKED", Pattern.CASE_INSENSITIVE)
                .matcher(dumpText);
        while (m.find()) {
            blocked++;
        }
        if (blocked < 2) {
            return false;
        }
        // Mutual wait markers often appear as waiting to lock / locked pairs
        int waitingToLock = countOccurrences(dumpText.toLowerCase(Locale.ROOT), "waiting to lock");
        int locked = countOccurrences(dumpText.toLowerCase(Locale.ROOT), "- locked");
        return waitingToLock >= 2 && locked >= 2;
    }

    private static String findSuspect(String serverStack) {
        Matcher frames = FRAME.matcher(serverStack);
        while (frames.find()) {
            String className = frames.group(1);
            if (isSkippedPackage(className)) {
                continue;
            }
            return shortLabel(className);
        }
        return null;
    }

    private static boolean isSkippedPackage(String className) {
        String p = className.toLowerCase(Locale.ROOT);
        return p.startsWith("java.")
                || p.startsWith("jdk.")
                || p.startsWith("sun.")
                || p.startsWith("javax.")
                || p.startsWith("net.minecraft")
                || p.startsWith("com.mojang")
                || p.startsWith("net.neoforged")
                || p.startsWith("cpw.mods")
                || p.startsWith("org.spongepowered");
    }

    private static String shortLabel(String className) {
        String[] parts = className.split("\\.");
        if (parts.length >= 2) {
            // com.example.laggy.ModTick → example (or example.laggy)
            if ("com".equals(parts[0]) || "org".equals(parts[0]) || "net".equals(parts[0])) {
                return parts.length >= 3 ? parts[1] : parts[1];
            }
            return parts[0];
        }
        return className;
    }

    private static boolean containsAny(String hay, String... needles) {
        for (String n : needles) {
            if (hay.contains(n)) {
                return true;
            }
        }
        return false;
    }

    private static int countOccurrences(String hay, String needle) {
        int count = 0;
        int idx = 0;
        while ((idx = hay.indexOf(needle, idx)) >= 0) {
            count++;
            idx += needle.length();
        }
        return count;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
