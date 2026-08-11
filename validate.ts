import * as core from "@action/core"
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

        core.info(`Versão obtida do package.json: ${version}`);

        const cleanBranchName = branchName.replace("refs/heads/", "");
        const isMainOrRelease = cleanBranchName === "main" || cleanBranchName.startsWith("release/");
        const closedVersionRegex = /^v\d+\.\d+\.\d+$/;
        const isClosedVersion = closedVersionRegex.test(version);

        const depTypes = [
          { key: 'dependencies', label: 'Dependências' },
          { key: 'devDependencies', label: 'Dev Dependências' },
          { key: 'peerDependencies', label: 'Peer Dependências' },
          { key: 'optionalDependencies', label: 'Dependências Opcionais' }
        ];

        const invalidDependencies: string[] = [];

        if (isMainOrRelease) {
          for (const depType of depTypes) {
            const deps = packageJson[depType.key] || {};
            for (const [depName, depVersion] of Object.entries(deps)) {
              if (!closedVersionRegex.test(depVersion as string)) {
                invalidDependencies.push(`${depType.label}: ${depName} -> ${depVersion}`);
              }
            }
          }
        }

        const isValidVersion = (isMainOrRelease && isClosedVersion && invalidDependencies.length === 0) || (!isMainOrRelease && !isClosedVersion);
        
        if (isValidVersion) {
            core.info(`Versão ${version} é válida para a branch ${cleanBranchName}.`);
            if (invalidDependencies.length > 0) {
              core.warning(`Dependências inválidas encontradas para branch ${cleanBranchName}:
${invalidDependencies.join("\n")}`);
            }
        } else {
            if (isMainOrRelease && !isClosedVersion) {
              core.warning(`Versão ${version} inválida para a branch ${cleanBranchName}. Esperado: versão fechada (vX.Y.Z).`);
            } else if (!isMainOrRelease && isClosedVersion) {
              core.warning(`Versão ${version} inválida para a branch ${cleanBranchName}. Esperado: versão aberta (x.y.z-beta).`);
            }
            if (invalidDependencies.length > 0) {
              core.warning(`Dependências inválidas encontradas para branch ${cleanBranchName}:
${invalidDependencies.join("\n")}`);
            }
        }

        core.setOutput("is-version-valid", isValidVersion);
        core.setOutput("is-version-closed", isMainOrRelease && isClosedVersion);
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
         return false;
        }
    }
}


