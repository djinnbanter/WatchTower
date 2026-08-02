package dev.mcstatus.watchtower.core.analyze;

import java.util.List;
import java.util.Locale;

/**
 * GriefLogger × Create mounted-storage NPE signatures (FB-13).
 * Distinct from {@link DbAddonSignatures} (FB-11 MariaDB ACL / GLRA).
 */
public final class GriefLoggerCreateCompatSignatures {

    public static final String KIND = "grieflogger_create_compat";
    public static final String MOD_GRIEFLOGGER = "grieflogger";
    public static final String ISSUE_ID = "signal_gl_create_npe";

    public record Hit(String kind, String modId, String sampleLine) {
    }

    private GriefLoggerCreateCompatSignatures() {
    }

    /**
     * Match a single line or multi-line stack blob. Case-insensitive.
     * Requires ContainerHandler + menuProvider and Create contraption / mounted-storage evidence.
     */
    public static Hit match(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        boolean containerHandler = lower.contains("containerhandler");
        boolean menuProvider = lower.contains("menuprovider");
        boolean createEvidence = lower.contains("contraption_interact")
                || lower.contains("mounteditemstorage")
                || lower.contains("mountedstoragemanager")
                || lower.contains("mounted storage")
                || lower.contains("create.content.contraptions")
                || lower.contains("create:contraption");
        if (!(containerHandler && menuProvider && createEvidence)) {
            return null;
        }
        return new Hit(KIND, MOD_GRIEFLOGGER, sample(text));
    }

    /** Plain-English fix steps for Issues Live — advisory only. */
    public static List<String> fixSteps() {
        return List.of(
                "GriefLogger hit a null menuProvider while logging Create mounted-storage / contraption_interact — compat NPE, not a world crash.",
                "This is a FATAL task without a crash-report; the process usually keeps running.",
                "Update GriefLogger (and Create if needed), or disable GriefLogger container/interact logging until a fixed build — advisory only, no auto-change.");
    }

    private static String sample(String text) {
        String[] lines = text.split("\\R", -1);
        for (String line : lines) {
            String low = line.toLowerCase(Locale.ROOT);
            if (low.contains("containerhandler")
                    || low.contains("menuprovider")
                    || low.contains("contraption_interact")
                    || low.contains("mounteditemstorage")) {
                String s = line.strip();
                return s.length() > 240 ? s.substring(0, 240) : s;
            }
        }
        String s = text.strip();
        int nl = s.indexOf('\n');
        if (nl > 0) {
            s = s.substring(0, nl);
        }
        return s.length() > 240 ? s.substring(0, 240) : s;
    }
}
