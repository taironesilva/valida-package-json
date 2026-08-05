const fs = require('fs');
const path = require('path');

/**
 * Valida se uma versão é estável (sem tags pre-release)
 */
function isStableVersion(version) {
  // Remove prefixos semver (^, ~, >=, <=, etc)
  const cleanVersion = version.replace(/^[\^~>=<\s]*/, '').trim();
  
  // Regex para versão semver com pre-release opcional
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  
  const match = cleanVersion.match(semverRegex);
  
  // Se não é semver, permite (git url, file path, etc)
  if (!match) {
    return { isValid: true, version: cleanVersion, isSemver: false };
  }
  
  // Tem tag pre-release?
  const hasPreRelease = !!match[4];
  
  return {
    isValid: !hasPreRelease,
    version: cleanVersion,
    isSemver: true,
    preRelease: match[4] || null
  };
}

/**
 * Valida o package.json
 */
function validatePackageJson(filePath) {
  console.log(`\n📦 Analisando: ${filePath}\n`);
  console.log('='.repeat(60));
  
  // Lê e parse do arquivo
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const pkg = JSON.parse(fileContent);
  
  const errors = [];
  const packageName = pkg.name || 'desconhecido';
  
  console.log(`📦 Pacote: ${packageName}`);
  
  // Valida versão do pacote
  if (pkg.version) {
    const result = isStableVersion(pkg.version);
    if (result.isSemver && !result.isValid) {
      errors.push({
        type: 'package',
        name: packageName,
        version: pkg.version,
        preRelease: result.preRelease
      });
      console.log(`  ❌ Versão do pacote: ${pkg.version} (tag: ${result.preRelease})`);
    } else if (result.isSemver) {
      console.log(`  ✅ Versão do pacote: ${pkg.version}`);
    }
  }
  
  // Tipos de dependências a verificar
  const depTypes = [
    { key: 'dependencies', label: 'Dependências' },
    { key: 'devDependencies', label: 'Dev Dependências' },
    { key: 'peerDependencies', label: 'Peer Dependências' },
    { key: 'optionalDependencies', label: 'Dependências Opcionais' }
  ];
  
  // Valida cada tipo de dependência
  for (const { key, label } of depTypes) {
    if (pkg[key] && Object.keys(pkg[key]).length > 0) {
      console.log(`\n  📋 ${label}:`);
      
      for (const [depName, version] of Object.entries(pkg[key])) {
        const result = isStableVersion(version);
        
        if (result.isSemver && !result.isValid) {
          errors.push({
            type: key,
            name: depName,
            version: version,
            preRelease: result.preRelease
          });
          console.log(`    ❌ ${depName}: ${version} (tag: ${result.preRelease})`);
        } else if (result.isSemver) {
          console.log(`    ✅ ${depName}: ${version}`);
        } else {
          console.log(`    ⚠️  ${depName}: ${version} (formato não-semver)`);
        }
      }
    }
  }
  
  // Resultado final
  console.log('\n' + '='.repeat(60));
  
  if (errors.length > 0) {
    console.log('\n🔴 ERRO: Versões não estáveis encontradas!\n');
    
    errors.forEach(({ type, name, version, preRelease }) => {
      const typeLabel = type === 'package' ? 'Versão do pacote' : type;
      console.log(`  ❌ [${typeLabel}] ${name}: ${version}`);
      console.log(`     Tag pre-release: "${preRelease}"\n`);
    });
    
    console.log('⚠️  Regra: Apenas versões estáveis são permitidas (ex: 1.0.0)');
    console.log('⚠️  Versões bloqueadas: -alpha, -beta, -rc, -feature, -snapshot, etc.\n');
    console.log(`Total de erros: ${errors.length}`);
    
    // Falha a action
    process.exit(1);
  } else {
    console.log('\n✨ Sucesso! Todas as versões são estáveis.');
    console.log('✅ Nenhuma tag pre-release encontrada.\n');
    process.exit(0);
  }
}

// Execução principal
try {
  // Pega o caminho do arquivo via argumento ou variável de ambiente
  const packagePath = process.env.INPUT_PACKAGE_JSON_PATH || 'package.json';
  const fullPath = path.resolve(process.cwd(), packagePath);
  
  // Verifica se arquivo existe
  if (!fs.existsSync(fullPath)) {
    console.error(`\n❌ ERRO: Arquivo não encontrado: ${fullPath}\n`);
    process.exit(1);
  }
  
  // Valida
  validatePackageJson(fullPath);
  
} catch (error) {
  console.error(`\n❌ ERRO FATAL: ${error.message}\n`);
  process.exit(1);
}