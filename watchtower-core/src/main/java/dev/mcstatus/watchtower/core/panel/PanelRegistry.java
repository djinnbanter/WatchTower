package dev.mcstatus.watchtower.core.panel;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class PanelRegistry {

    private static final Set<String> FORCED_ONLY = Set.of("tcadmin", "wisp", "pebblehost");

    private final List<PanelDetector> autoDetectors;
    private final List<PanelDetector> allById;

    public PanelRegistry() {
        List<PanelDetector> detectors = new ArrayList<>();
        detectors.add(new CraftyDetector());
        detectors.add(new BloomDetector());
        detectors.add(new PterodactylDetector());
        detectors.add(new PelicanDetector());
        detectors.add(new PufferPanelDetector());
        detectors.add(new McsManagerDetector());
        detectors.add(new AmpDetector());
        detectors.add(new MulticraftDetector());
        detectors.add(new MineosDetector());
        detectors.add(new DiscoPanelDetector());
        detectors.add(new DockerDetector());
        detectors.add(new ForcedPanelDetector("tcadmin", "tcadmin", 50));
        detectors.add(new ForcedPanelDetector("wisp", "wisp", 50));
        detectors.add(new ForcedPanelDetector("pebblehost", "pebblehost", 50));
        detectors.add(new NativeFallbackDetector());

        detectors.sort(Comparator.comparingInt(PanelDetector::priority).reversed());
        this.allById = List.copyOf(detectors);

        List<PanelDetector> auto = new ArrayList<>();
        for (PanelDetector d : detectors) {
            if (d instanceof NativeFallbackDetector) {
                continue;
            }
            if (d instanceof ForcedPanelDetector) {
                continue;
            }
            auto.add(d);
        }
        this.autoDetectors = List.copyOf(auto);
    }

    public List<PanelDetector> autoDetectors() {
        return autoDetectors;
    }

    public PanelDetector byId(String panelId) {
        if (panelId == null) {
            return null;
        }
        String id = panelId.toLowerCase(Locale.ROOT);
        for (PanelDetector d : allById) {
            if (d.id().equals(id)) {
                return d;
            }
        }
        return null;
    }

    public boolean isForcedOnly(String panelId) {
        return panelId != null && FORCED_ONLY.contains(panelId.toLowerCase(Locale.ROOT));
    }

    public static boolean isValidPanelMode(String mode) {
        if (mode == null || mode.isBlank()) {
            return true;
        }
        String m = mode.strip().toLowerCase(Locale.ROOT);
        if ("auto".equals(m) || "none".equals(m)) {
            return true;
        }
        return PanelLabels.isKnownPanelId(m) && !"unknown".equals(m);
    }
}
