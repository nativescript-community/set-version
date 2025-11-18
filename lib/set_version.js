#!/usr/bin/env node

const chalk = require("chalk");
const fs = require("fs");
const g2js = require("gradle-to-js/lib/parser");
const path = require("path");
const plist = require("plist");

const {
    getConfig,
    paths,
    versionStringToVersion,
    versionToVersionCode,
    versionToVersionCodeString,
    bumpNumberString,
    pad,
} = require("./versionUtils");

const display = console.log; // eslint-disable-line no-console

async function getIOSVersionInfo(versionText, config) {
    let versionInfo = {
        currentVersionCode: null,
        currentVersion: null,
        version: null,
        versionCode: null,
        versionCodeStr: null,
    };

    try {
        const actualConfig = await getConfig(config);
        const { appResourcesPath } = actualConfig;
        const plistInfo = plist.parse(
            fs.readFileSync(
                path.join(appResourcesPath, paths.infoPlist),
                "utf8"
            )
        );

        const currentVersion = versionStringToVersion(
            plistInfo.CFBundleShortVersionString
        );

        // CFBundleVersion can be a dotted string; take last segment (build)
        const fullBundleVersion = String(plistInfo.CFBundleVersion || "");
        const versionCodeParts = fullBundleVersion.split(".");
        const currentVersionCodeStr =
            versionCodeParts[versionCodeParts.length - 1] || "1";
        const currentVersionCode =
            +currentVersionCodeStr;

        const version = versionStringToVersion(
            versionText || plistInfo.CFBundleShortVersionString,
            versionText ? currentVersion : undefined,
            currentVersionCodeStr
        );
        console.log(
            "getIOSVersionInfo",
            versionText,
            currentVersion,
            currentVersionCode,
            version
        );
        versionInfo = {
            currentVersionCode,
            currentVersion,
            version,
            versionCode: version.build,
            versionCodeStr: version.buildStr,
        };
    } catch (err) {
        display(
            chalk.yellowBright(
                `${chalk.bold.underline(
                    "WARNING:"
                )} Cannot find key CFBundleShortVersionString in file ${path.resolve(
                    paths.infoPlist
                )}. IOS version configuration will be skipped`
            ),
            err
        );
    }
    return versionInfo;
}

async function setIosApplicationVersion(versionText, config) {
    const { version } = await getIOSVersionInfo(versionText, config);
    if (version) {
        // preserve leading zeros of build by bumping string
        const bundleVersion = bumpNumberString(version.buildStr);

        display("");
        display(chalk.yellow("IOS version info:"));
        display(version);
        display("");
        display(
            chalk.yellow(
                `Will set CFBundleShortVersionString to ${chalk.bold.underline(
                    versionText
                )}`
            )
        );
        display(
            chalk.yellow(
                `Will set CFBundleVersion to ${chalk.bold.underline(
                    bundleVersion
                )}`
            )
        );
        try {
            const actualConfig = await getConfig(config);
            const { appResourcesPath } = actualConfig;
            const plistInfo = plist.parse(
                fs.readFileSync(
                    path.join(appResourcesPath, paths.infoPlist),
                    "utf8"
                )
            );
            plistInfo.CFBundleShortVersionString = versionText;
            plistInfo.CFBundleVersion = bundleVersion;
            fs.writeFileSync(path.join(appResourcesPath, paths.infoPlist), plist.build(plistInfo), "utf8");
            display(
                chalk.green(`Version replaced in ${chalk.bold("Info.plist")}`)
            );
        } catch (err) {
            display(
                chalk.yellowBright(
                    `${chalk.bold.underline(
                        "WARNING:"
                    )} Cannot find file with name ${path.resolve(
                        paths.infoPlist
                    )}. This file will be skipped`
                )
            );
        }
    }
}

