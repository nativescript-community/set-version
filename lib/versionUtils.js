const pad = (stringToPad, width, paddingCharacter) => {
    const padChar = paddingCharacter || "0";
    const toPad = stringToPad.toString();
    return toPad.length >= width
        ? toPad
        : new Array(width - toPad.length + 1).join(padChar) + toPad;
};

const trimText = (s) => {
    const indexOfString = s.search(/[^\d]/);
    let result = s;

    if (indexOfString > 0) {
        result = s.substring(0, indexOfString);
    }

    return result;
};

// helper to read a part with width preservation
const parsePart = (part, defaultValue, currentVersion, key) => {
    const defaultStr = String(defaultValue);
    const partRaw = typeof part === "undefined" || part === null ? defaultStr : String(part);
    let digits = trimText(partRaw);

    if (digits.length === 0) {
        // preserve width from currentVersion if any, otherwise fallback to default width
        const currentWidth = currentVersion && currentVersion[`${key}Width`];
        return {
            num: +defaultStr,
            str: defaultStr,
            width: currentWidth || defaultStr.length,
        };
    }

    return {
        num: +digits,
        str: digits,
        width: digits.length,
    };
};

const versionStringToVersion = (
    versionString,
    currentVersion,
    currentVersionCode
) => {
    // Normalize currentVersion object: if string is provided, parse it to get widths
    let parsedCurrent = {};
    if (typeof currentVersion === "string") {
        parsedCurrent = versionStringToVersion(currentVersion);
    } else if (typeof currentVersion === "object" && currentVersion !== null) {
        parsedCurrent = currentVersion;
    }

    const versionParts = (versionString || "").split(".");
    // partsCount: prefer explicit versionString if present, otherwise fall back to parsedCurrent or 3
    const partsCount = typeof versionString === "string" && versionString.length > 0
        ? versionParts.length
        : (parsedCurrent && parsedCurrent.partsCount) || 3;

    // Build part default uses currentVersionCode (string or number) to preserve width if available
    let currentBuildStr;
    if (typeof currentVersionCode === "string") {
        currentBuildStr = trimText(String(currentVersionCode));
    } else if (typeof currentVersionCode === "number") {
        currentBuildStr = String(currentVersionCode);
    } else if (parsedCurrent && parsedCurrent.buildStr) {
        currentBuildStr = parsedCurrent.buildStr;
    } else {
        currentBuildStr = "1";
    }

    // Support both "major.minor.patch" and "major.patch" (2 parts)
    let majorPart, minorPart, patchPart;

    if (versionParts.length === 1) {
        // Only major provided
        majorPart = parsePart(versionParts[0], "0", parsedCurrent, "major");
        minorPart = parsePart(undefined, parsedCurrent.minor || "1", parsedCurrent, "minor");
        patchPart = parsePart(undefined, parsedCurrent.patch || "0", parsedCurrent, "patch");
    } else if (versionParts.length === 2) {
        // Treat as major.patch (second segment as patch) and preserve minor from currentVersion or default to "1"
        majorPart = parsePart(versionParts[0], "0", parsedCurrent, "major");
        minorPart = parsePart(undefined, parsedCurrent.minor || "1", parsedCurrent, "minor");
        patchPart = parsePart(versionParts[1], "0", parsedCurrent, "patch");
    } else {
        // 3 or more parts -> major.minor.patch
        majorPart = parsePart(versionParts[0], "0", parsedCurrent, "major");
        minorPart = parsePart(versionParts[1], "1", parsedCurrent, "minor");
        patchPart = parsePart(versionParts[2], "0", parsedCurrent, "patch");
    }

    const buildPart = parsePart(currentBuildStr, "1", parsedCurrent, "build");

    return {
        major: +majorPart.num,
        majorStr: majorPart.str,
        majorWidth: majorPart.width || 2,
        minor: +minorPart.num,
        minorStr: minorPart.str,
        minorWidth: minorPart.width || 2,
        patch: +patchPart.num,
        patchStr: patchPart.str,
        patchWidth: patchPart.width || 2,
        build: +buildPart.num,
        buildStr: buildPart.str,
        buildWidth: buildPart.width || 2,
        // new informations:
        partsCount,
        original: typeof versionString === "string" ? versionString : undefined,
    };
};

const versionToVersionCodeString = (version) => {
    const major = pad(version.majorStr || version.major, version.majorWidth || 2);
    const minor = pad(version.minorStr || version.minor, version.minorWidth || 2);
    const patch = pad(version.patchStr || version.patch, version.patchWidth || 2);
    const build = pad(version.buildStr || version.build, version.buildWidth || 2);

    return `${major}${minor}${patch}${build}`;
};

const versionToVersionCode = (version) => {
    // keep backward compatible numeric result (previously returned a number)
    return +versionToVersionCodeString(version);
};

// bump a numeric string preserving its width
const bumpNumberString = (s, increment = 1) => {
    const str = String(s || "");
    const digits = trimText(str);
    const width = digits.length || str.length || 1;
    const numeric = parseInt(digits || "0", 10) + increment;
    return pad(numeric, width);
};

const paths = {
    nsConfig: "./nsconfig.json",
    newNsConfig: "./nativescript.config",
    androidManifest: "Android/AndroidManifest.xml",
    buildGradle: "Android/app.gradle",
    infoPlist: "iOS/Info.plist",
    packageJson: "package.json",
};

const { exec } = require("child_process");
function execute(command) {
    return new Promise((resolve, reject) => {
        exec(command, function (error, stdout, stderr) {
            if (error) {
                reject(stderr);
            } else {
                resolve(stdout);
            }
        });
    });
}

async function getConfig(config) {
    let result;
    const cmdResult = await execute(
        config ? `ns config --config ${config} --json` : "ns config --json"
    );
    try {
        result = JSON.parse(cmdResult);
    } catch (error) {
        //parsing error failed maybe --json is not supported yet, let s dirty parse
        result = {};
        let array = cmdResult.split("\n");
        let prefix;
        let currentSubOjb = result;
        let lastDepth = 0;
        array.forEach((item) => {
            if (item.length === 0) {
                return;
            }
            const depth = item.split("  ").length - 1;
            if (depth !== lastDepth) {
                if (depth < lastDepth) {
                    // we need to find the currentSubOjb to start from
                    const array1 = prefix.split(".").slice(0, depth);
                    currentSubOjb = array1.reduce((acc, val) => {
                        return acc[val];
                    }, result);
                }
                // else we can only be a depth +1 => creating new object
            }
            lastDepth = depth;
            const subArray = item
                .split(":")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            if (subArray.length === 1) {
                const key = subArray[0];
                //we are starting a new Object
                prefix = prefix + "." + key;
                currentSubOjb = currentSubOjb[key] = {};
                currentObjIsArray = !isNaN(parseInt(key));
            } else {
                currentSubOjb[subArray[0]] = subArray[1];
            }
        });
    }
    return result;
}

module.exports = {
    paths,
    getConfig,
    versionStringToVersion,
    versionToVersionCode,
    versionToVersionCodeString,
    bumpNumberString,
    pad,
};
