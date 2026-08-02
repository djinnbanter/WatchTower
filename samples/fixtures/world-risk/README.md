# World-risk fixtures (1.1.19)

Layouts used by `WorldRiskAnalyzerTest` (also suitable for manual packs):

```
server/
  world/dimensions/<modId>/<dimName>/   # high risk — save still has mod dimensions
  mods/<modId>-*.jar                    # optional: data/<modId>/dimension/*.json inside jar
```

Disabled jars use Modrinth-style rename: `foo.jar` → `foo.jar.disabled`.
