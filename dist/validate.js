"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function run() {
    var _a, _b;
    try {
        core.info("Validação de versão iniciada...");
        let branchName = github.context.ref;
        if (github.context.eventName === "pull_request") {
            branchName = (_b = (_a = github.context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.head.ref) !== null && _b !== void 0 ? _b : branchName;
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
        const openVersionRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
        const dependencyVersionRegex = /^(?:\*|(?:(?:\^|>=)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)))$/;
        const isClosedVersion = strictVersionRegex.test(version);
        const isOpenVersion = openVersionRegex.test(version) && !isClosedVersion;
        const isMainOrRelease = cleanBranchName === "main" || cleanBranchName.startsWith("release/");
        const depTypes = [
            { key: 'dependencies', label: 'Dependências' },
            { key: 'devDependencies', label: 'Dev Dependências' },
            { key: 'peerDependencies', label: 'Peer Dependências' },
            { key: 'optionalDependencies', label: 'Dependências Opcionais' }
        ];
        const versionValidation = isMainOrRelease ? isClosedVersion : isOpenVersion;
        const foundVersions = [
            { name: 'Versão principal', value: version, valid: versionValidation }
        ];
        const invalidDependencies = [];
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
        const isValidVersion = versionValidation && dependencyValidation;
        if (isValidVersion) {
            core.info(`Versão ${version} é válida para a branch ${cleanBranchName}.`);
        }
        else {
            const reasons = [];
            if (isMainOrRelease && !isClosedVersion) {
                reasons.push(`A branch ${cleanBranchName} exige versão principal em formato x.y.z.`);
            }
            else if (!isMainOrRelease && !isOpenVersion) {
                reasons.push(`A branch ${cleanBranchName} exige uma versão principal aberta, como x.y.z-rc.`);
            }
            if (!isClosedVersion && !isOpenVersion) {
                reasons.push(`Versão principal ${version} está em formato inválido.`);
            }
            if (invalidDependencies.length > 0) {
                reasons.push(`Dependências inválidas: ${invalidDependencies.join('; ')}`);
            }
            const failureMessage = `\u001b[31m✖\u001b[0m Validação falhou!\nHá versões não aceitas no package.json para a branch ${cleanBranchName}.\n${reasons.join('\n')}`;
            core.setFailed(failureMessage);
        }
        core.info(`Resultado final: isValidVersion=${isValidVersion}, isClosedVersion=${isClosedVersion}`);
        core.setOutput("is-version-valid", isValidVersion);
        core.setOutput("is-version-closed", isClosedVersion);
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
            return false;
        }
    }
}