async function getAndroidVersionInfo(versionText, config) {
    let versionInfo = {
        currentVersionCode: null,
        currentVersion: null,
        version: null,
        versionCode: null,
        versionCodeStr: null,
    };
    try {
        const actualConfig = await getConfig(config);
        const { appResourcesPath } = actualConfig;
        const gradleFullPath = path.join(appResourcesPath, paths.buildGradle);
        const gradleFileContent = fs.readFileSync(gradleFullPath, "utf8");
        const gradle = await g2js.parseFile(gradleFullPath);
        const currentVersion = versionStringToVersion(
            gradle.android.defaultConfig.versionName
        );

        // Try to find the versionCode in the raw gradle file to keep leading zeros if present
        const versionCodeMatch = gradleFileContent.match(/versionCode\s+(\d+)/);
        const currentVersionCodeStr = versionCodeMatch ? versionCodeMatch[1] : String(gradle.android.defaultConfig.versionCode);
        const currentVersionCode = +currentVersionCodeStr;

        const version = versionStringToVersion(
            versionText || gradle.android.defaultConfig.versionName,
            versionText ? currentVersion : undefined,
            currentVersionCodeStr
        );
        const newVersionCode = version.build;
        versionInfo = {
            currentVersionCode,
            currentVersion,
            version,
            versionCode: newVersionCode,
            versionCodeStr: version.buildStr,
        };
    } catch (err) {
        display(
            chalk.yellowBright(
                `${chalk.bold.underline(
                    "WARNING:"
                )} Cannot find attribute versionCode in file ${path.resolve(
                    paths.buildGradle
                )}. Android version configuration will be skipped`
            ),
            err
        );
    }
    return versionInfo;
}

async function setAndroidApplicationVersion(versionText, config) {
    let { version, versionCode, versionCodeStr } = await getAndroidVersionInfo(versionText, config);

    if (version && typeof version.buildStr === "string") {
        // bump preserving padding/width
        const newVersionCode = bumpNumberString(version.buildStr);

        display("");
        display(chalk.yellow("Android version info:"));
        display(version);

        display("");

        display(
            chalk.yellow(
                `Will set Android version to ${chalk.bold.underline(
                    versionText
                )}`
            )
        );
        display(
            chalk.yellow(
                `Will set Android version code to ${chalk.bold.underline(
                    newVersionCode
                )}`
            )
        );
        try {
            const actualConfig = await getConfig(config);
            const { appResourcesPath } = actualConfig;
            console.log('appResourcesPath', appResourcesPath)
            const buildGradlePath = path.join(appResourcesPath, paths.buildGradle);
            const buildGradle = fs.readFileSync(buildGradlePath, "utf8");
            const newBuildGradle = buildGradle
                .replace(/versionCode\s+\d+/g, `versionCode ${newVersionCode}`)
                .replace(
                    /versionName\s+"[^"]*"/g,
                    `versionName "${versionText}"`
                );

            fs.writeFileSync(
                buildGradlePath,
                newBuildGradle,
                "utf8"
            );
            display(
                chalk.green(`Version replaced in ${chalk.bold("build.gradle")}`)
            );
        } catch (err) {
            display(
                chalk.yellowBright(
                    `${chalk.bold.underline(
                        "WARNING:"
                    )} Cannot find file with name ${path.resolve(
                        paths.buildGradle
                    )}. This file will be skipped`
                )
            );
        }

        try {
            const androidManifestPath = path.join(appResourcesPath, paths.androidManifest);
            const androidManifest = fs.readFileSync(
                androidManifestPath,
                "utf8"
            );
            if (
                androidManifest.includes("android:versionCode") ||
                androidManifest.includes("android:versionName")
            ) {
                const newAndroidManifest = androidManifest
                    .replace(
                        /android:versionCode="\d*"/g,
                        `android:versionCode="${newVersionCode}"`
                    )
                    .replace(
                        /android:versionName="[^"]*"/g,
                        `android:versionName="${versionText}"`
                    );

                fs.writeFileSync(
                    androidManifestPath,
                    newAndroidManifest,
                    "utf8"
                );
                display(
                    chalk.green(
                        `Version replaced in ${chalk.bold(
                            "AndroidManifest.xml"
                        )}`
                    )
                );
            }
        } catch (err) {
            display(
                chalk.yellowBright(
                    `${chalk.bold.underline(
                        "WARNING:"
                    )} Cannot find file with name ${path.resolve(
                        paths.androidManifest
                    )}. This file will be skipped`
                )
            );
        }
    }
}

