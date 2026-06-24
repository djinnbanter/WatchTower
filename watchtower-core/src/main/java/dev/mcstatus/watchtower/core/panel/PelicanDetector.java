package dev.mcstatus.watchtower.core.panel;

public final class PelicanDetector extends WingsFamilyDetector {

    @Override
    public String id() {
        return "pelican";
    }

    @Override
    public int priority() {
        return 89;
    }

    @Override
    String rootConfigKey() {
        return "PELICAN_ROOT";
    }

    @Override
    String defaultRoot() {
        return "/var/lib/pelican";
    }

    @Override
    String pathMarker() {
        return "pelican";
    }

    @Override
    String systemdDefault() {
        return "pelican-wings";
    }
}
