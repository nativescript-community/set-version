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
} = require("./versionUtils");

const display = console.log; // eslint-disable-line no-console

// function setPackageVersion(versionText) {
//     const PROJECT_ROOT = ".";
//     const jsonPath = path.join(PROJECT_ROOT, paths.packageJson);
//     let packageJSON = null;
//     try {
//         packageJSON = JSON.parse(fs.readFileSync(jsonPath));
//         display(
//             chalk.yellow(
//                 `Will set package version to ${chalk.bold.underline(
//                     versionText
//                 )}`
//             )
//         );
//         packageJSON.version = versionText;
//         fs.writeFileSync(
//             jsonPath,
//             `${JSON.stringify(packageJSON, null, "\t")}\n`
//         );
//         display(
//             chalk.green(`Version replaced in ${chalk.bold("package.json")}`)
//         );
//     } catch (err) {
//         display(
//             chalk.red(
//                 `${chalk.bold.underline(
//                     "ERROR:"
//                 )} Cannot find file with name ${path.resolve(
//                     paths.packageJson
//                 )}`
//             )
//         );
//         process.exit(1);
//     }
//     return packageJSON;
// }

async function getIOSVersionInfo(versionText) {
    let versionInfo = {
        currentVersionCode: null,
        currentVersion: null,
        version: null,
        versionCode: null,
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
        const versionCodeParts =
            plistInfo.CFBundleVersion.toString().split(".");
        const currentVersionCode =
            +versionCodeParts[versionCodeParts.length - 1];
        const version = versionStringToVersion(
            versionText || plistInfo.CFBundleShortVersionString,
            versionText ? currentVersion : undefined,
            currentVersionCode
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
    const bundleVersion = `${version.major}.${version.minor}.${version.patch}.${version.build}`;
    if (version) {
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
            fs.writeFileSync(paths.infoPlist, plist.build(plistInfo), "utf8");
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
    };
    try {
        const actualConfig = await getConfig(config);
        const { appResourcesPath } = actualConfig;
        const gradle = await g2js.parseFile(
            path.join(appResourcesPath, paths.buildGradle)
        );
        const currentVersion = versionStringToVersion(
            gradle.android.defaultConfig.versionName
        );
        const currentVersionCode = +gradle.android.defaultConfig.versionCode;
        const version = versionStringToVersion(
            versionText || gradle.android.defaultConfig.versionName,
            versionText ? currentVersion : undefined,
            currentVersionCode
        );
        const newVersionCode = version.build;
        versionInfo = {
            currentVersionCode,
            currentVersion,
            version,
            versionCode: newVersionCode,
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
    let { version, versionCode } = await getAndroidVersionInfo(versionText, config);

    if (versionCode) {
        versionCode++;
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
                    versionCode
                )}`
            )
        );
        try {
            const actualConfig = await getConfig(config);
            const { appResourcesPath } = actualConfig;
            console.log('appResourcesPath', appResourcesPath)
            const buildGradle = fs.readFileSync(path.join(appResourcesPath, paths.buildGradle), "utf8");
            const newBuildGradle = buildGradle
                .replace(/versionCode \d+/g, `versionCode ${versionCode}`)
                .replace(
                    /versionName "[^"]*"/g,
                    `versionName "${versionText}"`
                );

            fs.writeFileSync(
                path.join(appResourcesPath, paths.buildGradle),
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
            const androidManifest = fs.readFileSync(
                paths.androidManifest,
                "utf8"
            );
            if (
                androidManifest.includes("android:versionCode") ||
                androidManifest.includes("android:versionName")
            ) {
                const newAndroidManifest = androidManifest
                    .replace(
                        /android:versionCode="\d*"/g,
                        `android:versionCode="${versionCode}"`
                    )
                    .replace(
                        /android:versionName="[^"]*"/g,
                        `android:versionName="${versionText}"`
                    );

                fs.writeFileSync(
                    paths.androidManifest,
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
    let currentVersion = await getIOSVersionInfo(undefined, config);
    if (versionText === "major") {
        versionText = `${currentVersion.version.major + 1}.${
            currentVersion.version.minor
        }.${currentVersion.version.patch}`;
    } else if (versionText === "minor") {
        versionText = `${currentVersion.version.major}.${
            currentVersion.version.minor + 1
        }.${currentVersion.version.patch}`;
    } else if (versionText === "patch") {
        versionText = `${currentVersion.version.major}.${
            currentVersion.version.minor
        }.${currentVersion.version.patch + 1}`;
    } else if (
        versionText === undefined ||
        versionText === "" ||
        versionText === "code"
    ) {
        versionText = `${currentVersion.version.major}.${currentVersion.version.minor}.${currentVersion.version.patch}`;
    }

    await setIosApplicationVersion(versionText, config);
}
async function changeAndroidVersion(versionText, config) {
    let currentVersion = await getAndroidVersionInfo(undefined, config);
    if (versionText === "major") {
        versionText = `${currentVersion.version.major + 1}.${
            currentVersion.version.minor
        }.${currentVersion.version.patch}`;
    } else if (versionText === "minor") {
        versionText = `${currentVersion.version.major}.${
            currentVersion.version.minor + 1
        }.${currentVersion.version.patch}`;
    } else if (versionText === "patch") {
        versionText = `${currentVersion.version.major}.${
            currentVersion.version.minor
        }.${currentVersion.version.patch + 1}`;
    } else if (
        versionText === undefined ||
        versionText === "" ||
        versionText === "code"
    ) {
        versionText = `${currentVersion.version.major}.${currentVersion.version.minor}.${currentVersion.version.patch}`;
    }

    await setAndroidApplicationVersion(versionText);
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