async function changeIOSVersion(versionText, config) {
    let currentVersionInfo = await getIOSVersionInfo(undefined, config);
    const cur = currentVersionInfo.version;
    if (!cur) {
        return await setIosApplicationVersion(versionText, config);
    }

    const partsCount = cur.partsCount || 3;
    const majorStr = cur.majorStr || String(cur.major);
    const minorStr = cur.minorStr || String(cur.minor);
    const patchStr = cur.patchStr || String(cur.patch);

    if (versionText === "major") {
        const newMajorStr = bumpNumberString(majorStr);
        if (partsCount === 2) {
            const zeroPatch = pad(0, cur.patchWidth || patchStr.length);
            versionText = `${newMajorStr}.${zeroPatch}`;
        } else {
            const zeroMinor = pad(0, cur.minorWidth || minorStr.length);
            const zeroPatch = pad(0, cur.patchWidth || patchStr.length);
            versionText = `${newMajorStr}.${zeroMinor}.${zeroPatch}`;
        }
    } else if (versionText === "minor") {
        if (partsCount === 2) {
            // no real minor in 2parts format: treat as patch bump
            const newPatch = bumpNumberString(patchStr);
            versionText = `${majorStr}.${newPatch}`;
        } else {
            const newMinorStr = bumpNumberString(minorStr);
            const zeroPatch = pad(0, cur.patchWidth || patchStr.length);
            versionText = `${majorStr}.${newMinorStr}.${zeroPatch}`;
        }
    } else if (versionText === "patch") {
        const newPatchStr = bumpNumberString(patchStr);
        if (partsCount === 2) {
            versionText = `${majorStr}.${newPatchStr}`;
        } else {
            versionText = `${majorStr}.${minorStr}.${newPatchStr}`;
        }
    } else if (
        versionText === undefined ||
        versionText === "" ||
        versionText === "code"
    ) {
        if (partsCount === 2) {
            versionText = `${majorStr}.${patchStr}`;
        } else {
            versionText = `${majorStr}.${minorStr}.${patchStr}`;
        }
    }

    await setIosApplicationVersion(versionText, config);
}
async function changeAndroidVersion(versionText, config) {
    let currentVersionInfo = await getAndroidVersionInfo(undefined, config);
    const cur = currentVersionInfo.version;
    if (!cur) {
        return await setAndroidApplicationVersion(versionText, config);
    }

    const partsCount = cur.partsCount || 3;
    const majorStr = cur.majorStr || String(cur.major);
    const minorStr = cur.minorStr || String(cur.minor);
    const patchStr = cur.patchStr || String(cur.patch);

    if (versionText === "major") {
        const newMajorStr = bumpNumberString(majorStr);
        if (partsCount === 2) {
            const zeroPatch = pad(0, cur.patchWidth || patchStr.length);
            versionText = `${newMajorStr}.${zeroPatch}`;
        } else {
            const zeroMinor = pad(0, cur.minorWidth || minorStr.length);
            const zeroPatch = pad(0, cur.patchWidth || patchStr.length);
            versionText = `${newMajorStr}.${zeroMinor}.${zeroPatch}`;
        }
    } else if (versionText === "minor") {
        if (partsCount === 2) {
            // No minor in 2 parts format -> treat as patch bump
            const newPatch = bumpNumberString(patchStr);
            versionText = `${majorStr}.${newPatch}`;
        } else {
            const newMinorStr = bumpNumberString(minorStr);
            const zeroPatch = pad(0, cur.patchWidth || patchStr.length);
            versionText = `${majorStr}.${newMinorStr}.${zeroPatch}`;
        }
    } else if (versionText === "patch") {
        const newPatchStr = bumpNumberString(patchStr);
        if (partsCount === 2) {
            versionText = `${majorStr}.${newPatchStr}`;
        } else {
            versionText = `${majorStr}.${minorStr}.${newPatchStr}`;
        }
    } else if (
        versionText === undefined ||
        versionText === "" ||
        versionText === "code"
    ) {
        if (partsCount === 2) {
            versionText = `${majorStr}.${patchStr}`;
        } else {
            versionText = `${majorStr}.${minorStr}.${patchStr}`;
        }
    }

    await setAndroidApplicationVersion(versionText, config);
}

const changeVersion = async () => {
    let versionText, platform, config;
    if (process.argv.length > 3) {
        versionText = process.argv[3];
        platform = process.argv[2];
         config = process.argv[4];
    } else {
        versionText = process.argv[2];
        config = process.argv[3];
    }

    if (!platform) {
        await changeAndroidVersion(versionText, config);
        await changeIOSVersion(versionText, config);
    } else if (platform === "ios") {
        await changeIOSVersion(versionText, config);
    } else if (platform === "android") {
        await changeAndroidVersion(versionText, config);
    }

    display("");

    display(
        chalk.cyan.bold.underline(
            "Do not forget to change your snapshots to reflect your new version number"
        )
    );

    display("");
};

changeVersion();
