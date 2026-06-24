package dev.mcstatus.watchtower.core.panel;

public final class PterodactylDetector extends WingsFamilyDetector {

    @Override
    public String id() {
        return "pterodactyl";
    }

    @Override
    public int priority() {
        return 90;
    }

    @Override
    String rootConfigKey() {
        return "PTERO_ROOT";
    }

    @Override
    String defaultRoot() {
        return "/var/lib/pterodactyl";
    }

    @Override
    String pathMarker() {
        return "pterodactyl";
    }

    @Override
    String systemdDefault() {
        return "pterodactyl-wings";
    }
}
