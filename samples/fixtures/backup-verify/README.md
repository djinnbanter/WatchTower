# Backup verify fixtures (1.1.20)

Tests build tiny archives under `@TempDir`. Optional checked-in samples can live here later:

| Case | Expect |
| ---- | ------ |
| Intact zip with `level.dat` + `region/*.mca` | `verified` |
| Zip with level.dat only | `suspicious` |
| Truncated / garbage `.zip` | `broken` |
| `.7z` | `not_checked` |
