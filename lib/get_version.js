#!/usr/bin/env node

const chalk = require("chalk");
const fs = require("fs");
const g2js = require("gradle-to-js/lib/parser");
const path = require("path");
const plist = require("plist");
const {
    getPaths,
    paths
} = require("./versionUtils");

const getVersion = async () => {
    const platform = process.argv[2];
    const type = process.argv[3];
    const config = process.argv[4];

    const { appResourcesPath } = getPaths(config);

    if (platform === "ios") {
        const plistInfo = plist.parse(
            fs.readFileSync(
                path.join(appResourcesPath, paths.infoPlist),
                "utf8"
            )
        );
        switch (type) {
            case "code":
                console.log(plistInfo.CFBundleVersion);
                break;
            case "version":
                console.log(plistInfo.CFBundleShortVersionString);
                break;
            case "version":
                console.log(
                    `${plistInfo.CFBundleShortVersionString}.${listInfo.CFBundleVersion}`
                );
                break;
        }
    } else if (platform === "android") {
        const gradle = await g2js.parseFile(
            path.join(appResourcesPath, paths.buildGradle)
        );
        const currentVersion = gradle.android.defaultConfig.versionName;
        const currentVersionCode = +gradle.android.defaultConfig.versionCode;
        switch (type) {
            case "code":
                console.log(currentVersionCode);
                break;
            case "version":
                console.log(currentVersion);
                break;
            case "version":
                console.log(`${currentVersion}.${currentVersionCode}`);

                break;
        }
    }
};

getVersion();
