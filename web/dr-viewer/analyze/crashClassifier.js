/**
 * Port of CrashClassifier.java
 */
function str(o, key) {
  return o?.[key] ?? null;
}

function toArray(hints) {
  return hints;
}

function isHostResource(combined, exception) {
  if (combined.includes('serverhangwatchdog')
    || combined.includes('single server tick took')
    || combined.includes('outofmemoryerror')
    || combined.includes('java heap space')
    || combined.includes('direct buffer memory')
    || combined.includes('gc overhead limit')
    || combined.includes('unable to create new native thread')) return true;
  return exception?.includes('ServerHangWatchdog');
}

function isModRelated(combined, modFile, exception) {
  if (modFile && modFile !== 'java.lang.Error') return true;
  if (combined.includes('modloadingcrash')
    || combined.includes('mod loading has failed')
    || combined.includes('modloadingexception')
    || combined.includes('fmlmodloading')) return true;
  if (exception && (exception.includes('ModLoading') || exception.includes('ModException'))) return true;
  return /mod id\s+['"]?([a-z][\w-]*)['"]?/i.test(combined);
}

function isLoader(combined) {
  return combined.includes('neoforged')
    || combined.includes('net.neoforged')
    || combined.includes('cpw.mods')
    || combined.includes('fml early loading')
    || combined.includes('bootstrap');
}

function suspectModId(modFile, exception, summary) {
  if (modFile && !modFile.includes('java.lang')) {
    let base = modFile;
    if (base.endsWith('.jar')) base = base.slice(0, -4);
    if (base.includes('-')) base = base.slice(0, base.indexOf('-'));
    if (base && base !== 'Error') return base.toLowerCase();
  }
  const mod = /Mod\s+\(([^)]+)\)/i.exec(exception || '');
  if (mod) return mod[1].trim().toLowerCase();
  const fml = /mod id\s+['"]?([a-z][\w-]*)['"]?/i.exec(`${exception || ''} ${summary || ''}`);
  if (fml) return fml[1].trim().toLowerCase();
  const ns = /([a-z][\w]*):[\w./_-]+/g.exec(summary || '');
  if (ns && ns[1] !== 'minecraft' && ns[1] !== 'neoforge') return ns[1];
  return null;
}

function hintsMod(suspectModId, combined) {
  const hints = [];
  if (suspectModId) {
    hints.push(`Update or remove mod '${suspectModId}' — check latest.log for dependency errors.`);
    hints.push('Re-download the mod JAR from the official source and replace it in mods/.');
  } else {
    hints.push('Open the crash report and find the mod cited in the stack trace.');
    hints.push('Update or remove the suspected mod, then restart the server.');
  }
  if (combined.includes('mixin')) {
    hints.push('Mixin conflicts often clear after updating both mods to versions tested together.');
  }
  return hints;
}

export function classifyCrash(crash) {
  const exception = str(crash, 'exception');
  const modFile = str(crash, 'mod_file');
  const summary = str(crash, 'summary');
  const combined = `${exception || ''} ${modFile || ''} ${summary || ''}`.toLowerCase();

  if (isHostResource(combined, exception)) {
    return { category: 'host_resource', suspect_mod_id: null, fix_hints: ['Review CPU, RAM, and disk at crash time.'] };
  }
  if (isModRelated(combined, modFile, exception)) {
    const suspect = suspectModId(modFile, exception, summary);
    return { category: 'mod', suspect_mod_id: suspect, fix_hints: hintsMod(suspect, combined) };
  }
  if (isLoader(combined)) {
    return {
      category: 'loader',
      suspect_mod_id: null,
      fix_hints: [
        'NeoForge or loader bootstrap failed — check mods/ for incompatible or corrupt jars.',
        'Compare NeoForge and Minecraft versions with your modpack requirements.',
      ],
    };
  }
  return {
    category: 'unknown',
    suspect_mod_id: null,
    fix_hints: ['Read the full crash report for the root exception.'],
  };
}
