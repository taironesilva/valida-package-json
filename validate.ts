import * as core from "@actions/core"
import * as github from "@actions/github"
import * as fs from "fs"
import * as path from "path"

export async function run() {
    try {
        core.info("Validação de versão iniciada...")

        let branchName = github.context.ref;
        if (github.context.eventName === "pull_request") {
            branchName = github.context.payload.pull_request?.head.ref ?? branchName;
        }

        core.info(`Branch atual: ${branchName}`);

        const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
        const packageJsonPath = path.join(workspace, "package.json");

        if (!fs.existsSync(packageJsonPath)) {
            throw new Error(`package.json: package.json não encontrado em: ${packageJsonPath}`);
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        const version = packageJson.version;
        const cleanBranchName = branchName.replace("refs/heads/", "");

        const strictVersionRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
        const dependencyVersionRegex = /^(?:\^|>=)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
        const isClosedVersion = strictVersionRegex.test(version);
        const isMainOrRelease = cleanBranchName === "main" || cleanBranchName.startsWith("release/");

        const depTypes = [
          { key: 'dependencies', label: 'Dependências' },
          { key: 'devDependencies', label: 'Dev Dependências' },
          { key: 'peerDependencies', label: 'Peer Dependências' },
          { key: 'optionalDependencies', label: 'Dependências Opcionais' }
        ];

        const foundVersions: Array<{ name: string; value: string; valid: boolean }> = [
          { name: 'Versão principal', value: version, valid: isClosedVersion }
        ];

        const invalidDependencies: string[] = [];

        for (const depType of depTypes) {
          const deps = packageJson[depType.key] || {};
          for (const [depName, depVersion] of Object.entries(deps)) {
            const value = String(depVersion);
            const valid = dependencyVersionRegex.test(value);
            foundVersions.push({ name: `${depType.label}: ${depName}`, value, valid });

            if (!valid) {
              invalidDependencies.push(`${depType.label}: ${depName} -> ${depVersion}`);
            }
          }
        }

        core.info('Versões encontradas:');
        for (const item of foundVersions) {
          core.info(`- ${item.name}: ${item.value} (${item.valid ? 'válida' : 'inválida'})`);
        }

        const dependencyValidation = invalidDependencies.length === 0;
        const versionValidation = isMainOrRelease ? isClosedVersion : !isClosedVersion;
        const isValidVersion = versionValidation && dependencyValidation;

        if (isValidVersion) {
            core.info(`Versão ${version} é válida para a branch ${cleanBranchName}.`);
        } else {
            const reasons: string[] = [];

            if (!isClosedVersion) {
              reasons.push(`Versão principal ${version} está em formato inválido. Esperado: x.y.z.`);
            }

            if (isMainOrRelease && !isClosedVersion) {
              reasons.push(`A branch ${cleanBranchName} exige versão principal em formato x.y.z.`);
            } else if (!isMainOrRelease && isClosedVersion) {
              reasons.push(`A branch ${cleanBranchName} exige uma versão principal aberta (sem x.y.z).`);
            }

            if (invalidDependencies.length > 0) {
              reasons.push(`Dependências inválidas: ${invalidDependencies.join('; ')}`);
            }

            core.error(`Validação falhou para a branch ${cleanBranchName}.\n${reasons.join('\n')}`);
        }

        core.setOutput("is-version-valid", isValidVersion);
        core.setOutput("is-version-closed", isClosedVersion);
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
            return false;
        }
    }
}


