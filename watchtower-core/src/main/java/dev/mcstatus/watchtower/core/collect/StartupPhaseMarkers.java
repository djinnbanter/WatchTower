package dev.mcstatus.watchtower.core.collect;

import java.util.List;
import java.util.regex.Pattern;

/**
 * NeoForge boot phase anchors for {@link StartupProfileScanner}.
 */
public final class StartupPhaseMarkers {

    public record PhaseDef(String id, String label, Pattern pattern) {
    }

    public static final List<PhaseDef> PHASES = List.of(
            new PhaseDef("construct", "Mod construct",
                    Pattern.compile("ModLauncher starting|Launching target.*forgeserver|modloading-worker",
                            Pattern.CASE_INSENSITIVE)),
            new PhaseDef("registry_freeze", "Registry freeze",
                    Pattern.compile("Freezing registries|Registry freeze complete",
                            Pattern.CASE_INSENSITIVE)),
            new PhaseDef("common_setup", "Common setup",
                    Pattern.compile("Common setup|FMLCommonSetupEvent",
                            Pattern.CASE_INSENSITIVE)),
            new PhaseDef("datapack_load", "Datapack / loot load",
                    Pattern.compile("Couldn't parse element ResourceKey|Parsing error loading recipe|"
                            + "ReloadableServerResources|Loading datapacks",
                            Pattern.CASE_INSENSITIVE)),
            new PhaseDef("server_start", "Server start",
                    Pattern.compile("Starting Minecraft server on|Preparing start region",
                            Pattern.CASE_INSENSITIVE))
    );

    private StartupPhaseMarkers() {
    }

    public static PhaseDef match(String line) {
        if (line == null || line.isBlank()) {
            return null;
        }
        for (PhaseDef def : PHASES) {
            if (def.pattern().matcher(line).find()) {
                return def;
            }
        }
        return null;
    }
}
