const path = require("path");
const fs = require("fs");
const YAML = require("yaml");
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

const versionEquals = (versionA, versionB) =>
    versionA.major === versionB.major &&
    versionA.minor === versionB.minor &&
    versionA.patch === versionB.patch;

const versionStringToVersion = (
    versionString,
    currentVersion,
    currentVersionCode
) => {
    const versionParts = versionString.split(".");
    let build = currentVersionCode || 1;
    // if (
    //     versionString &&
    //     currentVersion &&
    //     versionEquals(currentVersion, versionStringToVersion(versionString))
    // ) {
        // const newVersionCode = pad((currentVersionCode + 1).toString(), 2);
        // build = +newVersionCode.substr(newVersionCode.length - 2);
        // build += 1;
        // if (build === 0) {
        //     throw new Error(
        //         "Sorry you have more than 100 builds using that version consider bumping version or change your version manually"
        //     );
        // }
    // }

    return {
        major: +trimText(versionParts[0] || "0"),
        minor: +trimText(versionParts[1] || "1"),
        patch: +trimText(versionParts[2] || "0"),
        build,
    };
};

const versionToVersionCode = (version) => {
    const major = pad(version.major, 2);
    const minor = pad(version.minor, 2);
    const patch = pad(version.patch, 2);
    const { build } = version;

    return +`${major}${minor}${patch}${pad(build, 2)}`;
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
};
